# PROCESS DISCOVERY ASSISTANT - Dossier de conception

Version: 0.1  
Date: 2026-06-12  
Statut: à valider avant développement

## 1. Synthèse du besoin

Process Discovery Assistant est un module SaaS B2B multi-tenant opéré par HiGroup. Il permet aux organisations clientes de recenser, formaliser, valider, versionner et exporter leurs processus avec une traçabilité forte.

Le premier tenant cible est la MAP, mais le produit doit rester générique pour administrations, banques, ministères, entreprises publiques et grandes entreprises privées.

Objectifs clés:

- cartographier directions, processus, acteurs, activités, applications et documents;
- produire des livrables déterministes: workflow, BPMN, RACI, procédures, KPI, risques, contrôles, backlog;
- faciliter l'alignement ISO 9001 sans prétendre certifier automatiquement le client;
- assurer isolation tenant, RBAC backend, audit, versioning et preuve de validation;
- utiliser l'IA uniquement comme copilote non souverain.

Règle fondamentale: les données officielles proviennent uniquement des saisies, validations et décisions humaines. L'IA ne modifie jamais directement un référentiel officiel.

## 2. Hypothèses

- HYPOTHÈSE À VALIDER: le premier déploiement sera un SaaS hébergé par HiGroup, et non une installation on-premise chez la MAP.
- HYPOTHÈSE À VALIDER: l'authentification initiale utilisera email/mot de passe avec JWT access/refresh, puis SSO/SAML/OIDC pourra être ajouté par tenant.
- HYPOTHÈSE À VALIDER: le stockage documentaire utilisera un service compatible S3 ou équivalent, référencé par URL/clé d'objet, sans stocker les binaires en PostgreSQL.
- HYPOTHÈSE À VALIDER: la langue initiale de l'interface est le français; l'i18n sera prévu mais pas forcément livré au lot 1.
- HYPOTHÈSE À VALIDER: les exports prioritaires sont Excel, PDF, BPMN XML et ZIP documentaire.
- HYPOTHÈSE À VALIDER: l'édition BPMN humaine est contrôlée: l'utilisateur corrige les données structurées ou des métadonnées validées, pas un diagramme libre désynchronisé.
- HYPOTHÈSE À VALIDER: les utilisateurs peuvent appartenir à plusieurs directions dans un même tenant, avec une direction principale optionnelle.
- HYPOTHÈSE À VALIDER: une campagne correspond à une période structurée de collecte et validation de processus.

## 3. Questions et ambiguïtés

1. La MAP exige-t-elle un hébergement au Maroc, un cloud souverain ou des contraintes de résidence des données?
2. Faut-il intégrer un annuaire existant pour la MAP dès le MVP?
3. Quels formats documentaires officiels sont attendus pour les procédures qualité?
4. Qui est propriétaire final d'un processus: direction, référent, validateur, comité qualité ou tenant admin?
5. Le workflow de validation doit-il être identique pour tous les tenants ou paramétrable par template?
6. Quel niveau d'audit est consultable par le tenant et quel niveau reste réservé à HiGroup?
7. Les consultants sont-ils internes HiGroup, externes au client, ou les deux?
8. Le module doit-il gérer les non-conformités et actions correctives dès le MVP ou seulement les référencer?
9. Les KPI doivent-ils être déclaratifs seulement ou connectés à des sources de données opérationnelles?
10. Quelles règles juridiques s'appliquent à la conservation des versions et audits?

## 4. Architecture fonctionnelle

Domaines fonctionnels:

- Administration SaaS HiGroup: tenants, abonnements, fonctionnalités, campagnes, supervision, audit autorisé.
- Administration tenant: paramètres, utilisateurs, rôles, directions, templates appliqués, nomenclatures.
- Campagnes: périmètre, directions concernées, référents, échéances, suivi d'avancement.
- Référentiel organisationnel: directions, acteurs, applications, documents, nomenclatures.
- Formalisation processus: assistant en 11 étapes, autosave, score de complétude, commentaires, pièces jointes.
- Atelier processus: vue consolidée, BPMN, RACI, workflow, KPI, risques, contrôles, IA, procédure, backlog, versions, audit.
- Validation et publication: machine à états, preuves, snapshots, versions, verrouillage.
- Exports: PDF, Excel, BPMN XML, dossiers ZIP, historique des exports.
- Copilote IA: suggestions, détection d'incohérences, brouillons, backlog, jamais source officielle.
- Audit et conformité: logs, traçabilité, versioning, preuves de validation.

## 5. Arborescence de navigation

Navigation Super Admin HiGroup:

- Dashboard SaaS
- Clients / Tenants
- Campagnes
- Templates
- Abonnements
- Fonctionnalités
- Utilisateurs HiGroup
- Audit SaaS
- Paramètres plateforme

Navigation Tenant:

