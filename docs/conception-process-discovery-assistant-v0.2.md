# PROCESS DISCOVERY ASSISTANT — DOSSIER DE CONCEPTION

Version 0.2 consolidée  
Date: 2026-06-12  
Statut: conception consolidée à valider avant développement  

## 1. Corrections Apportées

La version 0.2 consolide la v0.1 avec les décisions obligatoires suivantes:

- architecture compatible SaaS mutualisé, instance dédiée, cloud souverain et on-premise;
- stockage documentaire portable S3, MinIO, compatible S3 ou local en développement;
- authentification MVP email/mot de passe avec JWT court, refresh token rotatif, sessions révocables, invitations et réinitialisation;
- abstraction `IdentityProvider` pour OIDC, Keycloak, Azure AD / Microsoft Entra ID et SAML ultérieurs;
- super_admin HiGroup limité à l'administration plateforme, sans accès automatique au contenu métier détaillé;
- mécanisme `support_access_grants` pour accès support temporaire, motivé, autorisé, journalisé et révocable;
- distinction entre rôles techniques, permissions atomiques et rôles métier tels que process_owner, publisher et approbateur documentaire;
- scopes consultants limités par tenant, campagne, direction, processus et période;
- exports obligatoires PDF, DOCX, XLSX, JSON et BPMN XML;
- versions publiées immuables avec nouvelle version de travail pour toute modification;
- workflow de validation clarifié entre premier cycle et cycles de correction;
- snapshots soumis, approuvés et publiés distingués des données de travail courantes;
- RLS préparée mais non activée automatiquement au MVP;
- PostgreSQL avec schéma dédié `process_discovery`, `DATABASE_URL` et `DIRECT_DATABASE_URL`;
- modèle utilisateur global avec memberships multi-tenant;
- templates configurables et versionnés;
- checklist qualité ISO 9001 configurable, versionnée et probante;
- KPI déclaratifs au MVP;
- BPMN contrôlé: logique officielle séparée des métadonnées graphiques;
- fichiers binaires hors PostgreSQL.

## 2. Décisions Validées

Sont considérés validés:

- interface initiale en français;
- préparation à l'i18n;
- treize directions pour le template MAP;
- monorepo React/NestJS;
- PostgreSQL avec schéma `process_discovery`;
- Prisma ORM;
- moteur BPMN déterministe;
- moteur RACI déterministe;
- score de complétude calculé backend;
- seuil minimum de soumission à 80 %;
- validation humaine obligatoire;
- IA uniquement comme copilote;
- stockage documentaire compatible S3/MinIO;
- KPI déclaratifs au MVP;
- édition BPMN contrôlée;
- utilisateurs potentiellement rattachés à plusieurs directions;
- campagne comme période de collecte et de validation.

## 3. Éléments Configurables

Ne doivent pas être codés en dur:

- mode de déploiement;
- provider de stockage;
- workflow de validation;
- pondération du score;
- règles bloquantes;
- checklist qualité;
- catégories de processus;
- catégories de risques;
- matrice de criticité;
- modèles de procédure;
- permissions additionnelles;
- durée de conservation;
- nombre d'étapes du questionnaire;
- champs du questionnaire;
- langues;
- fonctionnalités par abonnement;
- workflow de publication;
- règles RACI;
- niveaux de confidentialité documentaire.

## 4. Architecture De Déploiement

Modes supportés:

- SaaS mutualisé HiGroup;
- instance dédiée par client;
- cloud souverain;
- installation on-premise.

Principe d'architecture: le coeur applicatif ne dépend d'aucun service cloud propriétaire. Les dépendances externes sont encapsulées derrière des ports/adapters:

- `StorageProvider`: S3, MinIO, compatible S3, local dev;
- `IdentityProvider`: local credentials, OIDC, Keycloak, Entra ID, SAML;
- `EmailProvider`: SMTP, API mail compatible;
- `AiProvider`: provider configurable, désactivable par tenant;
- `ExportRenderer`: workers remplaçables.

Le premier déploiement MAP reste une décision de contexte, pas une hypothèse structurante du code.

## 5. Authentification Et Identités

Décision recommandée et retenue pour la conception: utiliser une identité utilisateur globale et des memberships par tenant.

Motifs:

- un même email peut appartenir à plusieurs tenants;
- le super_admin HiGroup peut exister sans tenant métier;
- les rôles et directions sont contextualisés par membership;
- le modèle facilite SSO et fédération future.

Structure:

- `users`: identité globale, email unique global, statut global;
- `tenant_memberships`: rattachement utilisateur-tenant;
- `membership_roles`: rôles dans le tenant;
- `membership_directions`: directions autorisées;
- `sessions` et `refresh_tokens`: révocation et rotation;
- `identity_accounts`: extension future pour OIDC/SAML si ajoutée après MVP.

MVP:

- email/mot de passe;
- JWT access token court;
- refresh token rotatif stocké hashé;
- révocation de session;
- invitation utilisateur;
- réinitialisation de mot de passe;
- journalisation des connexions et échecs.

SSO ultérieur:

- abstraction `IdentityProvider`;
- mapping identité externe vers `users`;
- mapping claims/groupes vers memberships et rôles selon règles tenant;
- support Keycloak, OIDC, Entra ID et SAML si requis.

## 6. Modèle Multi-Tenant Final

MVP obligatoire:

- `tenant_id` sur toutes les données métier;
- `TenantGuard`;
- policies de ressources;
- repository/service imposant le tenant;
- index commençant par `tenant_id`;
- tests automatisés d'isolation;
- interdiction de faire confiance au `tenant_id` fourni par le frontend.

Le tenant courant est dérivé:

- du membership actif dans le token/session;
- du contexte de requête;
- jamais d'un champ libre envoyé par l'interface, sauf endpoints super_admin explicitement protégés.

Le super_admin administre la plateforme. Il ne peut consulter le contenu métier détaillé d'un tenant que via un support access grant valide.

## 7. Stratégie RLS Progressive

PostgreSQL Row-Level Security est préparée comme défense en profondeur, mais non activée automatiquement au MVP.

Conditions préalables:

- propagation fiable du tenant dans les transactions Prisma;
- compatibilité démontrée avec le connection pooling;
- comportement maîtrisé des jobs asynchrones;
- règles explicites pour super_admin et support grants;
- migrations et seeds compatibles;
- tests d'isolation RLS.

Phase MVP: isolation applicative stricte et testée.  
Phase durcissement: activation RLS table par table après preuve technique.

## 8. Mécanisme De Support HiGroup

Le super_admin ne dispose pas d'un accès métier implicite. L'accès support est encadré par `support_access_grants`.

Champs fonctionnels:

- tenant concerné;
- utilisateur HiGroup bénéficiaire;
- utilisateur tenant autorisant l'accès;
- motif obligatoire;
- périmètre: tenant, campagne, direction, processus, type de ressource;
- permissions temporaires;
- date de début et d'expiration;
- statut: requested, approved, active, revoked, expired, rejected;
- révocation;
- notification tenant;
- audit systématique.

