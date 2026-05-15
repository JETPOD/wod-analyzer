# WOD Analyzer

Analyseur déterministe de WOD (Workout of the Day) pour CrossFit, Hyrox et haltérophilie. Outil pédagogique gratuit publié par [NutriCellScience](https://nutricellscience.blog).

**Lancer l'outil :** [jetpod.github.io/wod-analyzer](https://jetpod.github.io/wod-analyzer/)

## Ce que fait l'outil

Vous collez un WOD en texte libre (français ou anglais, format AMRAP / EMOM / For Time / Chipper / Tabata / Strength / Hyrox) et l'app renvoie un profil complet de capacités physiques sollicitées :

- **3 filières énergétiques** : ATP-PCr (phosphagène), glycolytique anaérobie, oxydative aérobie
- **7 capacités neuromusculaires** : force maximale, puissance explosive, endurance de force, VO2max, capacité lactique, gainage, skill technique
- **Radar visuel** sur les 10 axes
- **Décomposition mouvement par mouvement**
- **Recommandations de récupération** et complémentarité
- **Mode programmation hebdomadaire** équilibrée 5-6 séances
- **Base de 42 WODs benchmark** (Girls, Heroes, Open CrossFit)
- **Historique** avec comparaison radar de plusieurs WODs
- **Export PDF** du rapport et **Export/Import JSON** de l'historique

## Modèle scientifique

Modèle hybride combinant les filières énergétiques classiques (système phosphagène / glycolyse anaérobie / phosphorylation oxydative) et les capacités neuromusculaires de la programmation moderne. Catalogue de 50+ mouvements avec dominante, secondaires, répartition filières, charge typique, temps par rép, et alias regex bilingues.

Scoring déterministe : pondération temps × dominante × ajustements globaux (durée, format, intensité). **Aucun appel à un modèle de langage** — l'analyse est reproductible et auditable.

## Stack

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Recharts pour les radars
- jsPDF + html2canvas pour l'export
- 100 % frontend, aucun backend, aucun stockage navigateur

## Développement local

```bash
npm install
npm run dev
```

## Build et déploiement

Le dossier `docs/` contient le build statique servi par GitHub Pages depuis la branche `main`. Pour reconstruire :

```bash
npm run build
rm -rf docs && cp -r dist/public docs
```

## Limites

Outil pédagogique. Modèle simplifié, calibré sur la littérature de la programmation et de la physiologie de l'exercice mais nécessairement approximatif sur des séances atypiques. Ne remplace pas l'œil et l'expérience d'un coach.

## Licence

Code ouvert. Forks, contributions, signalements de bugs et améliorations du catalogue de mouvements bienvenus.

---

**NutriCellScience, Mark DOWN**