- Dashboard tenant
- Campagnes
- Directions
- Processus
- Atelier de formalisation
- Référentiels: acteurs, applications, documents, risques, KPI
- Validations
- Exports
- Notifications
- Audit tenant
- Paramètres tenant

Navigation processus:

- Assistant de formalisation
- Atelier
- Versions
- Commentaires
- Audit
- Exports

## 6. Parcours par rôle

### Super Admin HiGroup

Point d'entrée: dashboard SaaS.  
Actions: créer/suspendre/réactiver tenant, créer premier admin, appliquer template, créer campagnes, activer fonctionnalités, suivre métriques globales, gérer abonnements, consulter audit autorisé.  
Restrictions: ne modifie pas les données métier officielles d'un tenant sauf action d'administration explicitement auditée.  
Notifications: incidents sécurité, inactivité tenant, abonnement, campagne en retard.  
Cycle: onboarding tenant -> configuration -> supervision -> support -> renouvellement/suspension.  
Exports: rapports SaaS consolidés non sensibles ou anonymisés selon droit.

### Tenant Admin

Point d'entrée: dashboard tenant.  
Actions: gérer utilisateurs, directions, campagnes internes, référents, nomenclatures, paramètres, exports tenant.  
Restrictions: accès limité à son tenant; pas de gestion des autres clients ni paramètres plateforme.  
Notifications: processus bloqués, validations en attente, référents inactifs, campagnes en retard.  
Cycle: préparer campagne -> affecter référents -> suivre complétude -> organiser validation -> publier exports.

### Référent de direction

Point d'entrée: vue direction ou liste des processus assignés.  
Actions: créer/mettre à jour processus de sa direction, renseigner assistant, commenter, joindre documents, soumettre.  
Restrictions: modification limitée aux processus de ses directions et aux statuts éditables.  
Notifications: brouillons incomplets, demandes de correction, échéances, commentaires.  
Cycle: recenser -> formaliser -> corriger -> resoumettre -> consulter version publiée.

### Consultant

Point d'entrée: campagne ou direction assignée.  
Actions: accompagner la saisie, commenter, proposer structuration, préparer revues, consulter IA, préparer livrables brouillons.  
Restrictions: ne valide pas officiellement sauf permission spécifique; ne contourne pas le tenant.  
Notifications: activités à revoir, incohérences, ateliers planifiés.  
Cycle: diagnostic -> accompagnement -> revue qualité -> consolidation.

### Validateur

Point d'entrée: file de validations.  
Actions: examiner processus, demander correction, approuver, publier si habilité, consulter snapshots, historique et commentaires.  
Restrictions: ne modifie pas librement les contenus soumis; passe par commentaire ou retour correction.  
Notifications: soumission, resoumission, échéance validation.  
Cycle: revue -> décision -> preuve -> publication ou correction.

### Readonly

Point d'entrée: tableau de consultation.  
Actions: consulter processus publiés, exports autorisés, versions et commentaires visibles.  
Restrictions: aucune modification, aucune validation, aucun accès à l'audit sensible.  
Notifications: publication de nouveaux livrables si abonné.

## 7. Cinq écrans principaux

### Écran 1 - Dashboard SaaS HiGroup

Objectif: piloter l'activité multi-client, la santé des campagnes et les alertes.  
Widgets: clients, actifs, suspendus, campagnes en cours, processus recensés, utilisateurs actifs, abonnements, complétude globale, alertes, activités récentes.  
Filtres: tenant, période, statut abonnement, statut campagne.  
Composants: KPI cards, courbe d'évolution, table tenants à attention, liste campagnes, centre alertes, actions rapides.  
États: chargement skeleton, vide premier tenant, erreur permission, données partielles.  
Actions: ouvrir tenant, créer tenant, suspendre/réactiver, créer campagne, consulter audit autorisé.  
Règles: métriques agrégées; pas d'exposition inter-tenant de données métier détaillées.  
Export: rapport SaaS CSV/PDF selon permission.

### Écran 2 - Dashboard Tenant / MAP

Objectif: visualiser l'avancement qualité et processus du tenant.  
Widgets: directions, processus identifiés, brouillons, soumis, à corriger, validés, score moyen, validations en attente, risques critiques, automatisations.  
Graphiques: avancement par direction, statuts, catégories management/métier/support, complétude, risques par criticité, maturité.  
Composants: filtres campagne/direction/période, graphiques Recharts, table actions prioritaires.  
Actions: ouvrir direction, relancer référent, ouvrir validation, exporter synthèse.  
Règles: données filtrées par tenant_id et par périmètre de rôle.  
Export: synthèse tenant, synthèse direction, rapport DG.

### Écran 3 - Liste des directions

