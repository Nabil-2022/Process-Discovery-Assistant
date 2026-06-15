# Lot 12 - Test manuel Copilote IA

## Preconditions

- Tenant actif avec la feature `ai_copilot` activee.
- Utilisateur connecte avec `manage_ai_suggestions` pour generer/modifier/accepter/rejeter.
- Validateur avec `review_process` ou `validate_process` pour valider une suggestion.
- Processus brouillon ou en correction pour tester les actions d'application.

## Parcours Atelier

1. Ouvrir `/tenant/processes/{processId}/workshop`.
2. Ouvrir l'onglet `Copilote IA`.
3. Verifier les trois messages:
   - `L'IA est un copilote, pas une source officielle.`
   - `Toute suggestion doit etre validee humainement.`
   - `Aucune suggestion n'est appliquee automatiquement.`
4. Choisir un type de generation puis cliquer `Generer`.
5. Verifier l'historique: type, provider, date.
6. Verifier les suggestions: statut, contenu, actions humaines.
7. Tester `Accepter`, `Modifier`, `Rejeter`, puis `Valider` avec un profil autorise.
8. Tester les actions explicites: `Creer KPI`, `Creer risque`, `Creer controle`, `Creer backlog`, `Inserer brouillon procedure`.

## Feature flag

1. Desactiver `ai_copilot` pour le tenant.
2. Recharger l'onglet `Copilote IA`.
3. Verifier le message `Copilote IA non active pour ce tenant`.
4. Verifier qu'une generation API est refusee.

## Profils

- `readonly`: peut consulter les suggestions validees, ne peut pas generer ni appliquer.
- `consultant`: peut proposer/modifier selon permissions, ne peut pas valider.
- `direction_referent`: ne voit que les processus de son perimetre direction.
- `super_admin` sans support grant: acces refuse au contexte tenant.

## Boutons contextuels

- Wizard etape KPI: `Proposer des KPI`.
- Wizard etape risques: `Proposer des risques/controles`.
- Wizard etape points de douleur: `Proposer ameliorations`.
- Wizard etape automatisation: `Proposer automatisations`.
- Wizard resume: `Analyser les incoherences`.
- Onglet Procedure: `Generer brouillon IA`.
- Onglet Backlog: `Proposer backlog IA`.

## Points de controle securite

- Aucune suggestion IA ne modifie automatiquement BPMN, RACI, workflow, responsabilites, validations, versions publiees, risques/KPI valides ou conformite.
- Les sorties IA restent des suggestions, brouillons ou analyses.
- Les actions d'application sont explicites et auditees.
- Les cles provider ne sont jamais affichees dans l'UI ni dans les logs.