Toute consultation métier sous support grant crée un audit log avec correlation_id, grant_id, ressource consultée, résultat et adresse IP si disponible.

## 9. Rôles, Permissions Et Responsabilités Métier

Rôles techniques conservés:

- `super_admin`
- `tenant_admin`
- `direction_referent`
- `validator`
- `consultant`
- `readonly`

Responsabilités métier distinctes:

- `process_owner`: propriétaire métier du processus, peut être un acteur non utilisateur;
- `direction_referent`: recense et formalise;
- `validator`: revoit et approuve sans modifier directement le contenu soumis;
- `publisher`: publie une version officielle;
- `consultant`: assiste et conseille dans un périmètre limité.

Le publisher peut être:

- tenant_admin;
- validator avec permission `publish_process`;
- rôle qualité dédié configuré via permissions.

Les permissions atomiques évitent de multiplier les rôles. Exemples:

- `create_process`
- `update_process_working_copy`
- `submit_process`
- `review_process`
- `request_changes`
- `approve_process`
- `publish_process`
- `export_process`
- `manage_users`
- `view_sensitive_audit`
- `manage_support_grants`
- `accept_ai_suggestion`

## 10. Matrice RBAC Corrigée

Légende: C créer, R lire, U modifier, D suppression logique, S soumettre, V valider/approuver, P publier, X exporter, A administrer.

| Ressource | super_admin | tenant_admin | direction_referent | validator | consultant | readonly |
|---|---:|---:|---:|---:|---:|---:|
| Plateforme | A | - | - | - | - | - |
| Tenants | C/R/U/D/A | - | - | - | - | - |
| Abonnements | C/R/U/D/A | R | - | - | - | - |
| Fonctionnalités | C/R/U/A | R | - | - | - | - |
| Support grants | C/R/U/A | C/R/U tenant | - | - | - | - |
| Paramètres tenant | R support | R/U/A | R | R | R périmètre | R limité |
| Utilisateurs | R support | C/R/U/D | R limité | R limité | R limité | R limité |
| Memberships/rôles | R support | C/R/U/D | - | - | - | - |
| Directions | R support | C/R/U/D | R périmètre | R | R périmètre | R |
| Campagnes | R support | C/R/U/D | R | R | R périmètre | R |
| Processus travail | R via grant | C/R/U/D | C/R/U périmètre | R snapshot | C/R/U périmètre accordé | R publié |
| Processus soumis | R via grant | R | R | R/V | R/commentaire | R publié |
| Publication | - | P | - | P si permission | - | - |
| Activités | R via grant | C/R/U | C/R/U périmètre | R snapshot | C/R/U périmètre accordé | R publié |
| Acteurs | R via grant | C/R/U/D | C/R/U périmètre | R | C/R/U périmètre accordé | R |
| Documents | R via grant | C/R/U/D | C/R/U périmètre | R | C/R/U périmètre accordé | R publié |
| KPI | R via grant | C/R/U | C/R/U périmètre | R/V | C/R/U périmètre accordé | R publié |
| Risques/contrôles | R via grant | C/R/U | C/R/U périmètre | R/V | C/R/U périmètre accordé | R publié |
| Commentaires | R via grant | C/R/U | C/R/U propres | C/R/U propres | C/R/U propres | R autorisé |
| Validations | R via grant | R/V/P si permission | S | V | R/commenter | R publié |
| Versions | R via grant | R/X | R périmètre | R | R périmètre | R publié |
| Exports | X plateforme agrégée | X tenant | X périmètre | X revue | X périmètre accordé | X publié |
| Suggestions IA | R via grant | C/R/U statut | C/R/U statut périmètre | R/V statut | C/R/U statut périmètre | R validées |
| Audit sensible | R technique | R tenant autorisé | R limité | R validation | - | - |
| Notifications | A | C/R/U tenant | R/U propres | R/U propres | R/U propres | R/U propres |

Tout accès est contrôlé backend. Le frontend n'est pas une barrière de sécurité.

## 11. Scopes Consultants

Un consultant ne reçoit jamais d'accès complet implicite.

Scopes possibles:

- tenant;
- campagne;
- direction;
- processus;
- période de validité;
- permissions accordées.

Modèle recommandé: `consultant_assignments` générique avec `scope_type`, `scope_id`, `valid_from`, `valid_until` et permissions JSON contrôlées.

Interdictions:

- validation officielle;
- publication;
- administration utilisateurs;
- audit sensible;
- accès aux directions non affectées;
- accès hors période.

## 12. Workflow Corrigé

États:

- `draft`
- `in_progress`
- `ready_for_review`
- `submitted`
- `under_review`
- `changes_requested`
- `resubmitted`
- `approved`
- `published`
- `archived`

Premier cycle:

- `draft` -> `in_progress`
- `in_progress` -> `ready_for_review`
- `ready_for_review` -> `submitted`
- `submitted` -> `under_review`

Cycle de correction:

- `under_review` -> `changes_requested`
- `changes_requested` -> `in_progress`
- `in_progress` -> `resubmitted`, uniquement si `submission_number > 0`
- `resubmitted` -> `under_review`

Fin de cycle:

- `under_review` -> `approved`
- `approved` -> `published`
- `published` -> `archived`

Champs de pilotage:

- `review_cycle_number`;
- `submission_number`;
- `last_submitted_snapshot_id`;
- `last_submitted_version_id`;
- `status_changed_at`;
- `status_changed_by`.

Les demandes de correction exigent un commentaire. Le retour à `in_progress` ne supprime jamais les preuves de soumission précédentes.

## 13. Stratégie De Snapshots

Distinctions:

- données de travail courantes: modifiables selon droits;
- snapshot soumis: figé à la soumission;
- snapshot approuvé: figé à l'approbation;
- version publiée: immuable.

Recommandation: verrouiller la version de travail soumise pendant la revue. Si l'organisation veut continuer à travailler, créer une nouvelle révision de travail séparée non incluse dans le snapshot en cours.

Justification:

- le validateur examine un contenu stable;
- la preuve de soumission reste opposable;
- les corrections sont traçables;
- le modèle évite les revues mouvantes difficiles à auditer.

Toute soumission crée un `ProcessSnapshot` avec type `submitted`, hash et payload complet. L'approbation crée ou référence un snapshot `approved`. La publication crée un `ProcessVersion` immuable.

## 14. Règles D'Immuabilité

Une version publiée est immuable.

Interdictions:

- modifier directement une version publiée;
- écraser un snapshot;
- restaurer en écrasant l'historique.

Toute modification post-publication:

1. crée une nouvelle version de travail;
2. référence la version publiée précédente;
3. conserve un snapshot complet;
4. repasse par validation;
5. produit une nouvelle version publiée;
6. renseigne la version remplacée.

Champs requis:

- `version_number`;
- `parent_version_id`;
- `source_version_id`;
- `effective_date`;
- `superseded_at`;
- `superseded_by_version_id`;
- `snapshot_hash`;
- `publication_reason`.