Objectif: suivre la progression par direction.  
Colonnes: direction, référent, nombre processus, validés, score moyen, progression campagne, validation, dernière activité, actions.  
Fonctions: recherche, filtres, tri, pagination, export, vue table, vue cartes, fiche direction, affectation référent, relance, historique.  
Composants: TanStack Table, badges statut, barre progression, drawer affectation, modal relance, timeline historique.  
États: aucune direction, aucun référent, retard campagne, direction suspendue.  
Règles: affectation référent par tenant_admin ou super_admin autorisé; historique obligatoire.  
Export: Excel/PDF directions.

### Écran 4 - Assistant de formalisation

Objectif: collecter les données structurées nécessaires aux livrables déterministes.

Étapes:

1. Identification: nom, code, direction, catégorie, propriétaire, criticité, statut. Champs obligatoires: nom, direction, propriétaire, catégorie. Zod: longueurs, UUID, unicité code par tenant.  
2. Description: objectif, périmètre, déclencheur, valeur produite, exclusions. Obligatoire: objectif, périmètre.  
3. Activités: liste ordonnée, nom, description, type, entrée, sortie, précédent/suivant, délai. Obligatoire: au moins une activité valide.  
4. Acteurs et responsabilités: acteurs, rôles RACI par activité. Obligatoire: Responsible et Accountable selon règles.  
5. Documents: documents entrants/sortants, type, version, obligatoire/non. Facultatif sauf si utilisé par activité.  
6. Applications: applications utilisées, étape concernée, criticité. Facultatif mais recommandé si processus outillé.  
7. KPI: nom, définition, formule, cible, fréquence, propriétaire. Au moins un KPI recommandé; obligatoire si template l'exige.  
8. Risques et contrôles: risque, cause, impact, probabilité, criticité, contrôle, propriétaire. Obligatoire si risque critique détecté ou processus critique.  
9. Points de douleur: description, fréquence, impact, direction concernée. Facultatif.  
10. Besoins d'automatisation: opportunité, activité cible, gain attendu, complexité, priorité. Facultatif.  
11. Résumé et soumission: score, champs manquants, blocages, commentaires, confirmation soumission. Obligatoire: conditions de soumission.

Pour chaque étape:

- validation Zod côté frontend et DTO côté backend;
- aide contextuelle et exemples issus du template tenant;
- état vide actionnable;
- messages d'erreur explicites et accessibles;
- score section calculé déterministiquement;
- droits de modification selon statut et rôle;
- autosave par debounce, sauvegarde manuelle, reprise, conflits, dernier enregistrement;
- stockage en tables métier ou brouillon versionné.

Autosave:

- debounce recommandé: 800 à 1500 ms;
- indicateurs: "Enregistrement...", "Enregistré", "Erreur de sauvegarde", "Conflit détecté";
- optimistic locking par version;
- copie locale temporaire chiffrable côté navigateur si besoin;
- en cas de conflit: comparer version serveur, afficher différences, permettre fusion contrôlée.

### Écran 5 - Atelier de formalisation

Objectif: consolider, contrôler, enrichir, valider et exporter un processus.

Onglets:

- Vue d'ensemble: identité, statut, score, alertes, livrables disponibles, actions.
- BPMN: rendu bpmn-js depuis JSON interne/XML, validation graphe, export XML/PDF.
- RACI: matrice par activité/acteur, alertes, export Excel/PDF.
- Workflow: séquence structurée, transitions, gateways, anomalies.
- KPI: liste, cible, fréquence, propriétaire, statut validation.
- Risques et contrôles: registre, criticité, couverture contrôles.
- Contrôle Qualité: checklist ISO 9001, champs manquants, preuves.
- Copilote IA: suggestions avec statuts proposée/acceptée/rejetée/modifiée/validée.
- Procédure: brouillon générable, édition humaine, statut documentaire.
- Backlog: actions PMO/Qualité/Transformation, user stories, priorités.
- Versions: snapshots, diff, restauration contrôlée.
- Commentaires: fils par section, mentions, résolution.
- Audit: événements autorisés, filtres, export selon permission.

Règles communes: actions selon RBAC, audit des changements, export traçable, verrouillage en validation si nécessaire.

## 8. Design system

Positionnement: B2B premium, sobre, institutionnel, moderne.

Palette principale:

- Bleu nuit `#18283B`: navigation, en-têtes, texte fort.
- Bleu confiance `#2563EB`: actions primaires, liens.
- Vert validation `#15803D`: validé, succès.
- Ambre `#D97706`: attention, incomplet.
- Rouge `#B91C1C`: erreur, critique.
- Gris froid `#F3F6FA`, `#E5EAF1`, `#64748B`, `#0F172A`: fonds, bordures, texte.

Typographie: Inter ou équivalent; base 14-16 px; titres denses; pas de texte hero dans l'application opérationnelle.

Grille: layout desktop avec sidebar 264 px, header 64 px, contenu max fluide; 12 colonnes pour dashboards; tables pleine largeur.

