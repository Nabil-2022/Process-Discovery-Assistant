# Lot 9 - Scenario manuel RACI

1. Se connecter comme `tenant_admin` MAP.
2. Selectionner le tenant MAP.
3. Ouvrir un processus avec activites et acteurs.
4. Ouvrir `/tenant/processes/:id/raci`.
5. Cliquer sur `Generer`.
6. Retirer le role `Responsible` d'une activite via l'edition des responsabilites.
7. Verifier le blocage `missing_responsible`.
8. Remettre un `Responsible`.
9. Retirer le role `Accountable`.
10. Verifier le blocage `missing_accountable`.
11. Ajouter deux `Accountable` sur une activite.
12. Verifier le warning `multiple_accountable`.
13. Cliquer sur `Valider` quand aucun blocage ne reste.
14. Verifier que le statut passe a `VALIDATED`.
15. Verifier l'historique RACI et les versions.
16. Verifier les logs d'audit `raci_generated`, `raci_responsibility_updated`,
    `raci_validated` ou `raci_invalidated`.
17. Tester un compte `readonly`: les ecritures et validations doivent etre refusees.
18. Tester un compte `consultant`: la validation officielle doit etre refusee.
19. Tester un `direction_referent` hors perimetre: le processus doit etre inaccessible.
20. Tester un processus usager Loi 55-19: verifier les warnings specifiques RACI.
21. Tester un risque avec `court_of_accounts_relevance`: verifier le warning audit public.
22. Ouvrir l'export CSV si disponible via `/api/v1/tenant/processes/:id/raci/export.csv`.

Le moteur RACI reste deterministe. Les recommandations ne modifient jamais automatiquement les
responsabilites.
