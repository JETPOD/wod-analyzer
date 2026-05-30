// Parser + Scorer pour WOD Analyzer
// Aucun appel LLM — uniquement regex + heuristiques déterministes.

import { MOVEMENTS, type Capacity, type Energetics, type MovementDef } from "./movementsDb";
export type { Capacity, Energetics, MovementDef } from "./movementsDb";

export type WodFormat =
  | "amrap"
  | "emom"
  | "exmom"
  | "for_time"
  | "rft"
  | "chipper"
  | "tabata"
  | "intervals"
  | "strength"
  | "hyrox"
  | "death_by"
  | "unknown";

export interface DetectedMovement {
  movement: MovementDef;
  reps: number; // reps cumulées sur tout le WOD
  distanceM?: number; // pour cardio
  loadKg?: number;
  loadPctRm?: number; // si déduit ex: "85%"
  estimatedSeconds: number; // temps total imputable à ce mvt
  rawLine: string;
}

export interface WodAnalysis {
  inputText: string;
  format: WodFormat;
  formatLabel: string;
  estimatedDurationSec: number;
  estimatedDurationLabel: string;
  intensity: "leger" | "modere" | "intense" | "extreme";
  intensityLabel: string;
  movements: DetectedMovement[];
  // 3 filières + 7 capacités, scores 0-100
  energetics: { atp_pcr: number; glycolytic: number; oxidative: number };
  capacities: Record<Capacity, number>;
  // ordres dominants
  dominantEnergetic: keyof WodAnalysis["energetics"];
  topCapacities: Capacity[];
  summary: string;
  // Paramètres spécifiques EXMOM (uniquement si format === 'exmom')
  exmomWindowMin?: number | null;
  exmomRounds?: number | null;
}

const CAPACITY_LABELS: Record<Capacity, string> = {
  force_max: "Force maximale",
  puissance: "Puissance explosive",
  endurance_force: "Endurance de force",
  vo2max: "VO2max",
  lactique: "Capacité lactique",
  gainage: "Gainage",
  skill: "Skill technique",
};

const ENERGETIC_LABELS = {
  atp_pcr: "ATP-PCr (phosphagène)",
  glycolytic: "Glycolytique anaérobie",
  oxidative: "Oxydative (aérobie)",
};

export function capacityLabel(c: Capacity): string {
  return CAPACITY_LABELS[c];
}

export function energeticLabel(e: keyof WodAnalysis["energetics"]): string {
  return ENERGETIC_LABELS[e];
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING
// ─────────────────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ");
}

interface FormatDetect {
  format: WodFormat;
  totalSec: number | null; // si déductible (AMRAP 20 / EMOM 12 etc.)
  rounds: number | null;
  repsScheme: number[] | null; // ex: 21-15-9 → [21,15,9]
  /** Fenêtre EXMOM en minutes (2, 3, 4…). Null pour tout autre format. */
  windowMin?: number | null;
}

