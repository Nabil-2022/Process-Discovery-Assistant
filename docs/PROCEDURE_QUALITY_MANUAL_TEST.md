# Lot 13 - Test manuel Procedure qualite structuree

## Preconditions

- Tenant MAP disponible.
- Processus complet avec activites, RACI, BPMN, documents, applications, KPI, risques et controles.
- Un profil `tenant_admin`, un profil `readonly`, un profil `consultant`.
- Aucun secret ne doit etre affiche dans l'interface ni dans les journaux.

## Scenario principal

1. Se connecter comme `tenant_admin` MAP.
2. Selectionner le tenant MAP.
3. Ouvrir un processus complet.
4. Ouvrir `Atelier de Formalisation`.
5. Ouvrir l'onglet `Procedure`.
6. Cliquer `Procedure qualite structuree`.
7. Cliquer `Generer procedure`.
8. Verifier les sections: identification, objet, perimetre, references, definitions, responsabilites, entrees, sorties, activites, documents, applications, KPI, risques et controles, conformite Maroc, process mining, preuves, versions, approbations, historique, annexes.
9. Modifier une section textuelle et cliquer `Sauvegarder`.
10. Cliquer `Generer brouillon IA`.
11. Verifier que le brouillon est affiche comme non officiel: `Brouillon genere par IA, a valider par un responsable habilite.`
12. Revenir au copilote IA si besoin et accepter ou rejeter la suggestion.
13. Cliquer `Soumettre en revue`.
14. Saisir un commentaire puis cliquer `Demander correction`.
15. Corriger une section puis sauvegarder.
16. Cliquer `Approuver`.
17. Cliquer `Publier`.
18. Verifier que la version publiee est immuable.
19. Verifier que la section Maroc apparait si Loi 55-19 ou processus usager est applicable.
20. Verifier les versions et le diff.
21. Verifier les actions audit: generation, edition section, brouillon IA, revue, correction, approbation, publication.

## Tests de profils

- `readonly`: lecture autorisee, aucune action d'ecriture.
- `consultant`: edition selon permissions, publication refusee.
- `super_admin` sans support grant: acces tenant refuse.

## Points ISO 9001

Verifier que l'interface utilise la formulation:

`Structure documentaire facilitant l'alignement avec un systeme de management de la qualite.`

Verifier que l'interface ne pretend jamais:

- `certifie ISO 9001`
- `conforme automatiquement`
- `procedure officielle sans validation`

## Points Maroc

Verifier la section `Exigences administratives et conformite Maroc`:

- canal actuel;
- canal cible;
- priorite simplification;
- priorite digitalisation;
- pieces demandees;
- delai actuel;
- delai cible;
- risques audit public;
- references reglementaires;
- avertissement de prudence juridique.
