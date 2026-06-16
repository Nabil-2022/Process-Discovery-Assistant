import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { BrandLogo } from '../../components/brand/BrandLogo';
import { adminApi, hasSuperAdminAccess } from './api';
import { TenantsPage } from './TenantsPage';

const statusColors = ['#007aff', '#2f9e62', '#b7791f', '#6e6e73'];

export function AdminDashboard() {
  const [period, setPeriod] = useState('30d');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'dashboard' | 'tenants'>('dashboard');
  const allowed = hasSuperAdminAccess();

  if (!allowed) {
    return (
      <main className="admin-shell">
        <section className="admin-empty">
          <BrandLogo variant="full" />
          <p className="eyebrow">HiGroup SaaS</p>
          <h1>Acces administration refuse</h1>
          <p>Connectez-vous avec un compte super_admin pour afficher les donnees plateforme.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <BrandLogo variant="sidebar" />
        <div>
          <p className="eyebrow">HiGroup SaaS</p>
          <h1>Administration plateforme</h1>
        </div>
        <nav className="admin-tabs" aria-label="Vues administration">
          <button
            className={view === 'dashboard' ? 'active' : ''}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button className={view === 'tenants' ? 'active' : ''} onClick={() => setView('tenants')}>
            Tenants
          </button>
        </nav>
      </header>

      {view === 'dashboard' ? (
        <DashboardView
          period={period}
          status={status}
          onPeriodChange={setPeriod}
          onStatusChange={setStatus}
        />
      ) : (
        <TenantsPage status={status} onStatusChange={setStatus} />
      )}
    </main>
  );
}

function DashboardView({
  period,
  status,
  onPeriodChange,
  onStatusChange,
}: {
  period: string;
  status: string;
  onPeriodChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  const summary = useQuery({
    queryKey: ['admin-summary', period, status],
    queryFn: adminApi.summary,
  });
  const attention = useQuery({
    queryKey: ['admin-attention-tenants', period, status],
    queryFn: adminApi.attentionTenants,
  });
  const campaigns = useQuery({
    queryKey: ['admin-campaigns', period],
    queryFn: adminApi.campaigns,
  });
  const activity = useQuery({
    queryKey: ['admin-recent-activity', period],
    queryFn: adminApi.recentActivity,
  });
  const auditLogs = useQuery({ queryKey: ['admin-audit-logs'], queryFn: adminApi.auditLogs });
  const loading =
    summary.isLoading || attention.isLoading || campaigns.isLoading || activity.isLoading;
  const error = summary.error ?? attention.error ?? campaigns.error ?? activity.error;
  const chartData = useMemo(
    () =>
      summary.data
        ? [
            { name: 'Actifs', value: summary.data.active_clients },
            { name: 'Suspendus', value: summary.data.suspended_clients },
            {
              name: 'Autres',
              value: Math.max(
                0,
                summary.data.total_clients -
                  summary.data.active_clients -
                  summary.data.suspended_clients,
              ),
            },
          ]
        : [],
    [summary.data],
  );

  return (
    <section className="admin-grid">
      <div className="admin-toolbar">
        <select value={period} onChange={(event) => onPeriodChange(event.target.value)}>
          <option value="7d">7 jours</option>
          <option value="30d">30 jours</option>
          <option value="90d">90 jours</option>
        </select>
        <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="">Tous statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="SUSPENDED">Suspendus</option>
        </select>
      </div>

      {loading ? <Skeleton /> : null}
      {error ? <ErrorState message={error.message} /> : null}

      {!loading && !error && summary.data ? (
        <>
          <div className="metric-grid">
            <Metric label="Clients" value={summary.data.total_clients} />
            <Metric label="Actifs" value={summary.data.active_clients} />
            <Metric label="Suspendus" value={summary.data.suspended_clients} />
            <Metric label="Campagnes" value={summary.data.active_campaigns} />
            <Metric label="Processus" value={summary.data.processes} />
            <Metric label="Utilisateurs" value={summary.data.active_users} />
            <Metric label="Abonnements" value={summary.data.subscriptions} />
            <Metric
              label="Completude"
              value={`${Math.round(summary.data.global_completeness_rate)}%`}
            />
            <Metric
              label="Alertes"
              value={summary.data.alerts}
              tone={summary.data.alerts ? 'warning' : 'normal'}
            />
          </div>

          <div className="admin-panel chart-panel">
            <h2>Repartition clients</h2>
            {chartData.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={86}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={entry.name} fill={statusColors[index % statusColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="Aucune donnee client disponible." />
            )}
          </div>

          <div className="admin-panel">
            <h2>Tenants a surveiller</h2>
            {attention.data?.length ? (
              <div className="compact-list">
                {attention.data.map((tenant) => (
                  <article key={tenant.id}>
                    <strong>{tenant.name}</strong>
                    <span>
                      {tenant.status} · {tenant.subscription_status ?? 'sans abonnement'}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState label="Aucun tenant ne necessite une attention immediate." />
            )}
          </div>

          <div className="admin-panel">
            <h2>Campagnes en cours</h2>
            {campaigns.data?.length ? (
              <div className="compact-list">
                {campaigns.data.map((campaign) => (
                  <article key={campaign.id}>
                    <strong>{campaign.name}</strong>
                    <span>
                      {campaign.tenant_name} · {campaign.processes} processus
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState label="Aucune campagne active." />
            )}
          </div>

          <div className="admin-panel wide">
            <h2>Activites recentes</h2>
            {activity.data?.length ? (
              <div className="activity-list">
                {activity.data.map((item) => (
                  <article key={item.id}>
                    <span>{item.action}</span>
                    <time>{new Date(item.created_at).toLocaleString()}</time>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState label="Aucune activite d'administration." />
            )}
          </div>

          <SupportAccessPanel />

          <div className="admin-panel">
            <h2>Audit SaaS</h2>
            {auditLogs.data?.length ? (
              <div className="activity-list">
                {auditLogs.data.map((item) => (
                  <article key={item.id}>
                    <span>{item.action}</span>
                    <time>{new Date(item.created_at).toLocaleString()}</time>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState label="Aucun audit d'administration disponible." />
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function SupportAccessPanel() {
  const queryClient = useQueryClient();
  const grants = useQuery({
    queryKey: ['support-access-grants'],
    queryFn: adminApi.supportAccessGrants,
  });
  const createGrant = useMutation({
    mutationFn: (payload: Record<string, unknown>) => adminApi.createSupportAccessGrant(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support-access-grants'] }),
  });
  const revokeGrant = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.revokeSupportAccessGrant(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support-access-grants'] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createGrant.mutate({
      tenant_id: form.get('tenant_id'),
      support_user_id: form.get('support_user_id'),
      reason: form.get('reason'),
      scope: { kind: form.get('scope') || 'diagnostic' },
      permissions: ['support_read'],
      valid_from: new Date(String(form.get('valid_from'))).toISOString(),
      expires_at: new Date(String(form.get('expires_at'))).toISOString(),
    });
  }

  return (
    <div className="admin-panel">
      <h2>Support access</h2>
      <form className="stack-form" onSubmit={submit}>
        <input name="tenant_id" placeholder="Tenant ID" required />
        <input name="support_user_id" placeholder="Super admin ID" required />
        <input name="reason" placeholder="Motif obligatoire" minLength={8} required />
        <input name="scope" placeholder="Perimetre" defaultValue="diagnostic" />
        <input name="valid_from" type="datetime-local" required />
        <input name="expires_at" type="datetime-local" required />
        <button type="submit" disabled={createGrant.isPending}>
          Creer grant
        </button>
      </form>
      {createGrant.error ? <p className="error-text">{createGrant.error.message}</p> : null}
      <div className="compact-list support-list">
        {grants.data?.map((grant) => (
          <article key={grant.id}>
            <strong>{grant.tenant?.name ?? grant.tenantId}</strong>
            <span>{grant.effective_status}</span>
            <button
              onClick={() => {
                const reason = window.prompt('Raison de revocation');
                if (reason) revokeGrant.mutate({ id: grant.id, reason });
              }}
            >
              Revoquer
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Skeleton() {
  return (
    <div className="metric-grid">
      {Array.from({ length: 9 }).map((_, index) => (
        <div className="metric skeleton" key={index} />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="admin-empty error">
      <h2>Erreur de chargement</h2>
      <p>{message}</p>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="empty-inline">{label}</p>;
}
