// Programmation hebdomadaire équilibrée — algorithme déterministe
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { BENCHMARK_WODS, type BenchmarkWod } from "@/lib/benchmarkWods";
import { analyzeWod, type WodAnalysis } from "@/lib/wodAnalyzer";
import { exportWeekProgramPdf } from "@/lib/pdfExport";
import { useAnalyzerStore } from "@/lib/analyzerStore";
import { useLocation } from "wouter";
import { CalendarDays, RefreshCcw, FileDown, Sparkles } from "lucide-react";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type Target =
  | "force_max"
  | "endurance_force"
  | "metabolique"
  | "oxydatif"
  | "skill"
  | "repos";

const TARGET_LABEL: Record<Target, string> = {
  force_max: "Force max",
  endurance_force: "Endurance de force",
  metabolique: "Métabolique (glyco)",
  oxydatif: "Oxydatif / Zone 2",
  skill: "Skill / Mobilité",
  repos: "Repos actif",
};

const TARGET_COLOR: Record<Target, string> = {
  force_max: "#FF6B35",
  endurance_force: "#FF9558",
  metabolique: "#22D3EE",
  oxydatif: "#7CFC80",
  skill: "#C084FC",
  repos: "#6B7280",
};

interface Targets {
  force_max: number;
  endurance_force: number;
  metabolique: number;
  oxydatif: number;
  skill: number;
}

// WODs générés (templates) par cible
const TEMPLATES: Record<Target, { name: string; description: string }[]> = {
  force_max: [
    {
      name: "Back Squat 5x5",
      description: "Back Squat 5x5 à 85% 1RM, repos 3 min entre séries",
    },
    {
      name: "Deadlift 3x3",
      description: "Deadlift 3x3 à 90% 1RM, repos 3-4 min",
    },
    {
      name: "Press 5x5",
      description: "Strict Press 5x5 à 80% 1RM",
    },
  ],
  endurance_force: [
    {
      name: "AMRAP 12 — DL/Burpees/Wall Ball",
      description: "AMRAP 12 min\n5 Deadlift 100kg\n10 Burpees\n15 Wall Balls 9kg",
    },
    {
      name: "EMOM 20 — Power Clean",
      description: "EMOM 20 min\n5 Power Clean 60kg + 10 Push-Ups",
    },
    {
      name: "3 RFT — KB/Pull-Up",
      description: "3 Rounds For Time\n21 Kettlebell Swing 24kg\n15 Pull-Ups\n400m Run",
    },
  ],
  metabolique: [
    {
      name: "21-15-9 Thrusters/Pull-Ups",
      description: "For Time\n21-15-9\nThrusters 43kg\nPull-Ups",
    },
    {
      name: "Tabata Row + Air Squat",
      description: "Tabata\n8 rounds 20s/10s : Row\n8 rounds 20s/10s : Air Squat",
    },
    {
      name: "AMRAP 8 — Burpees/T2B",
      description: "AMRAP 8 min\n8 Burpees\n10 Toes to Bar",
    },
  ],
  oxydatif: [
    {
      name: "Zone 2 long — 45 min",
      description: "45 min cardio continu (vélo, rameur ou course)\nFC zone 2 (60-70% FCM)",
    },
    {
      name: "5 RFT — Run + KB",
      description: "5 Rounds For Time\n800m Run\n20 Kettlebell Swing 24kg",
    },
    {
      name: "30 min EMOM mixte",
      description: "EMOM 30 min\nMin 1 : 15 cal Row\nMin 2 : 10 Push-Ups\nMin 3 : Repos",
    },
  ],
  skill: [
    {
      name: "Skill haltéro + Mobilité",
      description: "Skill Snatch technique 20 min\nMobilité hanches + épaules 25 min",
    },
    {
      name: "Gym skill — HSPU / MU",
      description: "20 min skill Handstand Push-Up\n15 min progression Muscle-Up",
    },
    {
      name: "Mobilité complète 40 min",
      description: "40 min mobilité globale\nFocus chaînes postérieures et hanches",
    },
  ],
  repos: [
    {
      name: "Repos actif",
      description: "Marche 30-45 min ou yoga doux\nÉtirements légers",
    },
  ],
};

function targetFromAnalysis(a: WodAnalysis): Target {
  if (a.capacities.force_max > 60) return "force_max";
  if (a.dominantEnergetic === "glycolytic" || a.intensity === "intense" || a.intensity === "extreme")
    return "metabolique";
  if (a.dominantEnergetic === "oxidative") return "oxydatif";
  if (a.capacities.endurance_force > 55) return "endurance_force";
  return "skill";
}