function detectFormat(text: string): FormatDetect {
  const t = text.toLowerCase();
  // Death by (EMOM progressif : +1 rep / minute jusqu'à échec)
  // On capture ici uniquement le format. Le point de rupture par défaut sera
  // déterminé par estimateDeathByCap(mvt) une fois le mouvement détecté.
  // Cap initial : 10 minutes (val typique intermédiaire) → raffiné dans analyzeWod.
  if (/\bdeath\s*by\b/.test(t)) {
    return { format: "death_by", totalSec: 10 * 60, rounds: null, repsScheme: null };
  }
  // AMRAP
  let m = t.match(/amrap[^0-9]{0,8}(\d+)\s*(min|m\b|minutes?)?/);
  if (m) {
    const min = parseInt(m[1], 10);
    return { format: "amrap", totalSec: min * 60, rounds: null, repsScheme: null };
  }
  if (/\bamrap\b/.test(t))
    return { format: "amrap", totalSec: 20 * 60, rounds: null, repsScheme: null };

  // EXMOM (Every X Minutes On the Minute, X >= 2). Doit être testé avant EMOM
  // pour ne pas être capturé par un EMOM générique. On accepte trois syntaxes :
  //   1. E2MOM / E3MOM / E4MOM… (sans espace)
  //   2. Every 2 minutes [on the minute] (EN)
  //   3. Toutes les 2 minutes (FR)
  // Après la capture de la fenêtre X, on cherche dans le même texte une durée
  // totale (« pendant 20 min », « for 20 minutes ») ou un nombre de rounds
  // (« x 10 rounds »). Si rien n'est trouvé, on retombe sur EXMOM_DEFAULT_ROUNDS.
  {
    let xMin: number | null = null;
    const mE = t.match(/\be\s*(\d+)\s*m(?:in)?\s*om\b/); // E2MOM / E 3 MOM / E4 min OM
    const mEvery = t.match(/\bevery\s*(\d+)\s*(?:min(?:ute)?s?)\b/); // Every 2 minutes
    const mToutes = t.match(/\btoutes\s+les\s+(\d+)\s*(?:min(?:utes?)?)\b/); // Toutes les 2 minutes
    const match = mE || mEvery || mToutes;
    if (match) {
      xMin = parseInt(match[1], 10);
    }
    // X doit être >= 2 (X=1 retombe sur EMOM classique)
    if (xMin !== null && xMin >= 2) {
      // Cherche durée totale explicite : "pendant 20 min", "for 20 min", "20 min total", "20 min\b"
      // Stratégie : on prend le plus grand nombre suivi de "min" qui n'est PAS la fenêtre xMin
      const allMins = Array.from(t.matchAll(/(\d+)\s*(?:min(?:ute)?s?|m\b)/g));
      let totalMin: number | null = null;
      for (const mm of allMins) {
        const v = parseInt(mm[1], 10);
        if (v !== xMin && v > xMin && (totalMin === null || v > totalMin)) {
          totalMin = v;
        }
      }
      // Cherche un nombre de rounds explicite : "x 10 rounds", "10 tours", "x 8 rds"
      let rounds: number | null = null;
      const mRounds = t.match(/x\s*(\d+)\s*(?:rounds?|tours?|rds?|sets?|séries?)/);
      const mRoundsAlt = t.match(/(\d+)\s*(?:rounds?|tours?|rds?)\b/);
      if (mRounds) rounds = parseInt(mRounds[1], 10);
      else if (mRoundsAlt) {
        const v = parseInt(mRoundsAlt[1], 10);
        // Ignore si c'est la même valeur que totalMin (évite "20 rounds" confondu avec "20 min")
        if (v !== totalMin) rounds = v;
      }
      // Résolution : si on a totalMin → rounds = totalMin / xMin
      //               sinon si on a rounds → totalMin = rounds * xMin
      //               sinon : EXMOM_DEFAULT_ROUNDS
      if (totalMin !== null) {
        rounds = Math.max(1, Math.round(totalMin / xMin));
      } else if (rounds !== null) {
        totalMin = rounds * xMin;
      } else {
        rounds = EXMOM_DEFAULT_ROUNDS;
        totalMin = rounds * xMin;
      }
      return {
        format: "exmom",
        totalSec: totalMin * 60,
        rounds,
        repsScheme: null,
        windowMin: xMin,
      };
    }
  }

  // EMOM
  m = t.match(/emom[^0-9]{0,8}(\d+)\s*(min|m\b|minutes?)?/);
  if (m) {
    const min = parseInt(m[1], 10);
    return { format: "emom", totalSec: min * 60, rounds: null, repsScheme: null };
  }
  if (/\bemom\b/.test(t))
    return { format: "emom", totalSec: 12 * 60, rounds: null, repsScheme: null };

  // Tabata
  if (/\btabata\b/.test(t)) {
    // 8 rounds x 20s on / 10s off = 4 min par bloc
    const blocks = (t.match(/tabata/g) || []).length;
    return { format: "tabata", totalSec: 4 * 60 * Math.max(1, blocks), rounds: 8, repsScheme: null };
  }

  // RFT / Rounds For Time
  m = t.match(/(\d+)\s*(rft|rounds?\s*for\s*time|tours?\s*chrono|rdf)/);
  if (m) {
    const rounds = parseInt(m[1], 10);
    return { format: "rft", totalSec: null, rounds, repsScheme: null };
  }

  // Strength scheme X x Y (5x5, 3x3, 5x3, 8x2, etc.)
  m = t.match(/\b(\d+)\s*x\s*(\d+)\b/);
  if (m) {
    const sets = parseInt(m[1], 10);
    const reps = parseInt(m[2], 10);
    if (sets <= 12 && reps <= 12) {
      return {
        format: "strength",
        totalSec: sets * (reps * 4 + 90), // ~4s/rep + 90s repos
        rounds: sets,
        repsScheme: Array(sets).fill(reps),
      };
    }
  }

  // Hyrox
  if (/\bhyrox\b/.test(t)) {
    return { format: "hyrox", totalSec: 70 * 60, rounds: 8, repsScheme: null };
  }

  // 21-15-9 type
  m = t.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})\s*[-–]\s*(\d{1,3})/);
  if (m) {
    return {
      format: "for_time",
      totalSec: null,
      rounds: null,
      repsScheme: [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)],
    };
  }

  // Chipper (liste linéaire pas de rounds)
  if (/\bchipper\b/.test(t)) {
    return { format: "chipper", totalSec: null, rounds: 1, repsScheme: null };
  }

  // For Time
  if (/\bfor\s*time\b|\bft\b|\bpour\s*le\s*temps\b/.test(t)) {
    return { format: "for_time", totalSec: null, rounds: 1, repsScheme: null };
  }

  // Intervalles
  if (/intervals?|interval|\d+\s*\/\s*\d+\b/.test(t)) {
    return { format: "intervals", totalSec: null, rounds: null, repsScheme: null };
  }

  return { format: "unknown", totalSec: null, rounds: null, repsScheme: null };
}