Espacements: échelle 4/8/12/16/24/32.  
Radius: 6 à 8 px.  
Ombres: discrètes, réservées aux overlays/drawers.  
Boutons: primaire, secondaire, ghost, danger; icône lucide + libellé pour commandes critiques.  
Formulaires: labels visibles, aide contextuelle, erreur sous champ, focus visible.  
Tableaux: tri, filtres, densité confortable, colonnes figées si utile.  
Badges: statut, criticité, rôle, validation.  
Alertes: bandeaux contextualisés et centre notifications.  
Skeletons: dashboards, tables, formulaires.  
Empty states: message court + action.  
Tooltips: pour icônes et règles complexes.  
Accessibilité: navigation clavier, contraste AA, aria labels, erreurs reliées aux champs, couleur jamais seule.  
Responsive: desktop prioritaire, tablette fonctionnelle, mobile consultation; BPMN complet non prioritaire sur petit mobile.

## 9. États et composants réutilisables

Statuts processus: brouillon, incomplet, prêt à soumettre, soumis, en validation, à corriger, validé, archivé, suspendu.

Composants:

- `AppShell`, `Sidebar`, `Topbar`, `Breadcrumbs`
- `KpiCard`, `StatusBadge`, `CompletenessGauge`
- `DataTable`, `FilterBar`, `PaginationControls`
- `ProcessWizard`, `WizardStepNav`, `AutosaveIndicator`
- `RaciMatrix`, `BpmnViewer`, `WorkflowGraph`
- `AuditTimeline`, `VersionDiff`, `CommentThread`
- `AiSuggestionPanel`, `ValidationDecisionModal`
- `ExportDrawer`, `NotificationCenter`

## 10. Matrice RBAC

Légende: C créer, R lire, U modifier, D supprimer logique, V valider, X exporter, A administrer.

| Ressource | super_admin | tenant_admin | direction_referent | validator | consultant | readonly |
|---|---:|---:|---:|---:|---:|---:|
| Tenants | CRUD/A | - | - | - | - | - |
| Paramètres tenant | R/U/A | R/U/A | R | R | R | R |
| Utilisateurs | C/R/U/D | C/R/U/D tenant | R limité | R limité | R limité | R limité |
| Directions | C/R/U/D | C/R/U/D | R périmètre | R | R/U assisté | R |
| Campagnes | C/R/U/D | C/R/U/D | R | R | R/U assisté | R |
| Processus | R support | C/R/U/D tenant | C/R/U périmètre | R/V | C/R/U assisté | R publiés |
| Activités | R support | C/R/U | C/R/U périmètre | R | C/R/U assisté | R |
| Acteurs | R support | C/R/U/D | C/R/U périmètre | R | C/R/U assisté | R |
| Documents | R support | C/R/U/D | C/R/U périmètre | R | C/R/U assisté | R |
| Applications | R support | C/R/U/D | C/R/U périmètre | R | C/R/U assisté | R |
| KPI | R support | C/R/U | C/R/U périmètre | R/V | C/R/U assisté | R |
| Risques | R support | C/R/U | C/R/U périmètre | R/V | C/R/U assisté | R |
| Contrôles | R support | C/R/U | C/R/U périmètre | R/V | C/R/U assisté | R |
| Commentaires | R | C/R/U modéré | C/R/U propres | C/R/U propres | C/R/U propres | R autorisé |
| Validations | R | R/V si autorisé | Soumettre | V | R/commenter | R |
| Versions | R | R/X | R périmètre | R | R | R publiées |
| Exports | R/X SaaS | R/X tenant | X périmètre | X revue | X assisté | X publiés |
| Suggestions IA | R | C/R/U statut | C/R/U statut périmètre | R/V statut | C/R/U statut | R validées |
| Audit | R SaaS autorisé | R tenant | R limité | R validation | R limité | - |
| Notifications | C/R/U | C/R/U tenant | R/U propres | R/U propres | R/U propres | R/U propres |

Toutes les permissions sont vérifiées côté backend par guard RBAC, guard tenant et policy de ressource. Le frontend ne fait que masquer ou désactiver les actions non autorisées.

## 11. Workflow de validation

États: `draft`, `in_progress`, `ready_for_review`, `submitted`, `under_review`, `changes_requested`, `resubmitted`, `approved`, `published`, `archived`.

Transitions:

| De | Vers | Rôle | Conditions | Commentaire | Version |
|---|---|---|---|---|---|
| draft | in_progress | référent, consultant | premier contenu significatif | non | brouillon |
| in_progress | ready_for_review | référent | score >= 80 et aucun blocage | non | brouillon |
| ready_for_review | submitted | référent | confirmation humaine | oui optionnel | snapshot soumis |
| submitted | under_review | validator | prise en charge | non | inchangée |
| under_review | changes_requested | validator | corrections requises | oui obligatoire | snapshot décision |
| changes_requested | in_progress | référent | reprise correction | non | nouvelle révision |
| in_progress | resubmitted | référent | score >= 80 et blocages résolus | oui optionnel | snapshot resoumis |
| resubmitted | under_review | validator | prise en charge | non | inchangée |
| under_review | approved | validator | critères respectés | oui optionnel | snapshot approuvé |
| approved | published | tenant_admin ou validator habilité | publication confirmée | oui optionnel | version publiée |
| published | archived | tenant_admin | remplacement ou retrait | oui obligatoire | version archivée |

