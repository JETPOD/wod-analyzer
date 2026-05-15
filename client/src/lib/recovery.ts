// Recommandations de récupération déterministes basées sur la filière dominante,
// l'intensité et les capacités sollicitées.

import type { WodAnalysis, Capacity } from "./wodAnalyzer";

export interface RecoveryRecommendation {
  hoursMin: number;
  hoursMax: number;
  hoursLabel: string;
  beforeSameFiliere: string;
  warnings: string[];
  complementary: string[];
  shortText: string;
}

const FILIERE_LABEL = {
  atp_pcr: "ATP-PCr",
  glycolytic: "glycolytique",
  oxidative: "oxydative",
} as const;

export function computeRecovery(a: WodAnalysis): RecoveryRecommendation {
  const dom = a.dominantEnergetic;
  const intensity = a.intensity;
  const isIntense = intensity === "intense" || intensity === "extreme";

  let min = 24;
  let max = 36;
  let beforeSame = "48h";

  // Table principale : filière dominante × intensité
  if (dom === "atp_pcr") {
    if (isIntense) {
      min = 48;
      max = 72;
      beforeSame = "Force max : 72h";
    } else {
      min = 24;
      max = 24;
      beforeSame = "Même filière : 48h";
    }
  } else if (dom === "glycolytic") {
    if (isIntense) {
      min = 48;
      max = 48;
      beforeSame = "Glycolytique intense : 72h";
    } else {
      min = 24;
      max = 36;
      beforeSame = "Glycolytique intense : 48h";
    }
  } else {
    // oxidative
    if (isIntense) {
      min = 24;
      max = 48;
      beforeSame = "Long oxydatif : 48h";
    } else {
      min = 12;
      max = 24;
      beforeSame = "Long oxydatif : 24h";
    }
  }

  const warnings: string[] = [];

  if (a.capacities.gainage > 70) {
    warnings.push(
      "+24h sur les WODs sollicitant fortement le core (gainage > 70%)."
    );
  }
  if (a.estimatedDurationSec > 30 * 60 && isIntense) {
    warnings.push(
      "Volume > 30 min à intensité élevée : +24h, hydratation et sommeil prioritaires."
    );
    max += 24;
  }
  if (a.capacities.force_max > 70) {
    warnings.push(
      "Force max > 70% : récup SNC 48h minimum avant nouvelle session lourde."
    );
    min = Math.max(min, 48);
  }
  if (a.capacities.lactique > 75) {
    warnings.push(
      "Forte sollicitation lactique : prévoir mobilité légère + zone 1 pour drainer."
    );
  }

  const hoursLabel = min === max ? `${min}h` : `${min}-${max}h`;

  // Complémentarité — propose 2-3 séances pour le lendemain
  const complementary = buildComplementary(dom, a.capacities, isIntense);

  const shortText = `Filière dominante ${FILIERE_LABEL[dom]} · intensité ${intensity}. Récupération recommandée : ${hoursLabel} avant un stimulus de profil similaire.`;

  return {
    hoursMin: min,
    hoursMax: max,
    hoursLabel,
    beforeSameFiliere: beforeSame,
    warnings,
    complementary,
    shortText,
  };
}

function buildComplementary(
  dom: "atp_pcr" | "glycolytic" | "oxidative",
  caps: Record<Capacity, number>,
  isIntense: boolean
): string[] {
  const items: string[] = [];

  if (dom === "glycolytic") {
    items.push("Zone 2 cardio 30-45 min (vélo, rameur, course facile)");
    items.push("Mobilité + skill technique (haltéro à charge légère)");
    if (isIntense) items.push("Éviter glycolytique intense pendant 48h");
  } else if (dom === "atp_pcr") {
    items.push("Travail aérobie léger 30-40 min (zone 2)");
    items.push("Gym skill / mobilité — préserver le SNC");
    items.push("Éviter charges lourdes 48-72h");
  } else {
    // oxidative
    items.push("Skill technique ou travail unilatéral à charge modérée");
    items.push("Mobilité ciblée + sommeil prioritaire");
    if (caps.gainage > 60) items.push("Travail postural / Pilates léger");
    else items.push("Force max courte 3-5 reps (si non sollicitée aujourd'hui)");
  }

  return items.slice(0, 3);
}