Une restauration crée une nouvelle version à partir d'une ancienne version.

## 15. Templates Versionnés

Les templates sont des données configurables et versionnées.

Un template définit:

- directions types;
- catégories de processus;
- champs de questionnaire;
- ordre des étapes;
- champs obligatoires;
- règles de validation;
- pondérations de complétude;
- règles bloquantes;
- niveaux de criticité;
- nomenclature des risques;
- modèles de KPI;
- checklist qualité;
- workflow de validation;
- modèles de procédure;
- règles RACI.

Un template appliqué ne change pas silencieusement. Lors de l'application:

- `template_id`;
- `template_version_id`;
- date d'application;
- utilisateur;
- configuration figée;
- personnalisations tenant.

Le template MAP initial inclut les 13 directions validées et reste une donnée de configuration.

## 16. Alignement ISO 9001 Et Maîtrise Documentaire

La plateforme facilite l'alignement, la documentation, la traçabilité et la préparation d'un système de management qualité. Elle ne certifie pas automatiquement ISO 9001.

Checklist qualité:

- configurable;
- versionnée;
- rattachée au template;
- évaluée déterministiquement;
- accompagnée de preuves;
- validée humainement.

La procédure distingue:

- informations déterministes issues des données validées;
- texte rédigé ou reformulé par l'utilisateur;
- suggestions IA;
- contenu officiellement validé.

Maîtrise documentaire:

- référence documentaire;
- version;
- propriétaire;
- approbateur;
- date d'approbation;
- date d'entrée en vigueur;
- date de prochaine revue;
- statut documentaire;
- niveau de confidentialité;
- historique;
- documents remplacés.

## 17. KPI, Risques Et Contrôles

Les KPI du MVP sont déclaratifs. Les connexions à des sources opérationnelles sont prévues ultérieurement via adapters, hors MVP.

KPI:

- nom;
- objectif;
- définition;
- formule;
- unité;
- source;
- fréquence;
- cible;
- seuil d'alerte;
- propriétaire;
- méthode de collecte;
- statut;
- preuve éventuelle.

Risque:

- catégorie;
- description;
- cause;
- conséquence;
- probabilité;
- impact;
- criticité brute;
- contrôles;
- criticité résiduelle;
- propriétaire;
- plan de traitement;
- échéance;
- statut.

Matrices et méthodes de criticité: configurables par template.

## 18. BPMN Contrôlé

Source officielle:

- activités;
- transitions;
- conditions;
- événements;
- acteurs;
- responsabilités.

Le diagramme BPMN est généré depuis ce modèle. L'utilisateur peut:

- corriger les données structurées;
- déplacer visuellement les éléments;
- enregistrer les coordonnées graphiques;
- modifier les libellés autorisés.

Il ne peut pas créer une logique BPMN libre non répercutée dans le modèle structuré.

Séparation:

- logique BPMN officielle: transitions, gateways, tâches, lanes;
- métadonnées de présentation: coordonnées, dimensions, zoom, libellés d'affichage autorisés.

## 19. Exports Obligatoires

Formats obligatoires:

- PDF;
- Word DOCX;
- Excel XLSX;
- JSON;
- BPMN XML.

ZIP optionnel pour dossier documentaire complet.

Exports à prévoir:

- fiche processus PDF/DOCX;
- procédure PDF/DOCX;
- RACI XLSX/PDF;
- registre des risques XLSX/PDF;
- liste des KPI XLSX/PDF;
- backlog XLSX;
- données structurées JSON;
- diagramme BPMN XML;
- dossier complet ZIP optionnel.

Tout export est journalisé dans `export_jobs` et `audit_logs`.

## 20. Stratégie Documentaire Et Fichiers

Les fichiers binaires ne sont pas stockés en PostgreSQL.

PostgreSQL conserve:

- tenant_id;
- storage_provider;
- bucket;
- object_key;
- filename;
- mime_type;
- size;
- checksum;
- classification;
- version;
- uploaded_by;
- timestamps;
- statut antivirus si disponible.

À prévoir:

- limite de taille;
- types autorisés;
- antivirus configurable;
- URL temporaire signée;
- contrôle d'accès tenant;
- audit du téléchargement;
- politique de rétention.

## 21. Base PostgreSQL Et Migrations

Schéma dédié: `process_discovery`.

Interdictions:

- `DROP DATABASE`;
- `prisma migrate reset` sur base distante;
- suppression de tables externes;
- modification de tables externes sans validation;
- `db push` contre production;
- `DATABASE_URL` dans le code.

Variables:

