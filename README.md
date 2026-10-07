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
- 100 % frontend, aucun backend ni base de données serveur
- Historique et mouvements personnalisés en mémoire React (effacés au rechargement) ; poids corporel conservé localement dans `localStorage`

## Développement local

```bash
npm ci
npm run dev
```

## Build et déploiement

Le dossier `docs/` contient le build statique servi par GitHub Pages depuis la branche `main`. Pour reconstruire :

```bash
npm run check
npm run build
```

Vite écrit directement dans `docs/` et remplace le build précédent. Committez le dossier `docs/` reconstruit avec les sources, puis configurez GitHub Pages sur `main` / `docs`. Les assets utilisent des chemins relatifs et les pages de l’application des routes avec `#`, compatibles avec le sous-chemin `/wod-analyzer/`.

Pour vérifier le build localement : `npm run preview`. Le développement et la prévisualisation utilisent les serveurs de Vite ; aucun serveur applicatif Express ni fichier SQLite n’est nécessaire. Node.js 20.19+ ou 22.12+ est requis par Vite 7.

## Limites

Outil pédagogique. Modèle simplifié, calibré sur la littérature de la programmation et de la physiologie de l'exercice mais nécessairement approximatif sur des séances atypiques. Ne remplace pas l'œil et l'expérience d'un coach.

## Licence

Code ouvert. Forks, contributions, signalements de bugs et améliorations du catalogue de mouvements bienvenus.

---

**NutriCellScience, Mark DOWN**
