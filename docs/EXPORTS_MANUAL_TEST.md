# Lot 14 - Test manuel Exports officiels

## Preconditions

- Tenant MAP disponible.
- Processus complet avec procedure, RACI, BPMN, risques, KPI, backlog et conformite Maroc si applicable.
- Stockage local de developpement disponible dans `storage/exports`.
- Ne pas afficher de secrets.

## Scenario principal

1. Se connecter comme `tenant_admin` MAP.
2. Selectionner le tenant MAP.
3. Ouvrir un processus complet.
4. Ouvrir `Atelier de Formalisation`.
5. Aller sur `/tenant/exports`.
6. Demander export `process_sheet` en `pdf`.
7. Telecharger le fichier.
8. Demander export `procedure` en `docx`.
9. Telecharger le fichier.
10. Demander export `raci_matrix` en `xlsx`.
11. Telecharger le fichier.
12. Demander export `bpmn_diagram` en `bpmn_xml`.
13. Ouvrir ou verifier le XML.
14. Demander export `risk_register` en `xlsx`.
15. Demander export `kpi_register` en `xlsx`.
16. Demander export `full_package` en `zip`.
17. Verifier l'historique exports et les statuts.
18. Tester un profil `readonly`.
19. Tester un autre tenant.
20. Tester `super_admin` sans support grant.
21. Verifier les actions audit: requested, started, completed, downloaded.

## Points de controle

- Les exports officiels proviennent des donnees structurees, snapshots, versions publiees ou contenus valides humainement.
- L'IA ne produit jamais seule un export officiel.
- Les fichiers ne sont pas stockes en PostgreSQL.
- `object_key` contient `tenantId` et `exportJobId`.
- Le checksum et la taille sont renseignes.
- Les exports Maroc contiennent l'avertissement juridique.