```env
DATABASE_URL=
DIRECT_DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
AI_PROVIDER=
AI_API_KEY=
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

Processus de déploiement:

1. migration locale;
2. migration staging;
3. revue du SQL;
4. sauvegarde;
5. migration production;
6. contrôle post-migration;
7. rollback applicatif;
8. restauration DB si nécessaire.

## 22. Index PostgreSQL

Index principaux:

- `tenant_id, id` sur tables métier;
- `tenant_id, deleted_at`;
- `tenant_id, status`;
- `tenant_id, direction_id, status`;
- `tenant_id, campaign_id, status`;
- `tenant_id, process_id, sort_order`;
- `tenant_id, process_id, from_activity_id, to_activity_id`;
- `tenant_id, process_id, activity_id, actor_id`;
- `tenant_id, resource_type, resource_id, created_at`;
- `tenant_id, user_id, read_at`;
- `tenant_id, template_version_id`;
- `tenant_id, expires_at` sur support grants;
- `tenant_id, process_id, version_number`;
- `tenant_id, process_id, snapshot_type, created_at`;
- GIN full-text ou trigram pour recherche avancée si activée.

Contraintes:

- email global unique sur users;
- slug tenant unique;
- membership unique `(tenant_id, user_id)`;
- code processus unique par tenant si renseigné;
- version publiée unique `(tenant_id, process_id, version_number)`;
- noms directions uniques par tenant hors soft delete si exigé.

## 23. Schéma Prisma Complet

Le schéma ci-dessous est la proposition cible v0.2. Il est conçu pour être formatable et validable après intégration dans un projet Prisma avec la version supportant `multiSchema`.

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
  schemas   = ["process_discovery"]
}

enum TenantStatus {
  active
  suspended
  archived
  @@schema("process_discovery")
}

enum UserStatus {
  invited
  active
  suspended
  disabled
  @@schema("process_discovery")
}

enum MembershipStatus {
  invited
  active
  suspended
  revoked
  @@schema("process_discovery")
}

enum ProcessStatus {
  draft
  in_progress
  ready_for_review
  submitted
  under_review
  changes_requested
  resubmitted
  approved
  published
  archived
  @@schema("process_discovery")
}

enum SnapshotType {
  working
  submitted
  approved
  published
  restored_source
  @@schema("process_discovery")
}

enum ValidationDecision {
  submitted
  review_started
  changes_requested
  resubmitted
  approved
  published
  archived
  cancelled
  @@schema("process_discovery")
}

enum AiSuggestionStatus {
  proposed
  accepted
  rejected
  modified
  validated
  @@schema("process_discovery")
}

enum SupportGrantStatus {
  requested
  approved
  active
  revoked
  expired
  rejected
  @@schema("process_discovery")
}

enum ExportStatus {
  queued
  running
  completed
  failed
  expired
  @@schema("process_discovery")
}

enum ExportFormat {
  pdf
  docx
  xlsx
  json
  bpmn_xml
  zip
  @@schema("process_discovery")
}

enum CommentStatus {
  open
  resolved
  archived
  @@schema("process_discovery")
}

enum NotificationStatus {
  unread
  read
  archived
  @@schema("process_discovery")
}

enum DocumentStatus {
  draft
  under_review
  approved
  effective
  superseded
  archived
  @@schema("process_discovery")
}

enum RiskStatus {
  identified
  assessed
  treatment_planned
  monitored
  closed
  @@schema("process_discovery")
}

enum KpiStatus {
  draft
  proposed
  validated
  archived
  @@schema("process_discovery")
}

model Tenant {
  id          String       @id @default(uuid()) @db.Uuid
  name        String
  slug        String       @unique
  status      TenantStatus @default(active)
  deploymentMode String?   @map("deployment_mode")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")
  deletedAt   DateTime?    @map("deleted_at")

  settings       TenantSetting[]
  subscriptions  Subscription[]
  features       TenantFeature[]
  memberships    TenantMembership[]
  directions     Direction[]
  campaigns      Campaign[]
  processes      Process[]
  supportGrants  SupportAccessGrant[]

  @@index([status])
  @@schema("process_discovery")
}

model TenantSetting {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  key       String
  value     Json
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@unique([tenantId, key])
  @@index([tenantId])
  @@schema("process_discovery")
}

model Subscription {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  plan      String
  status    String
  startsAt  DateTime? @map("starts_at")
  endsAt    DateTime? @map("ends_at")
  metadata  Json?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([tenantId, status])
  @@schema("process_discovery")
}

model Feature {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  tenants TenantFeature[]

  @@schema("process_discovery")
}

model TenantFeature {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  featureId String   @map("feature_id") @db.Uuid
  enabled   Boolean  @default(true)
  config    Json?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  feature Feature @relation(fields: [featureId], references: [id], onDelete: Restrict)

  @@unique([tenantId, featureId])
  @@index([tenantId, enabled])
  @@schema("process_discovery")
}

model User {
  id           String     @id @default(uuid()) @db.Uuid
  email        String     @unique
  passwordHash String?    @map("password_hash")
  fullName     String     @map("full_name")
  status       UserStatus @default(invited)
  locale       String     @default("fr")
  lastLoginAt  DateTime?  @map("last_login_at")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")
  deletedAt    DateTime?  @map("deleted_at")

  memberships TenantMembership[]
  sessions    Session[]
  refreshTokens RefreshToken[]
  createdAuditLogs AuditLog[] @relation("AuditActor")

  @@index([status])
  @@schema("process_discovery")
}

model Session {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  userAgent String?  @map("user_agent")
  ipAddress String?  @map("ip_address")
  revokedAt DateTime? @map("revoked_at")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokens RefreshToken[]

  @@index([userId, expiresAt])
  @@schema("process_discovery")
}

model RefreshToken {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  sessionId   String    @map("session_id") @db.Uuid
  tokenHash   String    @map("token_hash")
  rotatedFromId String? @map("rotated_from_id") @db.Uuid
  revokedAt   DateTime? @map("revoked_at")
  expiresAt   DateTime  @map("expires_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([tokenHash])
  @@index([userId, expiresAt])
  @@index([sessionId])
  @@schema("process_discovery")
}

model TenantMembership {
  id        String           @id @default(uuid()) @db.Uuid
  tenantId  String           @map("tenant_id") @db.Uuid
  userId    String           @map("user_id") @db.Uuid
  status    MembershipStatus @default(invited)
  invitedBy String?          @map("invited_by") @db.Uuid
  invitedAt DateTime?        @map("invited_at")
  joinedAt  DateTime?        @map("joined_at")
  createdAt DateTime         @default(now()) @map("created_at")
  updatedAt DateTime         @updatedAt @map("updated_at")
  deletedAt DateTime?        @map("deleted_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  user   User   @relation(fields: [userId], references: [id], onDelete: Restrict)
  roles  MembershipRole[]
  directions MembershipDirection[]
  consultantAssignments ConsultantAssignment[]

  @@unique([tenantId, userId])
  @@index([tenantId, status])
  @@index([userId])
  @@schema("process_discovery")
}

model Role {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique
  name        String
  description String?
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  permissions RolePermission[]
  memberships MembershipRole[]

  @@schema("process_discovery")
}

model Permission {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique
  resource    String
  action      String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")

  roles RolePermission[]

  @@index([resource, action])
  @@schema("process_discovery")
}

model RolePermission {
  id           String @id @default(uuid()) @db.Uuid
  roleId       String @map("role_id") @db.Uuid
  permissionId String @map("permission_id") @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
  @@schema("process_discovery")
}

model MembershipRole {
  id           String @id @default(uuid()) @db.Uuid
  membershipId String @map("membership_id") @db.Uuid
  roleId       String @map("role_id") @db.Uuid

  membership TenantMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  role       Role             @relation(fields: [roleId], references: [id], onDelete: Restrict)

  @@unique([membershipId, roleId])
  @@index([membershipId])
  @@schema("process_discovery")
}

model MembershipDirection {
  id           String @id @default(uuid()) @db.Uuid
  membershipId String @map("membership_id") @db.Uuid
  directionId  String @map("direction_id") @db.Uuid

  membership TenantMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  direction  Direction        @relation(fields: [directionId], references: [id], onDelete: Cascade)

  @@unique([membershipId, directionId])
  @@index([directionId])
  @@schema("process_discovery")
}

model SupportAccessGrant {
  id              String             @id @default(uuid()) @db.Uuid
  tenantId         String             @map("tenant_id") @db.Uuid
  supportUserId    String             @map("support_user_id") @db.Uuid
  authorizedById   String?            @map("authorized_by_id") @db.Uuid
  status           SupportGrantStatus @default(requested)
  reason           String
  scope            Json
  permissions      Json
  validFrom        DateTime           @map("valid_from")
  expiresAt        DateTime           @map("expires_at")
  revokedAt        DateTime?          @map("revoked_at")
  createdAt        DateTime           @default(now()) @map("created_at")
  updatedAt        DateTime           @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([tenantId, status, expiresAt])
  @@index([supportUserId, status])
  @@schema("process_discovery")
}

model ConsultantAssignment {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  membershipId String   @map("membership_id") @db.Uuid
  scopeType    String   @map("scope_type")
  scopeId      String?  @map("scope_id") @db.Uuid
  permissions  Json?
  validFrom    DateTime? @map("valid_from")
  validUntil   DateTime? @map("valid_until")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  membership TenantMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)

  @@index([tenantId, scopeType, scopeId])
  @@index([membershipId])
  @@schema("process_discovery")
}

model Template {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique
  name        String
  description String?
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  versions TemplateVersion[]

  @@schema("process_discovery")
}

model TemplateVersion {
  id             String   @id @default(uuid()) @db.Uuid
  templateId      String   @map("template_id") @db.Uuid
  versionNumber   Int      @map("version_number")
  status          String   @default("draft")
  configuration   Json
  appliedSnapshot Json?
  createdBy       String?  @map("created_by") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at")

  template   Template @relation(fields: [templateId], references: [id], onDelete: Restrict)
  directions TemplateDirection[]
  fields     TemplateField[]
  rules      TemplateRule[]

  @@unique([templateId, versionNumber])
  @@index([templateId, status])
  @@schema("process_discovery")
}

model TemplateDirection {
  id                String @id @default(uuid()) @db.Uuid
  templateVersionId String @map("template_version_id") @db.Uuid
  name              String
  code              String?
  sortOrder         Int    @default(0) @map("sort_order")
  metadata          Json?

  templateVersion TemplateVersion @relation(fields: [templateVersionId], references: [id], onDelete: Cascade)

  @@index([templateVersionId, sortOrder])
  @@schema("process_discovery")
}

model TemplateField {
  id                String  @id @default(uuid()) @db.Uuid
  templateVersionId String  @map("template_version_id") @db.Uuid
  stepCode          String  @map("step_code")
  fieldKey          String  @map("field_key")
  label             String
  fieldType         String  @map("field_type")
  required          Boolean @default(false)
  validation        Json?
  helpText          String? @map("help_text")
  examples          Json?
  sortOrder         Int     @default(0) @map("sort_order")

  templateVersion TemplateVersion @relation(fields: [templateVersionId], references: [id], onDelete: Cascade)

  @@unique([templateVersionId, fieldKey])
  @@index([templateVersionId, stepCode, sortOrder])
  @@schema("process_discovery")
}

model TemplateRule {
  id                String @id @default(uuid()) @db.Uuid
  templateVersionId String @map("template_version_id") @db.Uuid
  ruleType          String @map("rule_type")
  code              String
  configuration     Json
  severity          String?

  templateVersion TemplateVersion @relation(fields: [templateVersionId], references: [id], onDelete: Cascade)

  @@unique([templateVersionId, code])
  @@index([templateVersionId, ruleType])
  @@schema("process_discovery")
}

model Direction {
  id        String    @id @default(uuid()) @db.Uuid
  tenantId  String    @map("tenant_id") @db.Uuid
  name      String
  code      String?
  parentId  String?   @map("parent_id") @db.Uuid
  status    String    @default("active")
  createdBy String?   @map("created_by") @db.Uuid
  updatedBy String?   @map("updated_by") @db.Uuid
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  memberships MembershipDirection[]
  campaigns CampaignDirection[]
  processes Process[]
  actors Actor[]

  @@unique([tenantId, code])
  @@index([tenantId, status])
  @@schema("process_discovery")
}

model Campaign {
  id          String    @id @default(uuid()) @db.Uuid
  tenantId    String    @map("tenant_id") @db.Uuid
  name        String
  description String?
  status      String    @default("draft")
  startsAt    DateTime? @map("starts_at")
  endsAt      DateTime? @map("ends_at")
  createdBy   String?   @map("created_by") @db.Uuid
  updatedBy   String?   @map("updated_by") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  directions CampaignDirection[]
  processes Process[]

  @@index([tenantId, status])
  @@schema("process_discovery")
}

model CampaignDirection {
  id          String @id @default(uuid()) @db.Uuid
  tenantId    String @map("tenant_id") @db.Uuid
  campaignId  String @map("campaign_id") @db.Uuid
  directionId String @map("direction_id") @db.Uuid
  status      String @default("active")
  progress    Decimal @default(0)

  campaign  Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  direction Direction @relation(fields: [directionId], references: [id], onDelete: Restrict)

  @@unique([campaignId, directionId])
  @@index([tenantId, status])
  @@schema("process_discovery")
}

model ProcessCategory {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  name      String
  code      String?
  type      String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  processes Process[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@schema("process_discovery")
}

model Process {
  id                    String        @id @default(uuid()) @db.Uuid
  tenantId              String        @map("tenant_id") @db.Uuid
  directionId           String        @map("direction_id") @db.Uuid
  campaignId            String?       @map("campaign_id") @db.Uuid
  categoryId            String?       @map("category_id") @db.Uuid
  processOwnerActorId   String?       @map("process_owner_actor_id") @db.Uuid
  code                  String?
  name                  String
  description           String?
  objective             String?
  scope                 String?
  triggerEvent          String?       @map("trigger_event")
  status                ProcessStatus @default(draft)
  reviewCycleNumber     Int           @default(0) @map("review_cycle_number")
  submissionNumber      Int           @default(0) @map("submission_number")
  lastSubmittedSnapshotId String?      @map("last_submitted_snapshot_id") @db.Uuid
  lastSubmittedVersionId  String?      @map("last_submitted_version_id") @db.Uuid
  completenessScore     Decimal       @default(0) @map("completeness_score")
  lockVersion           Int           @default(1) @map("lock_version")
  createdBy             String?       @map("created_by") @db.Uuid
  updatedBy             String?       @map("updated_by") @db.Uuid
  createdAt             DateTime      @default(now()) @map("created_at")
  updatedAt             DateTime      @updatedAt @map("updated_at")
  deletedAt             DateTime?     @map("deleted_at")

  tenant    Tenant          @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  direction Direction       @relation(fields: [directionId], references: [id], onDelete: Restrict)
  campaign  Campaign?       @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  category  ProcessCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  ownerActor Actor?         @relation(fields: [processOwnerActorId], references: [id], onDelete: SetNull)
  inputs    ProcessInput[]
  outputs   ProcessOutput[]
  activities ProcessActivity[]
  transitions ProcessTransition[]
  actorRoles ProcessActorRole[]
  applications ProcessApplication[]
  documents ProcessDocument[]
  kpis Kpi[]
  risks Risk[]
  painPoints PainPoint[]
  automationNeeds AutomationNeed[]
  assessments CompletenessAssessment[]
  versions ProcessVersion[]
  snapshots ProcessSnapshot[]
  validations ProcessValidation[]
  comments Comment[]
  attachments Attachment[]
  aiSuggestions AiSuggestion[]
  exportJobs ExportJob[]

  @@unique([tenantId, code])
  @@index([tenantId, status])
  @@index([tenantId, directionId, status])
  @@index([tenantId, campaignId, status])
  @@schema("process_discovery")
}

model ProcessInput {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  processId String   @map("process_id") @db.Uuid
  name      String
  description String?
  source    String?
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Cascade)

  @@index([tenantId, processId, sortOrder])
  @@schema("process_discovery")
}

model ProcessOutput {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  processId String   @map("process_id") @db.Uuid
  name      String
  description String?
  destination String?
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Cascade)

  @@index([tenantId, processId, sortOrder])
  @@schema("process_discovery")
}

model ProcessActivity {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  processId String   @map("process_id") @db.Uuid
  code      String?
  name      String
  description String?
  activityType String? @map("activity_type")
  sortOrder Int      @default(0) @map("sort_order")
  inputText String?  @map("input_text")
  outputText String? @map("output_text")
  condition String?
  duration  String?
  isAutomated Boolean @default(false) @map("is_automated")
  lockVersion Int     @default(1) @map("lock_version")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Cascade)
  outgoingTransitions ProcessTransition[] @relation("TransitionFrom")
  incomingTransitions ProcessTransition[] @relation("TransitionTo")
  actorRoles ProcessActorRole[]

  @@unique([tenantId, processId, code])
  @@index([tenantId, processId, sortOrder])
  @@schema("process_discovery")
}

model ProcessTransition {
  id             String @id @default(uuid()) @db.Uuid
  tenantId       String @map("tenant_id") @db.Uuid
  processId      String @map("process_id") @db.Uuid
  fromActivityId String? @map("from_activity_id") @db.Uuid
  toActivityId   String? @map("to_activity_id") @db.Uuid
  label          String?
  condition      String?
  transitionType String? @map("transition_type")
  sortOrder      Int    @default(0) @map("sort_order")

  process      Process @relation(fields: [processId], references: [id], onDelete: Cascade)
  fromActivity ProcessActivity? @relation("TransitionFrom", fields: [fromActivityId], references: [id], onDelete: SetNull)
  toActivity   ProcessActivity? @relation("TransitionTo", fields: [toActivityId], references: [id], onDelete: SetNull)

  @@index([tenantId, processId, fromActivityId, toActivityId])
  @@schema("process_discovery")
}

model Actor {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  directionId String?  @map("direction_id") @db.Uuid
  name        String
  title       String?
  email       String?
  isPlatformUser Boolean @default(false) @map("is_platform_user")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  direction Direction? @relation(fields: [directionId], references: [id], onDelete: SetNull)
  ownedProcesses Process[]
  roles ProcessActorRole[]
  kpis Kpi[]
  risks Risk[]
  controls Control[]

  @@index([tenantId, directionId])
  @@schema("process_discovery")
}

model ProcessActorRole {
  id         String @id @default(uuid()) @db.Uuid
  tenantId   String @map("tenant_id") @db.Uuid
  processId  String @map("process_id") @db.Uuid
  activityId String? @map("activity_id") @db.Uuid
  actorId    String @map("actor_id") @db.Uuid
  raciRole   String @map("raci_role")
  notes      String?

  process  Process @relation(fields: [processId], references: [id], onDelete: Cascade)
  activity ProcessActivity? @relation(fields: [activityId], references: [id], onDelete: Cascade)
  actor    Actor   @relation(fields: [actorId], references: [id], onDelete: Restrict)

  @@unique([processId, activityId, actorId, raciRole])
  @@index([tenantId, processId, activityId, actorId])
  @@schema("process_discovery")
}

model Application {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  name      String
  code      String?
  owner     String?
  criticality String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  processes ProcessApplication[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@schema("process_discovery")
}

model ProcessApplication {
  id            String @id @default(uuid()) @db.Uuid
  tenantId      String @map("tenant_id") @db.Uuid
  processId     String @map("process_id") @db.Uuid
  applicationId String @map("application_id") @db.Uuid
  usage         String?

  process     Process     @relation(fields: [processId], references: [id], onDelete: Cascade)
  application Application @relation(fields: [applicationId], references: [id], onDelete: Restrict)

  @@unique([processId, applicationId])
  @@index([tenantId, processId])
  @@schema("process_discovery")
}

model Document {
  id               String         @id @default(uuid()) @db.Uuid
  tenantId          String         @map("tenant_id") @db.Uuid
  reference         String?
  title             String
  documentType      String?        @map("document_type")
  status            DocumentStatus @default(draft)
  version           String?
  ownerActorId      String?        @map("owner_actor_id") @db.Uuid
  approverActorId   String?        @map("approver_actor_id") @db.Uuid
  approvedAt        DateTime?      @map("approved_at")
  effectiveDate     DateTime?      @map("effective_date")
  nextReviewDate    DateTime?      @map("next_review_date")
  confidentiality   String?
  replacedDocumentId String?       @map("replaced_document_id") @db.Uuid
  createdAt         DateTime       @default(now()) @map("created_at")
  updatedAt         DateTime       @updatedAt @map("updated_at")
  deletedAt         DateTime?      @map("deleted_at")

  processes ProcessDocument[]

  @@unique([tenantId, reference, version])
  @@index([tenantId, status])
  @@schema("process_discovery")
}

model ProcessDocument {
  id         String @id @default(uuid()) @db.Uuid
  tenantId   String @map("tenant_id") @db.Uuid
  processId  String @map("process_id") @db.Uuid
  documentId String @map("document_id") @db.Uuid
  usageType  String? @map("usage_type")

  process  Process  @relation(fields: [processId], references: [id], onDelete: Cascade)
  document Document @relation(fields: [documentId], references: [id], onDelete: Restrict)

  @@unique([processId, documentId, usageType])
  @@index([tenantId, processId])
  @@schema("process_discovery")
}

model Kpi {
  id              String    @id @default(uuid()) @db.Uuid
  tenantId        String    @map("tenant_id") @db.Uuid
  processId       String    @map("process_id") @db.Uuid
  ownerActorId    String?   @map("owner_actor_id") @db.Uuid
  name            String
  objective       String?
  definition      String?
  formula         String?
  unit            String?
  source          String?
  frequency       String?
  target          String?
  alertThreshold  String?   @map("alert_threshold")
  collectionMethod String?  @map("collection_method")
  status          KpiStatus @default(draft)
  evidence        Json?
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Cascade)
  owner   Actor?  @relation(fields: [ownerActorId], references: [id], onDelete: SetNull)

  @@index([tenantId, processId, status])
  @@schema("process_discovery")
}

model Risk {
  id            String     @id @default(uuid()) @db.Uuid
  tenantId      String     @map("tenant_id") @db.Uuid
  processId     String     @map("process_id") @db.Uuid
  ownerActorId  String?    @map("owner_actor_id") @db.Uuid
  category      String?
  description   String
  cause         String?
  consequence   String?
  probability   Int?
  impact        Int?
  inherentScore Decimal?   @map("inherent_score")
  residualScore Decimal?   @map("residual_score")
  treatmentPlan String?    @map("treatment_plan")
  dueDate       DateTime?  @map("due_date")
  status        RiskStatus @default(identified)
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")
  deletedAt     DateTime?  @map("deleted_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Cascade)
  owner   Actor?  @relation(fields: [ownerActorId], references: [id], onDelete: SetNull)
  controls RiskControl[]

  @@index([tenantId, processId, status])
  @@schema("process_discovery")
}

model Control {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  ownerActorId String?  @map("owner_actor_id") @db.Uuid
  name         String
  description  String?
  controlType  String?  @map("control_type")
  frequency    String?
  evidence     Json?
  status       String   @default("active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  owner Actor? @relation(fields: [ownerActorId], references: [id], onDelete: SetNull)
  risks RiskControl[]

  @@index([tenantId, status])
  @@schema("process_discovery")
}

model RiskControl {
  id        String @id @default(uuid()) @db.Uuid
  tenantId  String @map("tenant_id") @db.Uuid
  riskId    String @map("risk_id") @db.Uuid
  controlId String @map("control_id") @db.Uuid
  coverage  String?

  risk    Risk    @relation(fields: [riskId], references: [id], onDelete: Cascade)
  control Control @relation(fields: [controlId], references: [id], onDelete: Restrict)

  @@unique([riskId, controlId])
  @@index([tenantId, riskId])
  @@schema("process_discovery")
}

model PainPoint {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  processId   String   @map("process_id") @db.Uuid
  description String
  frequency   String?
  impact      String?
  priority    String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Cascade)

  @@index([tenantId, processId])
  @@schema("process_discovery")
}

model AutomationNeed {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @map("tenant_id") @db.Uuid
  processId      String   @map("process_id") @db.Uuid
  activityId     String?  @map("activity_id") @db.Uuid
  description    String
  expectedGain   String?  @map("expected_gain")
  complexity     String?
  priority       String?
  status         String   @default("identified")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Cascade)

  @@index([tenantId, processId, status])
  @@schema("process_discovery")
}

model CompletenessAssessment {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @map("tenant_id") @db.Uuid
  processId      String   @map("process_id") @db.Uuid
  ruleVersion    String   @map("rule_version")
  globalScore    Decimal  @map("global_score")
  sectionScores  Json     @map("section_scores")
  missingFields  Json?    @map("missing_fields")
  blockingIssues Json?    @map("blocking_issues")
  warnings       Json?
  assessedAt     DateTime @default(now()) @map("assessed_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Cascade)

  @@index([tenantId, processId, assessedAt])
  @@schema("process_discovery")
}

model ProcessSnapshot {
  id           String       @id @default(uuid()) @db.Uuid
  tenantId     String       @map("tenant_id") @db.Uuid
  processId    String       @map("process_id") @db.Uuid
  snapshotType SnapshotType @map("snapshot_type")
  payload      Json
  snapshotHash String       @map("snapshot_hash")
  createdBy    String?      @map("created_by") @db.Uuid
  createdAt    DateTime     @default(now()) @map("created_at")

  process Process @relation(fields: [processId], references: [id], onDelete: Restrict)
  versions ProcessVersion[]
  validations ProcessValidation[]

  @@index([tenantId, processId, snapshotType, createdAt])
  @@unique([tenantId, snapshotHash])
  @@schema("process_discovery")
}

model ProcessVersion {
  id                    String    @id @default(uuid()) @db.Uuid
  tenantId              String    @map("tenant_id") @db.Uuid
  processId             String    @map("process_id") @db.Uuid
  snapshotId            String    @map("snapshot_id") @db.Uuid
  versionNumber         Int       @map("version_number")
  parentVersionId       String?   @map("parent_version_id") @db.Uuid
  sourceVersionId       String?   @map("source_version_id") @db.Uuid
  effectiveDate         DateTime? @map("effective_date")
  supersededAt          DateTime? @map("superseded_at")
  supersededByVersionId String?   @map("superseded_by_version_id") @db.Uuid
  snapshotHash          String    @map("snapshot_hash")
  publicationReason     String?   @map("publication_reason")
  publishedBy           String?   @map("published_by") @db.Uuid
  publishedAt           DateTime? @map("published_at")
  createdAt             DateTime  @default(now()) @map("created_at")

  process  Process         @relation(fields: [processId], references: [id], onDelete: Restrict)
  snapshot ProcessSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Restrict)

  @@unique([tenantId, processId, versionNumber])
  @@index([tenantId, processId, publishedAt])
  @@schema("process_discovery")
}

model ProcessValidation {
  id            String             @id @default(uuid()) @db.Uuid
  tenantId      String             @map("tenant_id") @db.Uuid
  processId     String             @map("process_id") @db.Uuid
  snapshotId    String?            @map("snapshot_id") @db.Uuid
  decision      ValidationDecision
  fromStatus    ProcessStatus?     @map("from_status")
  toStatus      ProcessStatus?     @map("to_status")
  comment       String?
  decidedBy     String?            @map("decided_by") @db.Uuid
  decidedRole   String?            @map("decided_role")
  createdAt     DateTime           @default(now()) @map("created_at")

  process  Process @relation(fields: [processId], references: [id], onDelete: Restrict)
  snapshot ProcessSnapshot? @relation(fields: [snapshotId], references: [id], onDelete: SetNull)

  @@index([tenantId, processId, createdAt])
  @@schema("process_discovery")
}

model Comment {
  id           String        @id @default(uuid()) @db.Uuid
  tenantId     String        @map("tenant_id") @db.Uuid
  processId    String?       @map("process_id") @db.Uuid
  parentId     String?       @map("parent_id") @db.Uuid
  resourceType String?       @map("resource_type")
  resourceId   String?       @map("resource_id") @db.Uuid
  body         String
  status       CommentStatus @default(open)
  createdBy    String?       @map("created_by") @db.Uuid
  resolvedBy   String?       @map("resolved_by") @db.Uuid
  resolvedAt   DateTime?     @map("resolved_at")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  deletedAt    DateTime?     @map("deleted_at")

  process Process? @relation(fields: [processId], references: [id], onDelete: Cascade)

  @@index([tenantId, processId, status])
  @@index([tenantId, resourceType, resourceId])
  @@schema("process_discovery")
}

model Attachment {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  processId       String?  @map("process_id") @db.Uuid
  storageProvider String   @map("storage_provider")
  bucket          String
  objectKey       String   @map("object_key")
  filename        String
  mimeType        String   @map("mime_type")
  size            BigInt
  checksum        String?
  classification  String?
  version         String?
  antivirusStatus String?  @map("antivirus_status")
  uploadedBy      String?  @map("uploaded_by") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  process Process? @relation(fields: [processId], references: [id], onDelete: SetNull)

  @@unique([tenantId, bucket, objectKey])
  @@index([tenantId, processId])
  @@schema("process_discovery")
}

model AiGeneration {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  provider    String
  purpose     String
  promptHash  String?  @map("prompt_hash")
  inputRef    Json?    @map("input_ref")
  output      Json?
  createdBy   String?  @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")

  suggestions AiSuggestion[]

  @@index([tenantId, purpose, createdAt])
  @@schema("process_discovery")
}

model AiSuggestion {
  id            String             @id @default(uuid()) @db.Uuid
  tenantId      String             @map("tenant_id") @db.Uuid
  processId     String?            @map("process_id") @db.Uuid
  generationId  String?            @map("generation_id") @db.Uuid
  suggestionType String            @map("suggestion_type")
  content       Json
  status        AiSuggestionStatus @default(proposed)
  decidedBy     String?            @map("decided_by") @db.Uuid
  decidedAt     DateTime?          @map("decided_at")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  process    Process?      @relation(fields: [processId], references: [id], onDelete: Cascade)
  generation AiGeneration? @relation(fields: [generationId], references: [id], onDelete: SetNull)

  @@index([tenantId, processId, status])
  @@schema("process_discovery")
}

model Notification {
  id          String             @id @default(uuid()) @db.Uuid
  tenantId    String?            @map("tenant_id") @db.Uuid
  userId      String             @map("user_id") @db.Uuid
  type        String
  title       String
  body        String?
  status      NotificationStatus @default(unread)
  metadata    Json?
  readAt      DateTime?          @map("read_at")
  createdAt   DateTime           @default(now()) @map("created_at")

  @@index([tenantId, userId, status])
  @@schema("process_discovery")
}

model NotificationPreference {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String?  @map("tenant_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  channel   String
  type      String
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([tenantId, userId, channel, type])
  @@schema("process_discovery")
}

model AuditLog {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String?  @map("tenant_id") @db.Uuid
  actorUserId   String?  @map("actor_user_id") @db.Uuid
  supportGrantId String? @map("support_grant_id") @db.Uuid
  action        String
  resourceType  String   @map("resource_type")
  resourceId    String?  @map("resource_id") @db.Uuid
  oldValue      Json?    @map("old_value")
  newValue      Json?    @map("new_value")
  ipAddress     String?  @map("ip_address")
  userAgent     String?  @map("user_agent")
  correlationId String?  @map("correlation_id")
  result        String
  metadata      Json?
  createdAt     DateTime @default(now()) @map("created_at")

  actor User? @relation("AuditActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([tenantId, resourceType, resourceId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([correlationId])
  @@schema("process_discovery")
}

model ExportJob {
  id              String       @id @default(uuid()) @db.Uuid
  tenantId        String       @map("tenant_id") @db.Uuid
  processId       String?      @map("process_id") @db.Uuid
  requestedBy     String?      @map("requested_by") @db.Uuid
  exportType      String       @map("export_type")
  format          ExportFormat
  status          ExportStatus @default(queued)
  parameters      Json?
  storageProvider String?      @map("storage_provider")
  bucket          String?
  objectKey       String?      @map("object_key")
  errorMessage    String?      @map("error_message")
  createdAt       DateTime     @default(now()) @map("created_at")
  startedAt       DateTime?    @map("started_at")
  completedAt     DateTime?    @map("completed_at")
  expiresAt       DateTime?    @map("expires_at")

  process Process? @relation(fields: [processId], references: [id], onDelete: SetNull)

  @@index([tenantId, status, createdAt])
  @@index([tenantId, processId])
  @@schema("process_discovery")
}
```