const FORMAT_LABELS: Record<WodFormat, string> = {
  amrap: "AMRAP",
  emom: "EMOM",
  exmom: "EXMOM",
  for_time: "For Time",
  rft: "Rounds For Time",
  chipper: "Chipper",
  tabata: "Tabata",
  intervals: "Intervalles",
  strength: "Strength (séries / reps)",
  hyrox: "Hyrox",
  death_by: "Death by (EMOM progressif)",
  unknown: "Format libre",
};

// Durée par défaut pour un EXMOM sans durée/rounds explicites (en rounds)
export const EXMOM_DEFAULT_ROUNDS = 10;

// ─── DEATH BY ────────────────────────────────────────────────────────────────
// Estimation du point de rupture en minutes pour un athlète intermédiaire,
// selon le profil du mouvement. Permet de calculer reps totales triangulaires
// (1+2+…+n) et la durée du WOD sans LLM.
export function estimateDeathByCap(mv: MovementDef): number {
  // Cardio léger / ouvert (sprints courts, jacks) → 14 min
  if (mv.isCardio && mv.secondsPerRep <= 1.5) return 14;
  // Cardio modéré (row, bike, ski en mètres ou calories) → 12 min
  if (mv.isCardio) return 12;
  // Strongman / odd objects → 7 min (charges très lourdes, rupture rapide)
  if (mv.typicalLoad >= 0.85 && mv.category === "weightlifting") return 7;
  // Haltérophilie lourde (clean, snatch, deadlift) → 8 min
  if (mv.category === "weightlifting" && mv.typicalLoad >= 0.7) return 8;
  // Haltérophilie légère (wall ball, KB swing, thruster léger) → 11 min
  if (mv.category === "weightlifting") return 11;
  // Gym avancée stricte (strict pull-up, strict HSPU, muscle-up…) :
  // dominante force_max + secondsPerRep ≥ 4 → 7 min
  if (mv.category === "gymnastics" && mv.dominantCapacity === "force_max" && mv.secondsPerRep >= 4) return 7;
  // Gym intermédiaire (pull-up, kipping HSPU, C2B, T2B) → 9 min
  if (mv.category === "gymnastics" && mv.secondsPerRep >= 3) return 9;
  // Gym basique (push-up, sit-up, burpee, air squat) → 12 min
  if (mv.category === "gymnastics") return 12;
  // Core / gainage → 11 min
  if (mv.category === "core") return 11;
  // Default
  return 10;
}

// Reps totales pour un point de rupture n : 1 + 2 + … + n = n(n+1)/2
export function deathByTotalReps(cap: number): number {
  return (cap * (cap + 1)) / 2;
}

// Détecte tous les mouvements du texte, en supprimant les chevauchements pour
// éviter qu'une ligne soit comptée à la fois Swing et Russian Swing par ex.
interface RawMatch {
  movement: MovementDef;
  index: number;
  endIndex: number;
  line: string;
  lineStart: number;
}

