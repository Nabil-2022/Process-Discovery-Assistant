# Test manuel - Lot 11 Atelier de Formalisation

## Objectif

Verifier que l atelier centralise les livrables, controles, statuts et actions d un processus sans
dupliquer les moteurs RACI, BPMN, conformite Maroc, workflow ou completude.

## Scenario tenant admin MAP

1. Se connecter comme `tenant_admin` MAP.
2. Selectionner le tenant MAP.
3. Ouvrir la liste des processus.
4. Cliquer sur `Atelier` pour un processus existant.
5. Verifier la route `/tenant/processes/:id/workshop`.
6. Verifier l onglet `Vue d’ensemble`: statut, score, RACI, BPMN, blocages, warnings.
7. Ouvrir `BPMN`: diagramme, issues, warnings, recommandations, exports XML/JSON.
8. Ouvrir `RACI`: matrice, issues, warnings, recommandations, export CSV.
9. Ouvrir `Workflow`: statut, historique et versions/snapshots lies si disponibles.
10. Ouvrir `KPI`: etat vide ou KPI existants, lien wizard KPI.
11. Ouvrir `Risques et controles`: etat et lien wizard risques.
12. Ouvrir `Controle Qualite`: score, sections, blocages, warnings, recommandations.
13. Ouvrir `Conformite Maroc`: verifier le bandeau de prudence.
14. Ouvrir `Process Mining`: imports event logs et message worker optionnel.
15. Ouvrir `Procedure`: sections deterministes et disclaimer validation humaine.
16. Ouvrir `Backlog`: items issus pain points, automation, qualite, RACI, BPMN, Maroc.
17. Ouvrir `Versions`: versions processus, snapshots, RACI, BPMN.
18. Ouvrir `Commentaires`: creer un commentaire, puis le resoudre.
19. Ouvrir `Audit`: verifier les actions filtrees du processus.
20. Revenir au wizard, RACI et BPMN via les liens de navigation.

## RBAC

1. Tester `readonly`: lecture atelier OK, creation commentaire refusee.
2. Tester `direction_referent` hors perimetre: atelier refuse.
3. Tester tenant A contre processus tenant B: atelier refuse.
4. Tester `super_admin` sans support grant: atelier metier refuse.
5. Tester support grant valide: lecture atelier autorisee selon scope.

## Points d attention

- Ne pas afficher de secrets.
- Ne pas modifier une version publiee.
- Les onglets BPMN/RACI reutilisent les moteurs existants.
- La procedure est une structure deterministe, pas une procedure officielle validee.
- L analyse avancee process mining reste hors lot.