## 24. Architecture Frontend Actualisée

Monorepo validé:

- `apps/web`: React, Vite, TypeScript strict, Tailwind, React Router;
- `apps/api`: NestJS, Prisma;
- `packages/ui`: composants accessibles;
- `packages/types`: contrats partagés;
- `packages/config`: tsconfig, eslint, tailwind;
- `packages/domain`: règles déterministes pures si utile.

Frontend:

- React Hook Form + Zod;
- TanStack Query/Table;
- Recharts;
- dnd-kit;
- bpmn-js en mode contrôlé;
- design system sobre institutionnel;
- i18n préparé.

## 25. Architecture Backend Actualisée

Modules NestJS:

- Auth;
- IdentityProviders;
- Tenants;
- Memberships/RBAC;
- SupportAccess;
- Templates;
- Campaigns;
- Directions;
- Processes;
- Completeness;
- BPMN;
- RACI;
- Quality;
- Documents/Storage;
- Validations;
- Versions/Snapshots;
- AI;
- Exports;
- Notifications;
- Audit.

Cross-cutting:

- `TenantGuard`;
- `MembershipGuard`;
- `PoliciesGuard`;
- `SupportAccessGuard`;
- `AuditInterceptor`;
- `PrismaTenantRepository`;
- `OptimisticLockInterceptor` ou logique service;
- logs structurés;
- erreurs normalisées.

