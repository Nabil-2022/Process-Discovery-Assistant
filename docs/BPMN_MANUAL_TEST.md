# Test manuel - Lot 10 BPMN 2.0 deterministe

## Objectif

Verifier que le BPMN officiel est genere uniquement depuis les donnees structurees du processus:
activites, transitions, acteurs RACI, documents, applications, risques, controles, KPI et donnees
Maroc. L IA ne doit pas produire le BPMN officiel.

## Parcours nominal

1. Ouvrir `/tenant/processes/preview-process-cloture/bpmn`.
2. Cliquer sur `Generer`.
3. Verifier la presence des lanes, evenements debut/fin, taches et sequence flows.
4. Ouvrir l export XML et verifier que le contenu commence par `bpmn:definitions`.
5. Ouvrir l export JSON et verifier la presence de `nodes`, `edges`, `lanes`, `issues`.
6. Cliquer sur `Valider` si aucun blocage n est present.
7. Verifier que le statut passe a `VALIDATED` et qu une version est ajoutee.

## Blocages attendus

- Activite orpheline: blocage `orphan_activity`.
- Transition vers activite inexistante: blocage `transition_to_missing`.
- Transition depuis activite inexistante: blocage `transition_from_missing`.
- Branche conditionnelle sans cible: blocage `conditional_branch_without_target`.
- Condition sans libelle de branche: blocage `condition_without_label`.

## Warnings attendus

- Activite sans Responsible RACI: `activity_without_responsible`.
- Lane non assignee: `unassigned_lane_used`.
- Trop d activites manuelles: `too_many_manual_activities`.
- Boucle detectee: `loop_detected`.
- Processus usager sans canal cible: `user_facing_without_target_channel`.
- Processus usager sans delai cible: `user_facing_without_target_delay`.
- Loi 55-19 sans cible digitale: `law_55_19_without_digital_target`.
- Loi 55-19 sans KPI delai: `law_55_19_without_delay_kpi`.
- Loi 55-19 sans responsable de simplification: `law_55_19_without_simplification_owner`.

## Wizard

1. Ouvrir `/tenant/processes/preview-process-cloture/wizard`.
2. A l etape 3, verifier le preview sequence BPMN et le bouton `Ouvrir BPMN detaille`.
3. A l etape 11, verifier statut, blocages, warnings, version BPMN et export XML.

## RBAC

- `tenant_admin`: generation, recalcul, validation, invalidation.
- `direction_referent`: generation/recalcul dans son perimetre direction.
- `validator`: validation si permission presente.
- `consultant`: lecture possible, validation refusee.
- `readonly`: lecture seule.
- `super_admin` sans support grant: acces tenant refuse.

## Limites

Le viewer frontend est une visualisation SVG interne. Le BPMN officiel est l export XML 2.0
genere par le backend et conserve en version.