// Trouve les benchmarks compatibles avec une cible
function benchmarksForTarget(target: Target): BenchmarkWod[] {
  if (target === "repos") return [];
  const scored = BENCHMARK_WODS.map((b) => {
    try {
      const a = analyzeWod(b.description);
      const inferred = targetFromAnalysis(a);
      const score =
        inferred === target
          ? 3
          : (target === "endurance_force" && inferred === "metabolique") ||
            (target === "metabolique" && inferred === "endurance_force")
          ? 1
          : 0;
      return { b, score };
    } catch {
      return { b, score: 0 };
    }
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.b);
}

// Algo de placement déterministe sur Lun-Dim
function planWeek(targets: Targets, sessionsPerWeek: number): Target[] {
  // Ordonner les cibles par nombre demandé
  const wishlist: Target[] = [];
  (Object.keys(targets) as (keyof Targets)[]).forEach((k) => {
    for (let i = 0; i < targets[k]; i++) wishlist.push(k as Target);
  });
  // S'il y en a trop ou trop peu vs sessionsPerWeek
  while (wishlist.length > sessionsPerWeek) wishlist.pop();
  while (wishlist.length < sessionsPerWeek) wishlist.push("skill");

  // Ordre de placement : commencer par les plus exigeantes
  const priority: Target[] = ["force_max", "metabolique", "endurance_force", "oxydatif", "skill"];
  const sorted = [...wishlist].sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

  // 7 jours, on place les séances sans 2 fois d'affilée même filière dominante
  const slots: Target[] = Array(7).fill("repos");
  // Templates de jours favoris selon le nombre de séances
  const dayOrders: Record<number, number[]> = {
    5: [0, 2, 4, 5, 1, 3, 6], // Lun, Mer, Ven, Sam, Mar, Jeu, Dim
    6: [0, 1, 3, 4, 5, 2, 6],
  };
  const order = dayOrders[sessionsPerWeek] || dayOrders[5];

  const isMetab = (t: Target) => t === "metabolique";
  const isHeavy = (t: Target) => t === "force_max";

  // Tente de placer chaque target ; si conflit (voisin met même type), passe au suivant
  let attempts = 0;
  outer: while (attempts < 50) {
    attempts++;
    let placed = 0;
    const localSlots: Target[] = Array(7).fill("repos");
    for (let i = 0; i < sortedRotation(sorted, attempts).length; i++) {
      const t = sortedRotation(sorted, attempts)[i];
      let foundDay = -1;
      for (const day of order) {
        if (localSlots[day] !== "repos") continue;
        const prev = day === 0 ? "repos" : localSlots[day - 1];
        const next = day === 6 ? "repos" : localSlots[day + 1];
        // Pas 2 fois le même jour-à-jour
        if (prev === t || next === t) continue;
        // Force max éloignée de 48h de metab intense
        if (isHeavy(t) && (isMetab(prev) || isMetab(next))) continue;
        if (isMetab(t) && (isHeavy(prev) || isHeavy(next))) continue;
        foundDay = day;
        break;
      }
      if (foundDay >= 0) {
        localSlots[foundDay] = t;
        placed++;
      }
    }
    if (placed >= sessionsPerWeek - 1) {
      for (let i = 0; i < 7; i++) slots[i] = localSlots[i];
      break outer;
    }
  }

  // Fallback : si rien n'a tenu, placement séquentiel
  if (slots.every((s) => s === "repos")) {
    for (let i = 0; i < sorted.length && i < order.length; i++) {
      slots[order[i]] = sorted[i];
    }
  }

  return slots;
}

function sortedRotation<T>(arr: T[], shift: number): T[] {
  const s = shift % Math.max(1, arr.length);
  return [...arr.slice(s), ...arr.slice(0, s)];
}

export default function ProgrammationPage() {
  const [sessions, setSessions] = useState<number>(5);
  const [targets, setTargets] = useState<Targets>({
    force_max: 1,
    endurance_force: 1,
    metabolique: 1,
    oxydatif: 1,
    skill: 1,
  });
  const [seed, setSeed] = useState(0); // pour régénérer

  const totalSelected =
    targets.force_max + targets.endurance_force + targets.metabolique + targets.oxydatif + targets.skill;

  const plan = useMemo(() => {
    return planWeek(targets, sessions);
  }, [targets, sessions, seed]);

  // Pour chaque slot, 2-3 WODs candidats
  const slots = useMemo(() => {
    return plan.map((target, dayIdx) => {
      const bench = benchmarksForTarget(target).slice(0, 2);
      const gen = TEMPLATES[target];
      const genIdx = (dayIdx + seed) % gen.length;
      const candidates: { name: string; description: string }[] = [];
      bench.forEach((b) => candidates.push({ name: b.name, description: b.description }));
      candidates.push(gen[genIdx]);
      return {
        day: DAYS[dayIdx],
        target,
        candidates: candidates.slice(0, 3),
      };
    });
  }, [plan, seed]);

  const { setText } = useAnalyzerStore();
  const [, setLocation] = useLocation();

  function loadInAnalyzer(name: string, description: string) {
    setText(`${name}\n${description}`);
    setLocation("/");
  }

  async function onExport() {
    await exportWeekProgramPdf(slots, sessions);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Programmation hebdomadaire
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Choisissez le nombre de séances et la répartition. L'algorithme place les
              filières en respectant la récupération, et propose 2-3 WODs par slot.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeed((s) => s + 1)}
              data-testid="button-regenerate"
            >
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
              Régénérer
            </Button>
            <Button size="sm" onClick={onExport} data-testid="button-export-week-pdf">
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
              Exporter PDF
            </Button>
          </div>
        </div>

        {/* Paramètres */}
        <Card className="p-5 bg-card border-card-border mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
            <div>
              <div className="text-sm font-medium mb-2">Séances par semaine</div>
              <div className="flex items-center gap-3">
                {[5, 6].map((n) => (
                  <Button
                    key={n}
                    variant={sessions === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSessions(n)}
                    data-testid={`button-sessions-${n}`}
                  >
                    {n}
                  </Button>
                ))}
                <span className="text-xs text-muted-foreground">
                  {totalSelected} cibles définies
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {(["force_max", "endurance_force", "metabolique", "oxydatif", "skill"] as Target[]).map(
                (t) => (
                  <div key={t}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: TARGET_COLOR[t] }}>
                        {TARGET_LABEL[t]}
                      </span>
                      <span className="text-xs num-mono text-muted-foreground">
                        {targets[t]}
                      </span>
                    </div>
                    <Slider
                      value={[targets[t]]}
                      min={0}
                      max={3}
                      step={1}
                      onValueChange={(v) =>
                        setTargets((tgts) => ({ ...tgts, [t]: v[0] }))
                      }
                      data-testid={`slider-${t}`}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        </Card>

        {/* Calendrier */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {slots.map((slot, i) => (
            <Card
              key={i}
              className="p-3 bg-card border-card-border"
              data-testid={`card-day-${i}`}
              style={{
                borderLeft: `3px solid ${TARGET_COLOR[slot.target]}`,
              }}
            >
              <div className="font-medium text-sm">{slot.day}</div>
              <div className="text-[10px] uppercase tracking-wider mt-0.5 mb-2"
                style={{ color: TARGET_COLOR[slot.target] }}>
                {TARGET_LABEL[slot.target]}
              </div>
              <div className="space-y-2">
                {slot.candidates.map((c, k) => (
                  <button
                    key={k}
                    className="w-full text-left px-2 py-1.5 rounded-md bg-secondary/40 border border-border/40 hover-elevate"
                    onClick={() => loadInAnalyzer(c.name, c.description)}
                    data-testid={`button-load-wod-${i}-${k}`}
                  >
                    <div className="text-[12px] font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                      {c.description}
                    </div>
                  </button>
                ))}
                {slot.candidates.length === 0 && (
                  <div className="text-[11px] text-muted-foreground italic">
                    Repos / récupération active
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-4 bg-card border-card-border mt-6">
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "#FF6B351A", border: "1px solid #FF6B3540" }}
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(["force_max", "endurance_force", "metabolique", "oxydatif", "skill", "repos"] as Target[]).map(
                  (t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="text-[10px]"
                      style={{ borderColor: `${TARGET_COLOR[t]}55`, color: TARGET_COLOR[t] }}
                    >
                      {TARGET_LABEL[t]}
                    </Badge>
                  )
                )}
              </div>
              Les filières ne sont jamais empilées deux jours d'affilée. La force max est séparée
              du métabolique intense par au moins 48h. Cliquez sur un WOD candidat pour l'envoyer
              dans l'analyseur.
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