Chaque validation enregistre: utilisateur, rôle, date UTC, ancien statut, nouveau statut, commentaire, version, snapshot hash, correlation_id.

## 12. Règles de complétude

Score déterministe total 100:

- Identification: 10
- Objectif et périmètre: 12
- Entrées et sorties: 10
- Activités et séquence: 16
- Acteurs et responsabilités: 14
- Documents: 6
- Applications: 5
- KPI: 8
- Risques: 7
- Contrôles: 5
- Validation et preuves: 7

Justification: le coeur opérationnel repose sur séquence, responsabilités, objectif/périmètre et interfaces entrée/sortie; les documents, applications, KPI, risques et contrôles complètent l'alignement qualité.

Règle de soumission: score global >= 80, toutes les sections obligatoires sans blocage, aucune incohérence bloquante.

Blocages minimums:

- objectif absent;
- aucune activité;
- aucun propriétaire;
- aucune entrée ou sortie;
- aucune responsabilité;
- absence d'Accountable;
- activité sans Responsible;
- séquence invalide ou noeud orphelin;
- conflit d'édition non résolu;
- données requises par template absentes.

Le calcul stocke: score global, score par section, champs manquants, blocages, recommandations, version de règle de scoring.

## 13. Règles BPMN déterministes

Source officielle: activités, transitions, acteurs, événements, conditions et responsabilités validés.

Génération:

- start event depuis déclencheur ou première activité;
- end event après dernière activité ou sorties terminales;
- task par activité;
- sequence flow depuis ordre et transitions;
- gateway si condition avec branches oui/non ou plusieurs transitions conditionnelles;
- lane par acteur responsable ou direction selon option;
- participant par organisation/direction lorsque pertinent;
- labels depuis noms officiels;
- positions initiales calculées par rang, lane et profondeur.

Validations:

- un start et au moins un end;
- aucune activité orpheline;
- pas de transition vers activité inexistante;
- pas de boucle sans condition et justification;
- pas de branche conditionnelle sans libellé;
- pas de gateway sans sortie valide;
- XML BPMN conforme exportable.

Stockage: BPMN JSON interne, BPMN XML généré, version, hash source, date génération. L'IA ne détermine jamais la séquence officielle.

## 14. Règles RACI déterministes

Source: activités et affectations saisies.

Règles:

- chaque activité doit avoir au moins un Responsible;
- chaque activité doit avoir un Accountable pour soumission;
- alerte si plusieurs Accountable;
- Consulted et Informed facultatifs;
- alerte si un acteur cumule des rôles incompatibles définis par template;
- chaque modification RACI crée historique;
- validation humaine obligatoire avant publication;
- exports Excel et PDF.

## 15. Modèle conceptuel de données

Agrégats principaux:

- Tenant: settings, subscription, feature flags.
- Identity/RBAC: users, roles, permissions, user_roles, user_directions.
- Template: templates, template_directions, template_fields, règles, nomenclatures.
- Campaign: campaigns, campaign_directions, affectations et progression.
- Organization: directions, actors, applications, documents.
- Process: processes, inputs, outputs, activities, transitions, actor roles, applications, documents.
- Quality: KPI, risks, controls, risk_controls, pain_points, automation_needs.
- Governance: versions, validations, comments, attachments, notifications.
- AI: ai_generations, ai_suggestions avec statuts.
- Traceability: audit_logs, export_jobs.

Principes: UUID, tenant_id partout où métier, soft delete, created_by/updated_by, timestamps UTC, optimistic locking sur processus et sous-ressources sensibles.

## 16. Proposition de schéma Prisma

Extrait de structure cible, à détailler au lot technique:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["process_discovery"]
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
}

enum AiSuggestionStatus {
  proposed
  accepted
  rejected
  modified
  validated
}

model Tenant {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique
  status    String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users      User[]
  directions Direction[]
  processes  Process[]

  @@schema("process_discovery")
}

model User {
  id           String    @id @default(uuid()) @db.Uuid
  tenantId     String?   @map("tenant_id") @db.Uuid
  email        String
  passwordHash String?   @map("password_hash")
  fullName     String    @map("full_name")
  status       String
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  tenant Tenant? @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, email])
  @@index([tenantId, status])
  @@schema("process_discovery")
}