## 26. Critères D'Acceptation Corrigés

Critères transverses:

- aucune donnée métier lue hors tenant;
- super_admin sans support grant ne lit pas le détail métier;
- support grant limité, expiré et audité;
- exports obligatoires disponibles selon lot;
- version publiée immuable;
- snapshot soumis figé;
- validator ne modifie pas le contenu soumis;
- consultant limité à son scope;
- template appliqué figé;
- aucun secret en code ou logs;
- migrations non destructives.

## 27. Plan De Développement Actualisé

### Lot 0 - Validation v0.2

Valider décisions ouvertes, Prisma cible, lots et périmètre MVP.

### Lot 1 - Socle Monorepo, Auth Et Identités

Monorepo, NestJS, React, Prisma, users globaux, memberships, sessions, refresh rotation, invitations, reset password, `.env.example`.

### Lot 2 - Multi-Tenant, RBAC Et Support Encadré

Tenants, rôles, permissions, policies, support_access_grants, tests isolation tenant, audit minimal.

### Lot 3 - Templates Versionnés Et MAP

Templates, template versions, règles configurables, seed MAP, application figée au tenant.

### Lot 4 - Campagnes, Directions Et Scopes Consultants

Campagnes, directions, affectations référents, consultant assignments, dashboards de suivi.

