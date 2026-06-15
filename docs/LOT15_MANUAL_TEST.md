# Lot 15 - Test manuel notifications, audit, taches et activite

1. Se connecter comme tenant_admin MAP.
2. Ouvrir `/tenant/notifications` et verifier la liste des notifications personnelles.
3. Ouvrir `/tenant/notification-preferences`, modifier in-app/email/frequence/langue, enregistrer.
4. Ouvrir une direction et affecter un referent.
5. Verifier qu'une notification d'affectation est visible pour le referent.
6. Relancer un referent depuis la direction.
7. Verifier la notification ou la tache de relance.
8. Ouvrir `/tenant/tasks`, creer une tache manuelle, puis la completer.
9. Ouvrir `/tenant/my-actions` et verifier taches, notifications, exports prets et processus a completer.
10. Soumettre un processus.
11. Se connecter comme validator.
12. Verifier la notification de validation et la file d'action.
13. Demander une correction sur le processus ou la procedure.
14. Revenir comme referent et verifier la notification de correction.
15. Generer un export officiel.
16. Verifier la notification `export_completed` ou `export_failed`.
17. Ouvrir `/tenant/activity`.
18. Filtrer par processus, direction, utilisateur ou type.
19. Ouvrir `/tenant/audit`.
20. Filtrer par action, resource_type, result ou correlation_id.
21. Exporter `/tenant/audit/export.csv`.
22. Tester un profil readonly : pas de creation de tache.
23. Tester un autre tenant : aucune notification, tache, activite ou audit du tenant MAP ne doit apparaitre.
24. Tester un super_admin sans support grant : pas d'acces a l'activite metier tenant.
25. Verifier qu'aucun secret, token, cookie, hash, DATABASE_URL ou cle API n'est affiche dans l'audit.
