import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  MembershipStatus,
  Prisma,
  SupportAccessStatus,
  TenantStatus,
} from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/services/auth.service';
import { RequestMetadata } from '../../auth/auth.types';
import {
  AdminAuditQueryDto,
  ApplyTemplateDto,
  CreateSupportAccessGrantDto,
  CreateTenantDto,
  InitialTenantAdminDto,
  ListTenantsQueryDto,
  ReasonDto,
  RevokeSupportAccessGrantDto,
  UpdateSubscriptionDto,
  UpdateTenantDto,
  UpdateTenantFeaturesDto,
} from '../dto/admin.dto';

const ADMIN_PROFILE_KEY = 'admin_profile';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async listTenants(query: ListTenantsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = this.tenantOrderBy(query.sort, query.order);
    const [total, tenants] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { memberships: true, directions: true, processes: true } },
        },
      }),
    ]);

    return {
      page,
      page_size: pageSize,
      total,
      items: tenants.map((tenant) => this.serializeTenantListItem(tenant)),
    };
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        settings: true,
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        tenantFeatures: { include: { feature: true } },
        tenantTemplates: {
          include: { templateVersion: { include: { template: true } } },
          orderBy: { appliedAt: 'desc' },
        },
        _count: {
          select: { memberships: true, directions: true, processes: true, campaigns: true },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant introuvable.');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      created_at: tenant.createdAt,
      updated_at: tenant.updatedAt,
      profile: this.getSettingValue(tenant.settings, ADMIN_PROFILE_KEY),
      subscription: tenant.subscriptions[0] ?? null,
      features: tenant.tenantFeatures.map((item) => ({
        code: item.feature.code,
        name: item.feature.name,
        enabled: item.enabled,
        config: item.config,
      })),
      templates: tenant.tenantTemplates.map((item) => ({
        template_id: item.templateVersion.template.id,
        template_code: item.templateVersion.template.code,
        template_name: item.templateVersion.template.name,
        template_version_id: item.templateVersionId,
        version_number: item.templateVersion.versionNumber,
        applied_at: item.appliedAt,
        applied_by: item.appliedBy,
      })),
      counts: tenant._count,
    };
  }

  async createTenant(dto: CreateTenantDto, actorUserId: string, metadata: RequestMetadata) {
    const slug = dto.slug.toLowerCase();
    const exists = await this.prisma.tenant.findUnique({ where: { slug } });
    if (exists) {
      throw new ConflictException('Ce slug tenant existe deja.');
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          status: dto.status ?? TenantStatus.ACTIVE,
          deploymentMode: dto.organization_type,
        },
      });
      await tx.tenantSetting.create({
        data: {
          tenantId: created.id,
          key: ADMIN_PROFILE_KEY,
          value: {
            organization_type: dto.organization_type,
            country: dto.country,
            city: dto.city,
            primary_language: dto.primary_language ?? 'fr',
            timezone: dto.timezone,
            internal_notes: dto.internal_notes ?? null,
          },
        },
      });
      await tx.subscription.create({
        data: {
          tenantId: created.id,
          plan: dto.plan,
          status: dto.status === TenantStatus.SUSPENDED ? 'suspended' : 'trial',
          startsAt: new Date(),
          metadata: {},
        },
      });
      await this.auditWithClient(
        tx,
        created.id,
        actorUserId,
        'tenant_created',
        'tenants',
        created.id,
        { slug, plan: dto.plan },
        metadata,
      );
      return created;
    });

    return this.getTenant(tenant.id);
  }

  async updateTenant(
    id: string,
    dto: UpdateTenantDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    await this.ensureTenant(id);
    const profilePatch = this.withoutUndefined({
      organization_type: dto.organization_type,
      country: dto.country,
      city: dto.city,
      primary_language: dto.primary_language,
      timezone: dto.timezone,
      internal_notes: dto.internal_notes,
    });

    await this.prisma.$transaction(async (tx) => {
      if (dto.name) {
        await tx.tenant.update({ where: { id }, data: { name: dto.name } });
      }
      if (Object.keys(profilePatch).length) {
        const current = await tx.tenantSetting.findUnique({
          where: { tenantId_key: { tenantId: id, key: ADMIN_PROFILE_KEY } },
        });
        await tx.tenantSetting.upsert({
          where: { tenantId_key: { tenantId: id, key: ADMIN_PROFILE_KEY } },
          create: { tenantId: id, key: ADMIN_PROFILE_KEY, value: this.toJsonObject(profilePatch) },
          update: {
            value: this.toJsonObject({
              ...((current?.value as Record<string, unknown>) ?? {}),
              ...profilePatch,
            }),
          },
        });
      }
      await this.auditWithClient(
        tx,
        id,
        actorUserId,
        'tenant_updated',
        'tenants',
        id,
        this.withoutUndefined({ name: dto.name, profile: profilePatch }),
        metadata,
      );
    });

    return this.getTenant(id);
  }

  async suspendTenant(id: string, dto: ReasonDto, actorUserId: string, metadata: RequestMetadata) {
    await this.setTenantStatus(
      id,
      TenantStatus.SUSPENDED,
      'tenant_suspended',
      dto.reason,
      actorUserId,
      metadata,
    );
  }

  async reactivateTenant(id: string, actorUserId: string, metadata: RequestMetadata) {
    await this.setTenantStatus(
      id,
      TenantStatus.ACTIVE,
      'tenant_reactivated',
      null,
      actorUserId,
      metadata,
    );
  }

  async getTenantSummary(id: string) {
    await this.ensureTenant(id);
    const [memberships, directions, processes, campaigns, activeUsers, completeness] =
      await Promise.all([
        this.prisma.tenantMembership.count({ where: { tenantId: id } }),
        this.prisma.direction.count({ where: { tenantId: id, deletedAt: null } }),
        this.prisma.process.count({ where: { tenantId: id, deletedAt: null } }),
        this.prisma.campaign.count({ where: { tenantId: id, status: 'ACTIVE' } }),
        this.prisma.tenantMembership.count({
          where: { tenantId: id, status: MembershipStatus.ACTIVE, user: { status: 'ACTIVE' } },
        }),
        this.prisma.completenessAssessment.aggregate({
          where: { tenantId: id },
          _avg: { globalScore: true },
        }),
      ]);

    return {
      memberships,
      active_users: activeUsers,
      directions,
      processes,
      active_campaigns: campaigns,
      completeness_rate: Number(completeness._avg.globalScore ?? 0),
    };
  }

  async createInitialAdmin(
    tenantId: string,
    dto: InitialTenantAdminDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    await this.ensureTenant(tenantId);
    const invitation = await this.authService.invite(
      {
        email: dto.email,
        full_name: dto.full_name,
        tenant_id: tenantId,
        role_codes: ['tenant_admin'],
      },
      actorUserId,
      metadata,
    );
    const membership = await this.prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId, user: { email: dto.email.toLowerCase().trim() } },
      include: { user: true, roles: { include: { role: true } } },
    });
    await this.audit(
      tenantId,
      actorUserId,
      'initial_admin_created',
      'tenant_memberships',
      membership.id,
      { email: dto.email.toLowerCase().trim(), invitation_message: dto.invitation_message ?? null },
      metadata,
    );

    return {
      membership_id: membership.id,
      user_id: membership.userId,
      email: membership.user.email,
      status: membership.status,
      roles: membership.roles.map((item) => item.role.code),
      invitation_token: invitation.invitation_token,
    };
  }

  async listTemplates() {
    return this.prisma.template.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
  }

  async getTemplate(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: { directions: { orderBy: { sortOrder: 'asc' } }, fields: true, rules: true },
        },
      },
    });
    if (!template) {
      throw new NotFoundException('Template introuvable.');
    }
    return template;
  }

  async applyTemplate(
    tenantId: string,
    dto: ApplyTemplateDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    await this.ensureTenant(tenantId);
    const templateVersion = await this.resolveTemplateVersion(dto.template_version_id);
    const existingDirections = await this.prisma.direction.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    const existingCodes = new Set(
      existingDirections.map((direction) => direction.code).filter(Boolean),
    );
    const existingNames = new Set(existingDirections.map((direction) => direction.name));
    const toCreate = templateVersion.directions.filter((direction) => {
      const code = direction.code ?? this.codeFromName(direction.name);
      return !existingCodes.has(code) && !existingNames.has(direction.name);
    });
    const alreadyExisting = templateVersion.directions.filter((direction) => {
      const code = direction.code ?? this.codeFromName(direction.name);
      return existingCodes.has(code) || existingNames.has(direction.name);
    });
    const preview = {
      template_id: templateVersion.templateId,
      template_version_id: templateVersion.id,
      directions_to_create: toCreate.map((direction) => ({
        name: direction.name,
        code: direction.code ?? this.codeFromName(direction.name),
      })),
      existing_directions: alreadyExisting.map((direction) => ({
        name: direction.name,
        code: direction.code ?? this.codeFromName(direction.name),
      })),
      rules_to_apply: templateVersion.rules.length,
      fields_to_apply: templateVersion.fields.length,
      conflicts: [],
    };

    if (dto.dry_run) {
      return { applied: false, preview };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const direction of toCreate) {
        await tx.direction.create({
          data: {
            tenantId,
            name: direction.name,
            code: direction.code ?? this.codeFromName(direction.name),
            createdBy: actorUserId,
            updatedBy: actorUserId,
          },
        });
      }
      await tx.tenantTemplate.upsert({
        where: { tenantId_templateVersionId: { tenantId, templateVersionId: templateVersion.id } },
        create: {
          tenantId,
          templateVersionId: templateVersion.id,
          appliedBy: actorUserId,
          frozenConfig: this.toJsonValue(templateVersion.configuration),
          customizations: this.toJsonObject({
            overwrite_customizations: dto.overwrite_customizations ?? false,
          }),
        },
        update: {
          appliedBy: actorUserId,
          appliedAt: new Date(),
          frozenConfig: this.toJsonValue(templateVersion.configuration),
          customizations: this.toJsonObject({
            overwrite_customizations: dto.overwrite_customizations ?? false,
          }),
        },
      });
      await this.auditWithClient(
        tx,
        tenantId,
        actorUserId,
        'template_applied',
        'tenant_templates',
        templateVersion.id,
        preview,
        metadata,
      );
    });

    return { applied: true, preview };
  }

  async listFeatures() {
    return this.prisma.feature.findMany({ orderBy: { code: 'asc' } });
  }

  async getTenantFeatures(tenantId: string) {
    await this.ensureTenant(tenantId);
    const [features, tenantFeatures] = await Promise.all([
      this.prisma.feature.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.tenantFeature.findMany({ where: { tenantId }, include: { feature: true } }),
    ]);
    const tenantFeatureByCode = new Map(tenantFeatures.map((item) => [item.feature.code, item]));

    return features.map((feature) => {
      const tenantFeature = tenantFeatureByCode.get(feature.code);
      return {
        id: feature.id,
        code: feature.code,
        name: feature.name,
        description: feature.description,
        enabled: tenantFeature?.enabled ?? false,
        config: tenantFeature?.config ?? null,
      };
    });
  }

  async updateTenantFeatures(
    tenantId: string,
    dto: UpdateTenantFeaturesDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    await this.ensureTenant(tenantId);
    const features = await this.prisma.feature.findMany({
      where: { code: { in: dto.features.map((feature) => feature.code) } },
    });
    const featureByCode = new Map(features.map((feature) => [feature.code, feature]));
    const missing = dto.features.filter((feature) => !featureByCode.has(feature.code));
    if (missing.length) {
      throw new BadRequestException(
        `Feature inconnue: ${missing.map((item) => item.code).join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.features) {
        const feature = featureByCode.get(item.code);
        if (!feature) {
          continue;
        }
        await tx.tenantFeature.upsert({
          where: { tenantId_featureId: { tenantId, featureId: feature.id } },
          create: {
            tenantId,
            featureId: feature.id,
            enabled: item.enabled,
            config: this.toJsonObject(item.config ?? {}),
          },
          update: { enabled: item.enabled, config: this.toJsonObject(item.config ?? {}) },
        });
      }
      await this.auditWithClient(
        tx,
        tenantId,
        actorUserId,
        'features_updated',
        'tenant_features',
        tenantId,
        { features: dto.features },
        metadata,
      );
    });

    return this.getTenantFeatures(tenantId);
  }

  async getSubscription(tenantId: string) {
    await this.ensureTenant(tenantId);
    return this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSubscription(
    tenantId: string,
    dto: UpdateSubscriptionDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    await this.ensureTenant(tenantId);
    const current = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const metadataValue = {
      allowed_users: dto.allowed_users ?? null,
      allowed_directions: dto.allowed_directions ?? null,
      allowed_processes: dto.allowed_processes ?? null,
      options: dto.options ?? {},
      internal_notes: dto.internal_notes ?? null,
    };
    const subscription = current
      ? await this.prisma.subscription.update({
          where: { id: current.id },
          data: {
            plan: dto.plan,
            status: dto.status,
            startsAt: dto.starts_at ? new Date(dto.starts_at) : null,
            endsAt: dto.ends_at ? new Date(dto.ends_at) : null,
            metadata: this.toJsonObject(metadataValue),
          },
        })
      : await this.prisma.subscription.create({
          data: {
            tenantId,
            plan: dto.plan,
            status: dto.status,
            startsAt: dto.starts_at ? new Date(dto.starts_at) : null,
            endsAt: dto.ends_at ? new Date(dto.ends_at) : null,
            metadata: this.toJsonObject(metadataValue),
          },
        });
    await this.audit(
      tenantId,
      actorUserId,
      'subscription_updated',
      'subscriptions',
      subscription.id,
      { plan: dto.plan, status: dto.status },
      metadata,
    );
    return subscription;
  }

  async listSupportAccessGrants() {
    const grants = await this.prisma.supportAccessGrant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { tenant: true },
    });
    return grants.map((grant) => ({
      ...grant,
      effective_status: this.supportGrantEffectiveStatus(grant),
    }));
  }

  async createSupportAccessGrant(
    dto: CreateSupportAccessGrantDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    await this.ensureTenant(dto.tenant_id);
    const supportUser = await this.prisma.user.findUnique({ where: { id: dto.support_user_id } });
    if (!supportUser) {
      throw new NotFoundException('Utilisateur support introuvable.');
    }
    const validFrom = new Date(dto.valid_from);
    const expiresAt = new Date(dto.expires_at);
    if (expiresAt <= validFrom) {
      throw new BadRequestException("La date d'expiration doit etre posterieure au debut.");
    }
    const maxDays = this.configService.get<number>('SUPPORT_ACCESS_MAX_DAYS', 14);
    const maxMs = maxDays * 24 * 60 * 60 * 1000;
    if (expiresAt.getTime() - validFrom.getTime() > maxMs) {
      throw new BadRequestException(
        `La duree maximale d'un acces support est de ${maxDays} jours.`,
      );
    }

    const grant = await this.prisma.supportAccessGrant.create({
      data: {
        tenantId: dto.tenant_id,
        supportUserId: dto.support_user_id,
        authorizedById: dto.authorized_by_id,
        createdById: actorUserId,
        status: SupportAccessStatus.ACTIVE,
        reason: dto.reason,
        scope: this.toJsonObject(dto.scope),
        permissions: this.toJsonValue(dto.permissions ?? []),
        validFrom,
        expiresAt,
      },
    });
    await this.audit(
      dto.tenant_id,
      actorUserId,
      'support_access_grant_created',
      'support_access_grants',
      grant.id,
      { reason: dto.reason, scope: dto.scope, expires_at: dto.expires_at },
      metadata,
      grant.id,
    );
    return { ...grant, effective_status: this.supportGrantEffectiveStatus(grant) };
  }

  async revokeSupportAccessGrant(
    id: string,
    dto: RevokeSupportAccessGrantDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    const current = await this.prisma.supportAccessGrant.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Support access grant introuvable.');
    }
    const grant = await this.prisma.supportAccessGrant.update({
      where: { id },
      data: {
        status: SupportAccessStatus.REVOKED,
        revokedAt: new Date(),
        revokedById: actorUserId,
        revocationReason: dto.reason,
      },
    });
    await this.audit(
      grant.tenantId,
      actorUserId,
      'support_access_grant_revoked',
      'support_access_grants',
      grant.id,
      { reason: dto.reason },
      metadata,
      grant.id,
    );
  }

  assertSupportAccessGrantActive(grant: {
    status: SupportAccessStatus;
    validFrom: Date;
    expiresAt: Date;
    revokedAt: Date | null;
  }) {
    if (this.supportGrantEffectiveStatus(grant) !== 'ACTIVE') {
      throw new ForbiddenSupportAccessException();
    }
  }

  async dashboardSummary() {
    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      activeCampaigns,
      processes,
      activeUsers,
      activeSubscriptions,
      completeness,
      supportAlerts,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE, deletedAt: null } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED, deletedAt: null } }),
      this.prisma.campaign.count({ where: { status: 'ACTIVE' } }),
      this.prisma.process.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: { in: ['trial', 'active'] } } }),
      this.prisma.completenessAssessment.aggregate({ _avg: { globalScore: true } }),
      this.prisma.supportAccessGrant.count({
        where: { status: SupportAccessStatus.ACTIVE, expiresAt: { gte: new Date() } },
      }),
    ]);

    return {
      total_clients: totalTenants,
      active_clients: activeTenants,
      suspended_clients: suspendedTenants,
      active_campaigns: activeCampaigns,
      processes,
      active_users: activeUsers,
      subscriptions: activeSubscriptions,
      global_completeness_rate: Number(completeness._avg.globalScore ?? 0),
      alerts: suspendedTenants + supportAlerts,
    };
  }

  async tenantsAttention() {
    const tenants = await this.prisma.tenant.findMany({
      where: {
        OR: [
          { status: TenantStatus.SUSPENDED },
          { subscriptions: { some: { status: { in: ['past_due', 'expired'] } } } },
        ],
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { processes: true, memberships: true } },
      },
    });
    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      subscription_status: tenant.subscriptions[0]?.status ?? null,
      processes: tenant._count.processes,
      users: tenant._count.memberships,
    }));
  }

  async recentActivity() {
    const logs = await this.prisma.auditLog.findMany({
      where: { action: { in: this.adminAuditActions() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        tenantId: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        result: true,
        createdAt: true,
      },
    });
    return logs.map((log) => ({
      id: log.id,
      tenant_id: log.tenantId,
      actor_user_id: log.actorUserId,
      action: log.action,
      resource_type: log.resourceType,
      resource_id: log.resourceId,
      result: log.result,
      created_at: log.createdAt,
    }));
  }

  async campaignsOverview() {
    const campaigns = await this.prisma.campaign.findMany({
      where: { status: 'ACTIVE' },
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: { tenant: true, _count: { select: { processes: true, directions: true } } },
    });
    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      tenant_id: campaign.tenantId,
      tenant_name: campaign.tenant.name,
      processes: campaign._count.processes,
      directions: campaign._count.directions,
      starts_at: campaign.startsAt,
      ends_at: campaign.endsAt,
    }));
  }

  async auditLogs(query: AdminAuditQueryDto, actorUserId: string, metadata: RequestMetadata) {
    await this.audit(
      null,
      actorUserId,
      'audit_logs_viewed',
      'audit_logs',
      null,
      this.withoutUndefined({ ...query }),
      metadata,
    );
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: query.action,
        tenantId: query.tenant_id,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
      select: {
        id: true,
        tenantId: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        result: true,
        metadata: true,
        createdAt: true,
      },
    });
    return logs.map((log) => ({
      id: log.id,
      tenant_id: log.tenantId,
      actor_user_id: log.actorUserId,
      action: log.action,
      resource_type: log.resourceType,
      resource_id: log.resourceId,
      result: log.result,
      metadata: log.metadata,
      created_at: log.createdAt,
    }));
  }

  private async setTenantStatus(
    id: string,
    status: TenantStatus,
    action: string,
    reason: string | null,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    await this.ensureTenant(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id }, data: { status } });
      if (status === TenantStatus.SUSPENDED) {
        await tx.tenantFeature.updateMany({ where: { tenantId: id }, data: { enabled: false } });
        await tx.subscription.updateMany({
          where: { tenantId: id },
          data: { status: 'suspended' },
        });
      }
      await this.auditWithClient(
        tx,
        id,
        actorUserId,
        action,
        'tenants',
        id,
        this.withoutUndefined({ reason }),
        metadata,
      );
    });
  }

  private async ensureTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant introuvable.');
    }
    return tenant;
  }

  private async resolveTemplateVersion(templateVersionId?: string) {
    const templateVersion = templateVersionId
      ? await this.prisma.templateVersion.findUnique({
          where: { id: templateVersionId },
          include: { directions: { orderBy: { sortOrder: 'asc' } }, fields: true, rules: true },
        })
      : await this.prisma.templateVersion.findFirst({
          where: { template: { code: 'map' }, status: 'published' },
          orderBy: { versionNumber: 'desc' },
          include: { directions: { orderBy: { sortOrder: 'asc' } }, fields: true, rules: true },
        });
    if (!templateVersion) {
      throw new NotFoundException('Template version introuvable.');
    }
    return templateVersion;
  }

  private serializeTenantListItem(tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    createdAt: Date;
    updatedAt: Date;
    subscriptions: { plan: string; status: string }[];
    _count: { memberships: number; directions: number; processes: number };
  }) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      users: tenant._count.memberships,
      directions: tenant._count.directions,
      processes: tenant._count.processes,
      created_at: tenant.createdAt,
      last_activity_at: tenant.updatedAt,
      subscription: tenant.subscriptions[0] ?? null,
    };
  }

  private tenantOrderBy(
    sort = 'created_at',
    order: 'asc' | 'desc' = 'desc',
  ): Prisma.TenantOrderByWithRelationInput {
    const fieldMap = {
      name: 'name',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      status: 'status',
    } as const;
    return { [fieldMap[sort as keyof typeof fieldMap] ?? 'createdAt']: order };
  }

  private getSettingValue(settings: { key: string; value: Prisma.JsonValue }[], key: string) {
    return settings.find((setting) => setting.key === key)?.value ?? null;
  }

  private codeFromName(name: string) {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  private withoutUndefined<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
  }

  private toJsonObject(value: Record<string, unknown>) {
    return value as Prisma.InputJsonObject;
  }

  private toJsonValue(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private supportGrantEffectiveStatus(grant: {
    status: SupportAccessStatus;
    validFrom: Date;
    expiresAt: Date;
    revokedAt: Date | null;
  }) {
    const now = new Date();
    if (grant.revokedAt || grant.status === SupportAccessStatus.REVOKED) {
      return 'REVOKED';
    }
    if (grant.expiresAt <= now) {
      return 'EXPIRED';
    }
    if (grant.validFrom > now) {
      return 'SCHEDULED';
    }
    return grant.status;
  }

  private async audit(
    tenantId: string | null,
    actorUserId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    metadataValue: Record<string, unknown>,
    metadata: RequestMetadata,
    supportGrantId?: string,
  ) {
    await this.auditWithClient(
      this.prisma,
      tenantId,
      actorUserId,
      action,
      resourceType,
      resourceId,
      metadataValue,
      metadata,
      supportGrantId,
    );
  }

  private async auditWithClient(
    client: Pick<PrismaService, 'auditLog'>,
    tenantId: string | null,
    actorUserId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    metadataValue: Record<string, unknown>,
    metadata: RequestMetadata,
    supportGrantId?: string,
  ) {
    await client.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        supportGrantId,
        action,
        resourceType,
        resourceId,
        result: 'success',
        metadata: metadataValue as Prisma.JsonObject,
        ipAddress: metadata.ip,
        userAgent: Array.isArray(metadata.userAgent)
          ? metadata.userAgent.join(', ')
          : metadata.userAgent,
      },
    });
  }

  private adminAuditActions() {
    return [
      'tenant_created',
      'tenant_updated',
      'tenant_suspended',
      'tenant_reactivated',
      'initial_admin_created',
      'template_applied',
      'features_updated',
      'subscription_updated',
      'support_access_grant_created',
      'support_access_grant_revoked',
      'audit_logs_viewed',
    ];
  }
}

export class ForbiddenSupportAccessException extends BadRequestException {
  constructor() {
    super('Support access grant invalide, expire ou revoque.');
  }
}
