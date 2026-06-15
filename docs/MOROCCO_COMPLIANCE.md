# Addendum Reglementaire Marocain et Process Mining Readiness

## Objectif

Ce module ajoute une couche configurable pour les administrations marocaines et les organisations
publiques sans figer la plateforme sur un texte unique ni transformer l'outil en certificateur de
conformite.

Cet outil facilite la structuration, la documentation et la tracabilite. Il ne constitue pas un avis
juridique et ne garantit pas a lui seul la conformite reglementaire.

## Loi 55-19 et Processus Usager

La fiche processus peut qualifier les processus exposes aux usagers et preparer les informations
utiles a la simplification, a la digitalisation et a l'audit:

- processus usager ou interne;
- applicabilite declaree de la Loi 55-19;
- type de procedure administrative et categorie d'usager;
- canal actuel et canal cible;
- priorites de simplification et de digitalisation;
- delais actuels et cibles;
- nombre de documents, copies et visites physiques;
- frais, reference legale, entite proprietaire et portail public.

Les indicateurs tenant consolident les volumes de processus usagers, les procedures non digitalisees,
les priorites, les delais moyens, les documents moyens, les visites physiques moyennes et le taux cible
de digitalisation.

## Simplification et Digitalisation

Les champs de readiness sont concus pour identifier les parcours a simplifier avant automatisation:
documents redondants, visites physiques, delais de traitement, bascule vers un canal digital et
responsabilite de l'entite proprietaire.

## Risques et Preparation Audit Public

Les risques processus peuvent porter une classification orientee audit public:

- famille et categorie de risque;
- description, cause et consequence;
- probabilite, impact et score inherent;
- controles existants, proprietaire du controle et plan d'action;
- probabilite, impact et score residuel;
- date cible, preuve attendue, pertinence audit;
- pertinence Cour des comptes et reference legale ou reglementaire.

Ces informations preparent les revues internes et externes, mais ne remplacent pas les analyses
juridiques, d'audit ou de controle interne.

## Process Mining Readiness

Le module prepare le socle donnees pour le process mining:

- imports de journaux d'evenements;
- cas;
- evenements;
- attributs;
- executions d'analyse;
- modeles decouverts;
- controles de conformite;
- analyses de goulots.

Le CSV minimal attendu contient `case_id`, `activity_name` et `event_timestamp`. Les colonnes
optionnelles supportees sont `lifecycle_transition`, `resource`, `role`, `department`,
`application`, `cost`, `channel`, `status` et `raw_payload`.

Le format XES reste une cible future. Le stockage actuel garde le modele generique pour permettre un
import XES ou un connecteur applicatif ulterieur.

## Analyse Basique

L'analyse integree calcule:

- nombre de cas et d'evenements;
- nombre d'activites distinctes;
- duree moyenne et mediane par cas;
- activite la plus frequente;
- chemins observes;
- boucles simples;
- goulots par duree moyenne entre activites.

Aucun moteur `pm4py` n'est embarque en production dans ce lot. Une architecture future peut ajouter
un worker Python optionnel pour la decouverte avancee, la conformite de modele et les analyses plus
profondes.

## BPMN 2.0

La preparation BPMN conserve les metadonnees necessaires a des exports deterministes:

- `bpmn_export_format` fixe a `BPMN_2_0`;
- compatibilite cible Camunda, Bizagi et Signavio;
- `bpmn_xml`, `bpmn_json`, `source_model_hash`, `export_version`, `generated_at`,
  `generated_by`.

La generation BPMN complete reste reservee au lot dedie.

## Limites

La plateforme facilite la documentation, la tracabilite, la preparation d'audit, la simplification et
la digitalisation. Elle ne certifie pas une procedure, ne remplace pas un avis juridique, ne garantit
pas la conformite reglementaire et ne substitue pas les controles formels de l'administration ou des
instances d'audit.