model Process {
  id             String        @id @default(uuid()) @db.Uuid
  tenantId       String        @map("tenant_id") @db.Uuid
  directionId    String        @map("direction_id") @db.Uuid
  campaignId     String?       @map("campaign_id") @db.Uuid
  name           String
  code           String?
  objective      String?
  scope          String?
  status         ProcessStatus @default(draft)
  completeness   Decimal       @default(0)
  lockVersion    Int           @default(1) @map("lock_version")
  createdBy      String?       @map("created_by") @db.Uuid
  updatedBy      String?       @map("updated_by") @db.Uuid
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")
  deletedAt      DateTime?     @map("deleted_at")

  tenant     Tenant    @relation(fields: [tenantId], references: [id])
  direction  Direction @relation(fields: [directionId], references: [id])
  activities ProcessActivity[]

  @@unique([tenantId, code])
  @@index([tenantId, status])
  @@index([tenantId, directionId, status])
  @@schema("process_discovery")
}
```

Les autres modèles suivront les entités listées: settings, subscriptions, roles, permissions, templates, template_fields, campaigns, inputs, outputs, transitions, actors, process_actor_roles, applications, documents, KPI, risks, controls, comments, attachments, AI, notifications, audit, exports.

## 17. Index PostgreSQL

Index systématiques recommandés:

- `(tenant_id, id)` sur tables métier.
- `(tenant_id, deleted_at)` pour filtrage soft delete.
- `(tenant_id, status)` sur processus, campagnes, validations, export_jobs.
- `(tenant_id, direction_id, status)` sur processes.
- `(tenant_id, process_id, order)` sur process_activities.
- `(tenant_id, process_id, from_activity_id, to_activity_id)` sur process_transitions.
- `(tenant_id, process_id, activity_id, actor_id)` sur process_actor_roles.
- `(tenant_id, resource_type, resource_id, created_at)` sur audit_logs.
- `(tenant_id, user_id, read_at)` sur notifications.
- index GIN trigram ou full-text sur noms/descriptions si recherche avancée validée.

Contraintes:

- unicité `tenant.slug`;
- unicité email par tenant;
- unicité code processus par tenant;
- unicité direction par tenant/template selon contexte;
- FK avec `ON DELETE RESTRICT` pour données validées, `SET NULL` pour créateurs supprimés, soft delete métier.

## 18. Architecture frontend

Stack recommandée: React, TypeScript strict, Vite, TailwindCSS, React Hook Form, Zod, TanStack Query/Table, Recharts, React Router, shadcn/ui ou composants accessibles équivalents, dnd-kit, bpmn-js.

Organisation:

- `apps/web/src/app`: routing, providers, layout.
- `apps/web/src/features`: tenants, campaigns, directions, processes, validations, exports, ai, audit.
- `apps/web/src/components`: composants partagés.
- `packages/ui`: design system commun.
- `packages/types`: DTO et types partagés générés ou synchronisés.
- `packages/config`: eslint, tsconfig, tailwind presets.

Patterns:

- API client typé;
- guards de route côté UI;
- formulaires RHF + Zod;
- autosave encapsulé dans hook `useAutosave`;
- invalidation TanStack Query par clé tenant/ressource;
- composants de table réutilisables;
- bpmn-js en visualisation contrôlée.

## 19. Architecture backend

Stack: NestJS, Prisma, PostgreSQL, JWT, RBAC, Swagger/OpenAPI, class-validator/Zod compatible, rate limiting, Helmet, CORS configuré, logs structurés, erreurs centralisées, audit.

Modules:

- AuthModule
- TenantsModule
- UsersModule
- RbacModule
- TemplatesModule
- DirectionsModule
- CampaignsModule
- ProcessesModule
- ActivitiesModule
- RaciModule
- BpmnModule
- QualityModule
- DocumentsModule
- ValidationsModule
- CommentsModule
- VersionsModule
- AiModule
- ExportsModule
- NotificationsModule
- AuditModule

Cross-cutting:

- `TenantGuard`: exige tenant_id contextualisé sauf super_admin plateforme.
- `PoliciesGuard`: vérifie action/ressource/périmètre.
- `AuditInterceptor`: journalise actions sensibles.
- `PrismaService`: filtre tenant explicite, transactions, pagination.
- `ExceptionFilter`: erreurs normalisées.

## 20. Contrats API

Base: `/api/v1`.

Règles communes:

- pagination: `page`, `pageSize`;
- tri: `sortBy`, `sortOrder`;
- recherche: `q`;
- filtres tenant toujours dérivés du contexte auth, jamais seulement du client;
- erreurs: `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`;
- audit sur création, modification, suppression logique, validation, export, IA.

Ressources:

- `/auth`: login, refresh, logout, me.
- `/tenants`: CRUD super_admin, suspend, reactivate, feature flags.
- `/subscriptions`: CRUD super_admin, status.
- `/users`: CRUD tenant, assign roles, suspend.
- `/roles`: list, assign, permissions.
- `/templates`: CRUD templates, apply to tenant.
- `/directions`: CRUD, assign referent, progress.
- `/campaigns`: CRUD, launch, close, progress.
- `/processes`: CRUD, submit, status, completeness, publish, archive.
- `/activities`: CRUD, reorder, duplicate, transitions.
- `/actors`: CRUD, assign to process/activity.
- `/raci`: get matrix, validate, export.
- `/applications`, `/documents`, `/kpis`, `/risks`, `/controls`: CRUD référentiels et liens processus.
- `/automation-needs`: CRUD, prioritize.
- `/validations`: queue, decide, history.
- `/comments`: threads, resolve, mention.
- `/versions`: list, snapshot, diff, restore controlled.
- `/notifications`: list, mark read, preferences.
- `/exports`: create job, status, download.
- `/ai`: generate suggestion, list suggestions, accept/reject/modify/validate.
- `/audit-logs`: list authorized logs.

DTO: définis par ressource avec validation stricte, champs read-only protégés, `lockVersion` requis pour mises à jour sensibles.

## 21. Stratégie multi-tenant

Choix recommandé: schéma PostgreSQL unique `process_discovery` avec colonne `tenant_id` sur toutes les tables métier, guards backend systématiques, policies d'autorisation et tests d'isolation. Ajouter Row-Level Security PostgreSQL pour les tables métier critiques lorsque le contexte de session DB peut être fixé de manière fiable.

Pourquoi:

- plus simple à opérer qu'un schéma par tenant pour un SaaS multi-client;
- index composites `tenant_id` efficaces;
- migrations plus simples;
- isolement applicatif robuste si guards, policies et tests sont stricts;
- RLS apporte une défense en profondeur.

Obligatoire:

- jamais accepter un `tenant_id` client comme source de vérité si l'utilisateur n'est pas super_admin;
- toutes les requêtes métier filtrées par tenant;
- tests automatisés prouvant qu'un utilisateur tenant A ne lit/modifie jamais tenant B;
- audit des accès sensibles.

## 22. Stratégie de sécurité

- JWT access court + refresh token rotatif.
- Hash mot de passe Argon2 ou bcrypt fort.
- RBAC et policies backend.
- Rate limiting login et endpoints sensibles.
- Helmet, CORS restrictif par environnement.
- Secrets en variables d'environnement uniquement.
- Pas de logs de secrets, mots de passe, tokens.
- Validation DTO stricte.
- Protection CSRF si cookies utilisés.
- Chiffrement TLS obligatoire en production.
- Uploads scannés et limités par type/taille.
- Audit des changements de rôles, exports, IA, validations.
- Principe du moindre privilège pour comptes DB et stockage.

## 23. Stratégie d'audit

Événements minimums: connexion, déconnexion, échec connexion, création, consultation sensible, modification, suppression logique, restauration, soumission, correction, validation, publication, export, changement de rôle, changement de tenant, usage IA, acceptation/rejet IA.

Champs:

- tenant_id;
- user_id;
- action;
- resource_type;
- resource_id;
- old_value utile;
- new_value utile;
- ip;
- user_agent;
- date UTC;
- correlation_id;
- result;
- metadata.

Règles: pas de secret; masquage des champs sensibles; conservation configurable; export audit réservé.

## 24. Stratégie de tests

Backend:

- unit tests services et règles métier;
- tests DTO validation;
- integration tests API;
- tests d'isolation tenant;
- tests RBAC;
- tests workflow validation;
- tests scoring;
- tests BPMN/RACI déterministes;
- tests audit.

Frontend:

- unit tests hooks critiques;
- tests composants formulaires;
- tests navigation/rôles;
- tests autosave et conflits;
- tests accessibilité de base;
- tests e2e Playwright sur parcours clés.

Base:

- migrations non destructives en environnement local/staging;
- seed template MAP;
- tests contraintes et index essentiels.

## 25. Plan de migrations non destructives

1. Créer schéma `process_discovery` si absent.
2. Créer enums et tables nouvelles uniquement.
3. Ajouter contraintes FK en mode compatible.
4. Ajouter index tenant-first.
5. Insérer rôles, permissions et template MAP par seed idempotent.
6. Activer RLS après validation des policies si retenu.
7. Ne jamais exécuter `DROP DATABASE`.
8. Ne jamais supprimer tables externes existantes.
9. Toute migration destructive nécessite confirmation explicite, sauvegarde et plan rollback.

## 26. Plan de développement par lots

### Lot 0 - Validation conception

Livrables: dossier validé, décisions ouvertes arbitrées, backlog priorisé.  
Critères: validations métier/technique/UX obtenues.

### Lot 1 - Socle monorepo et sécurité

Livrables: monorepo, API NestJS, web React, Prisma, auth, RBAC minimal, `.env.example`, CI, lint/test.  
Critères: login, me, guards, tests RBAC de base.

### Lot 2 - Multi-tenant et administration

Livrables: tenants, users, roles, settings, subscriptions, audit initial.  
Critères: isolation tenant testée, création tenant MAP possible.

### Lot 3 - Templates et MAP

Livrables: système templates, seed MAP directions, champs questionnaire, règles complétude.  
Critères: application template à un tenant sans hardcode MAP.

### Lot 4 - Campagnes et directions

Livrables: campagnes, directions, référents, dashboard tenant, liste directions.  
Critères: suivi progression par direction, relance, exports simples.

### Lot 5 - Assistant processus

Livrables: wizard 11 étapes, autosave, validation Zod/DTO, score.  
Critères: création/reprise/soumission impossible sous conditions non respectées.

### Lot 6 - Atelier déterministe

Livrables: BPMN, RACI, workflow, KPI, risques, contrôles, versions.  
Critères: BPMN/RACI générés depuis données structurées, tests déterministes.

### Lot 7 - Validation, publication et exports

Livrables: machine à états, snapshots, PDF/Excel/XML, audit complet.  
Critères: preuves de validation et exports traçables.

### Lot 8 - Copilote IA encadré

Livrables: génération suggestions, statuts, acceptation/rejet/modification, audit IA.  
Critères: aucune suggestion ne modifie directement les données officielles.

### Lot 9 - Durcissement production

Livrables: performance, sécurité, accessibilité, supervision, sauvegardes, documentation.  
Critères: tests e2e, audit sécurité, readiness production.

## 27. Critères d'acceptation par lot

Chaque lot doit avoir:

- démonstration fonctionnelle;
- tests automatisés pertinents;
- contrôle RBAC backend;
- audit des actions sensibles;
- absence de secrets dans le code;
- documentation courte;
- validation utilisateur avant lot suivant.

## 28. Risques techniques

- Complexité du modèle de permissions multi-rôles et multi-directions.
- Désynchronisation entre données structurées et BPMN si édition libre trop permissive.
- Performance des dashboards sur gros volumes si index insuffisants.
- Mauvaise compréhension du rôle IA par les utilisateurs.
- RLS mal configuré pouvant bloquer l'application ou donner une fausse sécurité.
- Exports PDF complexes et coûteux à maintenir.
- Autosave conflictuel en collaboration multi-utilisateur.
- Dérive du template MAP vers du hardcode non générique.

## 29. Décisions à faire valider avant développement

1. Mode d'hébergement et exigences de résidence des données.
2. Authentification initiale et besoin SSO.
3. Niveau exact de Row-Level Security PostgreSQL.
4. Workflow de validation standard ou paramétrable.
5. Périmètre MVP des exports.
6. Niveau de correction humaine autorisé dans BPMN.
7. Statut des consultants et portée de leurs permissions.
8. Formats officiels des procédures qualité.
9. Conservation légale des audits et versions.
10. Périmètre du lot IA.
11. Confirmation de la structure monorepo.
12. Confirmation du template MAP initial.

## Annexe A - Template MAP initial

Directions:

1. Secrétariat Général
2. Communication
3. Conseil de la Direction Générale
4. Trésorerie / Paierie
5. Recherche
6. Production de l'Information : Dépêche et Médias
7. Gestion de la Documentation
8. MAP Intelligence
9. Marketing et Commercial
10. Gestion Financière
11. Moyens Généraux
12. Ressources Humaines
13. Systèmes de Production / DSI / Broadcast

Le template MAP doit être une donnée de configuration idempotente, jamais une règle codée en dur.

## Annexe B - Alignement ISO 9001

| Fonction | Objectif | Donnée collectée | Preuve | Rôle | Statut | Historique |
|---|---|---|---|---|---|---|
| Processus | Approche processus | objectif, périmètre, entrées, sorties | version publiée | référent/validateur | draft à published | versions/audit |
| Responsabilités | Rôles et responsabilités | RACI, propriétaires | matrice validée | référent/validateur | validé | diff RACI |
| Documents | Information documentée | documents, versions, liens | pièce jointe/référence | référent/admin | validé | audit document |
| Risques | Approche risques | risque, probabilité, impact | registre risque | référent/validateur | accepté/validé | historique |
| Contrôles | Maîtrise opérationnelle | contrôle, fréquence, propriétaire | contrôle lié | référent/validateur | validé | historique |
| KPI | Surveillance et mesure | indicateur, cible, fréquence | fiche KPI | référent/validateur | validé | versions |
| Validations | Preuve de validation | décision, commentaire, snapshot | validation signée applicative | validateur | approuvé/publié | audit |
| Amélioration | Opportunités | pain points, automation needs, backlog | backlog | consultant/admin | priorisé | historique |

La plateforme facilite l'alignement, la documentation, la traçabilité et la préparation d'un système de management de la qualité. Elle ne certifie pas automatiquement ISO 9001.