function findAllMatches(text: string, allMovements: MovementDef[] = MOVEMENTS): RawMatch[] {
  const lines = text.split(/\n/);
  const all: RawMatch[] = [];
  let cursor = 0;
  for (const line of lines) {
    const lineStart = cursor;
    cursor += line.length + 1;
    if (!line.trim()) continue;
    for (const mv of allMovements) {
      for (const rx of mv.aliases) {
        const r = new RegExp(rx.source, rx.flags + (rx.flags.includes("g") ? "" : "g"));
        let m: RegExpExecArray | null;
        while ((m = r.exec(line.toLowerCase())) !== null) {
          all.push({
            movement: mv,
            index: lineStart + m.index,
            endIndex: lineStart + m.index + m[0].length,
            line,
            lineStart,
          });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }
    }
  }
  // Dedupe par ligne + mouvement
  const seen = new Set<string>();
  const result: RawMatch[] = [];
  // Sort by index, prefer longer match at same start
  all.sort((a, b) => a.index - b.index || b.endIndex - b.endIndex - (a.endIndex - a.endIndex));
  for (const m of all) {
    const key = `${m.lineStart}|${m.movement.id}`;
    if (seen.has(key)) continue;
    // Si on a déjà matché une plage qui recouvre celle-ci sur la même ligne (sous-string), skip
    const overlapped = result.some(
      (r) =>
        r.lineStart === m.lineStart &&
        !(m.endIndex <= r.index || m.index >= r.endIndex) &&
        // recouvre et l'autre est plus large
        r.endIndex - r.index >= m.endIndex - m.index &&
        r.movement.id !== m.movement.id
    );
    if (overlapped) continue;
    seen.add(key);
    result.push(m);
  }
  return result;
}

// Extrait reps + load d'une ligne, autour de la position du mouvement
function extractRepsAndLoad(
  line: string,
  matchIndexInLine: number,
  mv: MovementDef
): { reps: number; loadKg?: number; loadPctRm?: number; distanceM?: number } {
  const lower = line.toLowerCase();

  // Distance en m / km / mile pour cardio
  if (mv.isCardio) {
    // mile
    const mile = lower.match(/(\d+(?:[.,]\d+)?)\s*mile(s)?/);
    if (mile) return { reps: 0, distanceM: parseFloat(mile[1].replace(",", ".")) * 1609 };
    // km
    const km = lower.match(/(\d+(?:[.,]\d+)?)\s*k(?:m)?\b/);
    if (km) return { reps: 0, distanceM: parseFloat(km[1].replace(",", ".")) * 1000 };
    // m (meters) — attention "min" mots
    const meters = lower.match(/(\d+)\s*m(?!in|i\b|\w)/);
    if (meters) return { reps: 0, distanceM: parseInt(meters[1], 10) };
    // calories
    const cal = lower.match(/(\d+)\s*cal(orie)?s?/);
    if (cal) return { reps: parseInt(cal[1], 10) };
    // time on bike/row "(\d+) min row"
    const min = lower.match(/(\d+)\s*min\s*(row|bike|ski|run)/);
    if (min) {
      // convertit en distance approx via secondsPerRep par m: 1 min = 60s / spp m
      return { reps: 0, distanceM: 60 * parseInt(min[1], 10) / (mv.secondsPerRep || 0.2) };
    }
    return { reps: 0, distanceM: 500 }; // défaut
  }

  // Reps : nombre juste avant le mouvement (jusqu'à 10 chars avant)
  const before = line.slice(Math.max(0, matchIndexInLine - 12), matchIndexInLine);
  const repsMatch = before.match(/(\d{1,3})\s*[x×]?\s*$/);
  let reps = repsMatch ? parseInt(repsMatch[1], 10) : 1;

  // Charge en kg ou lb
  const after = line.slice(matchIndexInLine, matchIndexInLine + 60);
  let loadKg: number | undefined;
  const kg = lower.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo)/);
  if (kg) loadKg = parseFloat(kg[1].replace(",", "."));
  const lb = lower.match(/(\d+(?:[.,]\d+)?)\s*(lb|lbs|pound)/);
  if (lb && !loadKg) loadKg = parseFloat(lb[1].replace(",", ".")) * 0.4536;

  let loadPctRm: number | undefined;
  const pct = lower.match(/(\d{1,3})\s*%/);
  if (pct) loadPctRm = parseInt(pct[1], 10) / 100;

  return { reps, loadKg, loadPctRm };
}