### Lot 5 - Assistant Processus Et Score Backend

Wizard configurable, données structurées, autosave, optimistic locking, score déterministe, blocages.

### Lot 6 - Snapshots, Validation Et Immuabilité

Workflow corrigé, snapshots soumis/approuvés, versions publiées immuables, publication.

### Lot 7 - Atelier BPMN/RACI/KPI/Risques

BPMN contrôlé, RACI déterministe, KPI déclaratifs, risques, contrôles, qualité.

### Lot 8 - Exports Obligatoires Et Documents

PDF, DOCX, XLSX, JSON, BPMN XML, stockage S3/MinIO/local, audit téléchargement.

### Lot 9 - Copilote IA Encadré

Suggestions IA avec statuts, audit, aucune modification directe des données officielles.

### Lot 10 - Durcissement Production Et RLS Préparée

Performance, sécurité, tests e2e, revue RLS, sauvegarde/restauration, documentation de déploiement.

## 28. Décisions Encore Ouvertes

- Mode exact du premier déploiement MAP: SaaS, dédié, souverain ou on-premise.
- Exigences de résidence et souveraineté des données.
- Besoin SSO dès post-MVP ou plus tard.
- Provider email cible.
- Antivirus obligatoire ou optionnel au MVP.
- Durées de rétention par type de données.
- Niveau de détail des exports DOCX/PDF attendus par la MAP.
- Qui peut autoriser un support grant côté tenant.
- Règles de confidentialité documentaire initiales.
- Activation future de RLS après preuve technique.

## 29. Arrêt Pour Validation

Cette version 0.2 est un livrable de conception. Aucun développement applicatif complet ne doit démarrer avant validation explicite.