function expandWithScheme(
  rawMatches: RawMatch[],
  fmt: FormatDetect
): DetectedMovement[] {
  const detected: DetectedMovement[] = [];
  // Groupes par ordre d'apparition
  for (const m of rawMatches) {
    const matchIndexInLine = m.index - m.lineStart;
    const { reps, loadKg, loadPctRm, distanceM } = extractRepsAndLoad(m.line, matchIndexInLine, m.movement);
    let totalReps = reps;
    let totalDistance = distanceM || 0;

    // Si schéma 21-15-9 et tous mouvements à l'intérieur → multiplier reps
    if (fmt.repsScheme && fmt.format === "for_time" && reps === 1) {
      // Si la ligne ne définit pas son propre nombre de reps, on applique le schéma
      totalReps = fmt.repsScheme.reduce((a, b) => a + b, 0);
    }

    // Multiplier par les rounds (AMRAP/RFT/EMOM) — estimation heuristique
    if (fmt.format === "amrap" && fmt.totalSec) {
      // tente d'estimer le nombre de tours achevables
      const roundLen = rawMatches.length * (m.movement.secondsPerRep * Math.max(1, reps));
      // Au lieu de calculer round-par-round, on multiplie par rounds estimés à la fin
    }
    if (fmt.format === "rft" && fmt.rounds) totalReps = reps * fmt.rounds;
    if (fmt.format === "tabata") {
      // 8 rounds — chaque round 20s on
      totalReps = Math.round(20 / Math.max(0.5, m.movement.secondsPerRep)) * 8;
      if (m.movement.isCardio) totalDistance = (20 * 8) / m.movement.secondsPerRep;
    }
    if (fmt.format === "strength" && fmt.repsScheme) {
      totalReps = fmt.repsScheme.reduce((a, b) => a + b, 0);
    }

    const estimatedSeconds =
      m.movement.isCardio && totalDistance > 0
        ? totalDistance * m.movement.secondsPerRep
        : Math.max(1, totalReps) * m.movement.secondsPerRep;

    detected.push({
      movement: m.movement,
      reps: totalReps,
      distanceM: totalDistance || undefined,
      loadKg,
      loadPctRm,
      estimatedSeconds,
      rawLine: m.line.trim(),
    });
  }

  // Si AMRAP, estimer tours et multiplier reps par tours réalisés
  if (fmt.format === "amrap" && fmt.totalSec && detected.length > 0) {
    const perRoundSec = detected.reduce((a, d) => a + d.estimatedSeconds, 0);
    if (perRoundSec > 0) {
      const rounds = Math.max(1, Math.round(fmt.totalSec / perRoundSec));
      for (const d of detected) {
        d.reps = d.reps * rounds;
        if (d.distanceM) d.distanceM = d.distanceM * rounds;
        d.estimatedSeconds = d.estimatedSeconds * rounds;
      }
    }
  }

  // EMOM : durée totale = totalSec ; on répartit entre mouvements détectés
  if (fmt.format === "emom" && fmt.totalSec) {
    // Chaque minute typiquement un mouvement avec sa rep — on multiplie reps par (totalSec/60)/nbMvts
    const minutes = fmt.totalSec / 60;
    const minutesPerMvt = minutes / Math.max(1, detected.length);
    for (const d of detected) {
      d.reps = Math.round(d.reps * minutesPerMvt);
      d.estimatedSeconds = d.reps * d.movement.secondsPerRep;
    }
  }

  // EXMOM : reps par round × nb de rounds. Tous les mouvements détectés sont
  // supposés exécutés à chaque round (ex : E3MOM 18 min : 5 DL + 10 burpees).
  // estimatedSeconds = temps de travail réel (reps × secondsPerRep), pas la
  // durée bloquée — le repos est implicite dans le format.
  if (fmt.format === "exmom" && fmt.rounds !== null) {
    const rounds = fmt.rounds;
    for (const d of detected) {
      d.reps = d.reps * rounds;
      if (d.distanceM) d.distanceM = d.distanceM * rounds;
      d.estimatedSeconds = d.reps * d.movement.secondsPerRep;
    }
  }

  // Death by : 1 + 2 + ... + n reps, n = point de rupture estimé.
  // On garde le premier mouvement détecté (version 1 mouvement) et on lui assigne
  // les reps totales triangulaires + une durée = n minutes (cadre EMOM).
  if (fmt.format === "death_by" && detected.length > 0) {
    const mainMv = detected[0];
    const cap = estimateDeathByCap(mainMv.movement);
    const totalReps = deathByTotalReps(cap);
    mainMv.reps = totalReps;
    mainMv.estimatedSeconds = cap * 60; // durée = nombre de minutes tenues
    fmt.totalSec = cap * 60; // synchronise la durée globale du WOD
    // On supprime les autres matches éventuels (version 1 mouvement)
    return [mainMv];
  }

  return detected;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────

const CAPS: Capacity[] = [
  "force_max",
  "puissance",
  "endurance_force",
  "vo2max",
  "lactique",
  "gainage",
  "skill",
];

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function computeScores(
  detected: DetectedMovement[],
  durationSec: number,
  format: WodFormat
): { energetics: WodAnalysis["energetics"]; capacities: Record<Capacity, number> } {
  // Volume relatif: chaque mouvement contribue avec un "poids" = temps qu'il occupe
  const totalTime = Math.max(
    1,
    detected.reduce((a, d) => a + d.estimatedSeconds, 0)
  );

  const energy = { atp_pcr: 0, glycolytic: 0, oxidative: 0 };
  const caps: Record<Capacity, number> = {
    force_max: 0,
    puissance: 0,
    endurance_force: 0,
    vo2max: 0,
    lactique: 0,
    gainage: 0,
    skill: 0,
  };

  for (const d of detected) {
    const w = d.estimatedSeconds / totalTime;
    energy.atp_pcr += d.movement.energetics.atp_pcr * w;
    energy.glycolytic += d.movement.energetics.glycolytic * w;
    energy.oxidative += d.movement.energetics.oxidative * w;

    // Dominante = poids 2.0, secondaires = poids 1.0
    caps[d.movement.dominantCapacity] += 2.0 * w;
    for (const sec of d.movement.secondaryCapacities) {
      caps[sec] += 1.0 * w;
    }

    // Bonus charge: si load_pct >= 0.85 → force_max +; >= 0.7 → force_max + endurance_force
    const eff =
      d.loadPctRm !== undefined
        ? d.loadPctRm
        : d.movement.typicalLoad;
    if (eff >= 0.85) caps.force_max += 1.0 * w;
    else if (eff >= 0.7) caps.force_max += 0.5 * w;

    // Cardio long → VO2max bonus
    if (d.movement.isCardio && d.distanceM && d.distanceM >= 1000) {
      caps.vo2max += 1.0 * w;
    }
  }

  // Ajustements globaux selon durée
  // - <5 min lourd → ATP-PCr + force_max boost
  // - 5-15 min → glycolytique + endurance_force
  // - >15 min → oxydative + vo2max + endurance_force
  // - Tabata-like (intervalles courts intenses) → lactique + vo2max
  const dur = durationSec;
  let durBoost = { atp_pcr: 0, glycolytic: 0, oxidative: 0 };
  if (dur > 0 && dur < 5 * 60) {
    durBoost.atp_pcr = 0.15;
    caps.force_max += 0.4;
    caps.puissance += 0.2;
  } else if (dur < 15 * 60) {
    durBoost.glycolytic = 0.15;
    caps.endurance_force += 0.3;
    caps.lactique += 0.5;
  } else {
    durBoost.oxidative = 0.2;
    caps.vo2max += 0.4;
    caps.endurance_force += 0.3;
  }
  energy.atp_pcr += durBoost.atp_pcr;
  energy.glycolytic += durBoost.glycolytic;
  energy.oxidative += durBoost.oxidative;

  if (format === "tabata") {
    caps.lactique += 1.1;
    caps.vo2max += 0.6;
    // Tabata: bascule fortement vers glycolytique pur, réduit oxydatif
    energy.glycolytic += 0.45;
    energy.oxidative *= 0.35;
    energy.atp_pcr += 0.05;
  }
  if (format === "emom") {
    caps.lactique += 0.3;
  }
  if (format === "exmom") {
    // EXMOM (X >= 2 min) : la fenêtre permet une récupération quasi complète,
    // donc resollicitation de la filière ATP-PCr → format force / puissance.
    caps.force_max += 0.5;
    caps.puissance += 0.4;
    caps.skill += 0.2;
    energy.atp_pcr += 0.25;
    energy.glycolytic *= 0.7;
    energy.oxidative *= 0.7;
  }
  if (format === "death_by") {
    // Death by : démarrage faible volume (ATP-PCr) puis bascule glyco/lactique
    // car les minutes finales sont déclenchées à fond contre la montre.
    caps.lactique += 0.7;
    caps.endurance_force += 0.3;
    // Léger renfort puissance pour les premières minutes courtes
    caps.puissance += 0.2;
    energy.glycolytic += 0.15;
  }
  if (format === "strength") {
    caps.force_max += 0.5;
    energy.atp_pcr += 0.2;
  }
  if (format === "hyrox") {
    caps.endurance_force += 0.5;
    caps.vo2max += 0.4;
    caps.gainage += 0.2;
    energy.oxidative += 0.15;
  }

  // Normalize energetics to 100
  const e_sum = energy.atp_pcr + energy.glycolytic + energy.oxidative;
  const energetics =
    e_sum > 0
      ? {
          atp_pcr: clamp((energy.atp_pcr / e_sum) * 100),
          glycolytic: clamp((energy.glycolytic / e_sum) * 100),
          oxidative: clamp((energy.oxidative / e_sum) * 100),
        }
      : { atp_pcr: 33, glycolytic: 33, oxidative: 34 };

  // Capacities: échelle 0-100 via une scaling exponentielle douce
  // valeur brute max attendue ~2.0
  const out: Record<Capacity, number> = { ...caps };
  for (const c of CAPS) {
    const raw = caps[c];
    out[c] = clamp(Math.round(100 * (1 - Math.exp(-1.5 * raw))));
  }

  return { energetics, capacities: out };
}

function computeDuration(
  detected: DetectedMovement[],
  fmtDuration: number | null,
  fmt: WodFormat
): number {
  if (fmtDuration && fmtDuration > 0) return fmtDuration;
  // Sinon somme des durées estimées
  const sum = detected.reduce((a, d) => a + d.estimatedSeconds, 0);
  if (sum > 0) return sum;
  return 0;
}

function durationLabel(sec: number): string {
  if (sec <= 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const min = Math.floor(sec / 60);
  const s = Math.round(sec - min * 60);
  if (min < 60) return `${min} min${s > 0 ? ` ${s}s` : ""}`;
  const h = Math.floor(min / 60);
  return `${h}h${min - h * 60}min`;
}

function intensityFor(
  energetics: WodAnalysis["energetics"],
  durationSec: number,
  capacities: Record<Capacity, number>
): { value: WodAnalysis["intensity"]; label: string } {
  // intensité basée sur glycolytique + lactique + densité
  const peak = Math.max(capacities.lactique, capacities.puissance, capacities.force_max);
  const aero = capacities.vo2max;
  if (durationSec > 0 && durationSec <= 5 * 60 && (energetics.atp_pcr > 50 || peak > 70))
    return { value: "extreme", label: "Extrême" };
  if (energetics.glycolytic > 50 || capacities.lactique > 65)
    return { value: "intense", label: "Intense" };
  if (aero > 60 || durationSec > 25 * 60)
    return { value: "modere", label: "Modérée soutenue" };
  if (energetics.atp_pcr > 60) return { value: "intense", label: "Intense (max)" };
  return { value: "modere", label: "Modérée" };
}

function buildSummary(a: WodAnalysis): string {
  const e = a.energetics;
  const top = [...CAPS]
    .sort((x, y) => a.capacities[y] - a.capacities[x])
    .slice(0, 3);
  const topLabel = top.map((c) => CAPACITY_LABELS[c].toLowerCase()).join(", ");

  let energyTxt = "";
  if (e.atp_pcr > 50) energyTxt = "fortement phosphagène (ATP-PCr)";
  else if (e.glycolytic > 50) energyTxt = "majoritairement glycolytique anaérobie";
  else if (e.oxidative > 50) energyTxt = "principalement oxydatif (aérobie)";
  else if (e.glycolytic > 35 && e.oxidative > 35) energyTxt = "mixte glyco-aérobie";
  else if (e.atp_pcr > 35 && e.glycolytic > 35) energyTxt = "mixte phosphagène-glycolytique";
  else energyTxt = "mixte sur les trois filières";

  const intensite =
    a.intensity === "extreme"
      ? "Stimulus très bref et maximal"
      : a.intensity === "intense"
      ? "Stimulus intense"
      : a.intensity === "modere"
      ? "Stimulus modéré"
      : "Stimulus léger";

  return `${intensite} (${a.formatLabel}, ${a.estimatedDurationLabel}) ${energyTxt}. Sollicitation dominante : ${topLabel}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// API PUBLIQUE
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeWod(
  rawText: string,
  extraMovements: MovementDef[] = [],
  options: { deathByCapOverride?: number; exmomRoundsOverride?: number } = {}
): WodAnalysis {
  const text = normalize(rawText);
  const fmt = detectFormat(text);
  const allMovements = extraMovements.length > 0 ? [...MOVEMENTS, ...extraMovements] : MOVEMENTS;
  const matches = findAllMatches(text, allMovements);

  // Override EXMOM rounds AVANT expandWithScheme (sinon les reps sont déjà multipliées)
  if (
    fmt.format === "exmom" &&
    fmt.windowMin &&
    typeof options.exmomRoundsOverride === "number" &&
    options.exmomRoundsOverride > 0
  ) {
    const newRounds = Math.round(options.exmomRoundsOverride);
    fmt.rounds = newRounds;
    fmt.totalSec = newRounds * fmt.windowMin * 60;
  }

  const detected = expandWithScheme(matches, fmt);

  // Override Death by si l'utilisateur a fixé un cap explicite via le slider UI
  if (
    fmt.format === "death_by" &&
    detected.length > 0 &&
    typeof options.deathByCapOverride === "number" &&
    options.deathByCapOverride > 0
  ) {
    const cap = Math.round(options.deathByCapOverride);
    detected[0].reps = deathByTotalReps(cap);
    detected[0].estimatedSeconds = cap * 60;
    fmt.totalSec = cap * 60;
  }

  const duration = computeDuration(detected, fmt.totalSec, fmt.format);
  const { energetics, capacities } = computeScores(detected, duration, fmt.format);

  const intensity = intensityFor(energetics, duration, capacities);

  const dominantEnergetic = (
    Object.entries(energetics).sort(([, a], [, b]) => b - a)[0][0]
  ) as keyof WodAnalysis["energetics"];

  const topCapacities = [...CAPS]
    .sort((x, y) => capacities[y] - capacities[x])
    .slice(0, 3);

  const analysis: WodAnalysis = {
    inputText: rawText,
    format: fmt.format,
    formatLabel: FORMAT_LABELS[fmt.format],
    estimatedDurationSec: duration,
    estimatedDurationLabel: durationLabel(duration),
    intensity: intensity.value,
    intensityLabel: intensity.label,
    movements: detected,
    energetics,
    capacities,
    dominantEnergetic,
    topCapacities,
    summary: "",
    exmomWindowMin: fmt.format === "exmom" ? fmt.windowMin ?? null : null,
    exmomRounds: fmt.format === "exmom" ? fmt.rounds ?? null : null,
  };
  analysis.summary = buildSummary(analysis);
  return analysis;
}

// Exemples préchargés
export const EXAMPLES: Record<string, { name: string; text: string; desc: string }> = {
  fran: {
    name: "Fran",
    desc: "21-15-9 — Le métabolique iconique",
    text: `Fran
For Time
21-15-9
Thrusters 95lb
Pull-Ups`,
  },
  murph: {
    name: "Murph",
    desc: "Hero WOD long format",
    text: `Murph
For Time
1 mile Run
100 Pull-Ups
200 Push-Ups
300 Air Squats
1 mile Run
(avec gilet 9kg/20lb)`,
  },
  cindy: {
    name: "Cindy",
    desc: "AMRAP 20min gym",
    text: `Cindy
AMRAP 20 min
5 Pull-Ups
10 Push-Ups
15 Air Squats`,
  },
  grace: {
    name: "Grace",
    desc: "30 C&J For Time",
    text: `Grace
For Time
30 Clean and Jerk 135lb`,
  },
  helen: {
    name: "Helen",
    desc: "3 RFT cardio + gym",
    text: `Helen
3 Rounds For Time
400m Run
21 Kettlebell Swing 24kg
12 Pull-Ups`,
  },
  hyrox: {
    name: "Hyrox",
    desc: "Simulation 8 stations",
    text: `Hyrox Simulation
1km Run
1000m SkiErg
1km Run
50m Sled Push
1km Run
50m Sled Pull
1km Run
80m Burpee Broad Jump
1km Run
1000m Row
1km Run
200m Farmers Carry
1km Run
100m Sandbag Lunges
1km Run
100 Wall Balls`,
  },
  back_squat: {
    name: "5x5 Back Squat",
    desc: "Strength pure",
    text: `Back Squat
5x5 à 85% 1RM
Repos 3 min entre séries`,
  },
  tabata_row: {
    name: "Tabata Row",
    desc: "Lactique pur",
    text: `Tabata Row
8 rounds : 20s max / 10s repos
Score = total calories`,
  },
  death_by_burpee: {
    name: "Death by Burpee",
    desc: "EMOM progressif jusqu'à échec",
    text: `Death by Burpee
Min 1 : 1 burpee
Min 2 : 2 burpees
Min 3 : 3 burpees
... jusqu'à ne plus pouvoir terminer la série dans la minute.`,
  },
  e2mom_cj: {
    name: "E2MOM Clean & Jerk",
    desc: "Force / puissance avec récup entre rounds",
    text: `E2MOM 20 min
3 clean and jerk à 70%`,
  },
};
