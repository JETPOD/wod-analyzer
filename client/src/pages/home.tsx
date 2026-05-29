import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import {
  analyzeWod,
  capacityLabel,
  deathByTotalReps,
  estimateDeathByCap,
  EXAMPLES,
  type Capacity,
  type WodAnalysis,
} from "@/lib/wodAnalyzer";
import { MOVEMENTS } from "@/lib/movementsDb";
import type { MovementDef } from "@/lib/movementsDb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/AppHeader";
import { useHistory } from "@/lib/HistoryContext";
import { useAnalyzerStore } from "@/lib/analyzerStore";
import { useCustomMovements } from "@/lib/CustomMovementsContext";
import { computeRecovery } from "@/lib/recovery";
import { exportAnalysisPdf } from "@/lib/pdfExport";
import { useToast } from "@/hooks/use-toast";
import { CustomMovementDialog } from "@/components/CustomMovementDialog";
import { MovementsCatalog } from "@/components/MovementsCatalog";
import {
  Activity,
  Flame,
  Gauge,
  Heart,
  Sparkles,
  Timer,
  Zap,
  Save,
  FileDown,
  HeartPulse,
  Loader2,
  PlusCircle,
  X,
} from "lucide-react";

const ORANGE = "#FF6B35";
const CYAN = "#22D3EE";

const CAP_ORDER: Capacity[] = [
  "force_max",
  "puissance",
  "endurance_force",
  "vo2max",
  "lactique",
  "gainage",
  "skill",
];

const CAPACITY_DESC: Record<Capacity, string> = {
  force_max: "Charges proches du 1RM, basses reps",
  puissance: "Mouvements balistiques, olympiques",
  endurance_force: "Charges modérées, reps élevées",
  vo2max: "Endurance cardio-respiratoire",
  lactique: "Intervalles très intenses 30s-2min",
  gainage: "Stabilité tronc et posture",
  skill: "Coordination gymnastique / haltéro",
};

// ─────────────────────────────────────────────────────────────────────────────
// Détection des candidats inconnus dans le WOD
// ─────────────────────────────────────────────────────────────────────────────

// Mots-outils à ignorer lors de la détection des candidats
const STOP_WORDS = new Set([
  "amrap", "emom", "for", "time", "rounds", "round", "min", "sec", "kg", "lb",
  "lbs", "kcal", "cal", "reps", "rep", "mile", "miles", "km", "rft", "chipper",
  "tabata", "hyrox", "strength", "x", "de", "du", "la", "le", "les", "et",
  "with", "avec", "each", "chaque", "rest", "repos", "on", "off", "max",
  "score", "total", "part", "buy", "in", "out", "wod", "at", "to", "the",
  "and", "or", "into", "after", "before", "then", "per", "a", "an", "as",
  "is", "are", "be", "m", "ft", "s", "h", "run", "row", "sets", "set",
  "every", "minute", "minutes", "seconds", "second", "sprint", "slow",
  "easy", "hard", "heavy", "light", "moderate", "between", "during",
]);

function detectCandidates(text: string, allMovements: MovementDef[]): string[] {
  const candidates: string[] = [];
  const lines = text.split(/\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // La ligne doit contenir un nombre (sinon c'est probablement un titre/commentaire)
    if (!/\d/.test(trimmed)) continue;

    // Extraire les tokens textuels (≥ 3 chars, pas purement numériques)
    const tokens = trimmed
      .toLowerCase()
      .split(/[\s,;:/()\-+&×x@]+/)
      .filter((t) => t.length >= 3 && !/^\d+([.,]\d+)?$/.test(t) && !/^[%rmx]$/.test(t));

    for (const token of tokens) {
      if (STOP_WORDS.has(token)) continue;
      // Vérifier si ce token est reconnu dans le catalogue
      const isKnown = allMovements.some((mv) =>
        mv.aliases.some((rx) => {
          const r = new RegExp(rx.source, rx.flags + (rx.flags.includes("g") ? "" : "g"));
          return r.test(token);
        })
      );
      if (!isKnown && !candidates.includes(token)) {
        candidates.push(token);
      }
    }
  }

  return candidates.slice(0, 8); // Limiter à 8 candidats pour ne pas surcharger l'UI
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants UI
// ─────────────────────────────────────────────────────────────────────────────

function MetaStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold tracking-tight num-mono">{value}</div>
      {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

function BarRow({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  sub?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm num-mono text-muted-foreground">
          {Math.round(value)}
          <span className="text-xs">%</span>
        </div>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: `linear-gradient(90deg, ${color}, ${color}CC)`,
            boxShadow: `0 0 12px ${color}40`,
          }}
        />
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function RadarCapacities({ analysis }: { analysis: WodAnalysis }) {
  const data = useMemo(() => {
    const eng = analysis.energetics;
    const cap = analysis.capacities;
    return [
      { axis: "ATP-PCr", filiere: eng.atp_pcr, neuro: 0 },
      { axis: "Glycolytique", filiere: eng.glycolytic, neuro: 0 },
      { axis: "Oxydative", filiere: eng.oxidative, neuro: 0 },
      { axis: "Force max", filiere: 0, neuro: cap.force_max },
      { axis: "Puissance", filiere: 0, neuro: cap.puissance },
      { axis: "Endur. force", filiere: 0, neuro: cap.endurance_force },
      { axis: "VO2max", filiere: 0, neuro: cap.vo2max },
      { axis: "Lactique", filiere: 0, neuro: cap.lactique },
      { axis: "Gainage", filiere: 0, neuro: cap.gainage },
      { axis: "Skill", filiere: 0, neuro: cap.skill },
    ];
  }, [analysis]);

  return (
    <div id="radar-container" className="w-full h-[360px] sm:h-[420px] bg-card">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="78%">
          <PolarGrid stroke="hsl(220 13% 22%)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "hsl(220 9% 75%)", fontSize: 11 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "hsl(220 9% 50%)", fontSize: 10 }}
            stroke="hsl(220 13% 22%)"
            tickCount={5}
          />
          <Radar
            name="Filières énergétiques"
            dataKey="filiere"
            stroke={ORANGE}
            fill={ORANGE}
            fillOpacity={0.35}
            strokeWidth={2}
          />
          <Radar
            name="Capacités neuromusculaires"
            dataKey="neuro"
            stroke={CYAN}
            fill={CYAN}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(220 13% 12%)",
              border: "1px solid hsl(220 10% 20%)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(210 20% 96%)" }}
            formatter={(v: number, n: string) => [`${Math.round(v)}%`, n]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MovementBreakdownProps {
  analysis: WodAnalysis;
  wodText: string;
  allMovements: MovementDef[];
  onOpenDialog: (prefill?: string) => void;
}

function MovementBreakdown({ analysis, wodText, allMovements, onOpenDialog }: MovementBreakdownProps) {
  const { customMovements, removeCustomMovement, clearCustomMovements } = useCustomMovements();

  const candidates = useMemo(
    () => detectCandidates(wodText, allMovements),
    [wodText, allMovements]
  );

  return (
    <div className="space-y-3">
      {/* Liste mouvements détectés */}
      {analysis.movements.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Aucun mouvement reconnu. Vérifiez l'orthographe (Pull-Up, Thruster, Run, etc.).
        </div>
      ) : (
        <div className="space-y-2">
          {analysis.movements.map((m, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{m.movement.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {m.movement.category === "weightlifting"
                      ? "Haltéro"
                      : m.movement.category === "gymnastics"
                      ? "Gym"
                      : m.movement.category === "cardio"
                      ? "Cardio"
                      : m.movement.category === "core"
                      ? "Core"
                      : "Hyrox"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {m.distanceM ? `${Math.round(m.distanceM)}m` : `${m.reps} reps`}
                  {m.loadKg ? ` · ${Math.round(m.loadKg)}kg` : ""}
                  {m.loadPctRm ? ` · ${Math.round(m.loadPctRm * 100)}%RM` : ""}
                  {` · ~${Math.round(m.estimatedSeconds)}s`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium"
                  style={{
                    background: `${ORANGE}22`,
                    color: ORANGE,
                    border: `1px solid ${ORANGE}40`,
                  }}
                >
                  {capacityLabel(m.movement.dominantCapacity)}
                </span>
                {m.movement.secondaryCapacities.slice(0, 2).map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px]"
                    style={{
                      background: `${CYAN}1A`,
                      color: CYAN,
                      border: `1px solid ${CYAN}33`,
                    }}
                  >
                    {capacityLabel(s)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Candidats potentiellement non reconnus */}
      {candidates.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Mouvements potentiellement non reconnus dans votre WOD :
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((c) => (
              <button
                key={c}
                onClick={() => onOpenDialog(c)}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border border-dashed border-border hover:border-primary/60 hover:bg-secondary/60 transition-colors"
                title={`Cliquer pour classifier « ${c} »`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Liste des mouvements custom de session */}
      {customMovements.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-secondary/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Mes mouvements personnalisés (session)
            </p>
            <button
              onClick={clearCustomMovements}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
            >
              Réinitialiser
            </button>
          </div>
          <div className="space-y-1">
            {customMovements.map((mv) => (
              <div
                key={mv.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-secondary/30 border border-border/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium truncate">{mv.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {mv.category}
                  </span>
                </div>
                <button
                  onClick={() => removeCustomMovement(mv.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  aria-label={`Supprimer ${mv.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bouton toujours visible */}
      <div className="pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenDialog()}
          className="w-full text-xs text-muted-foreground border-dashed hover:border-primary/60 hover:text-foreground"
        >
          <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
          + Ajouter un mouvement non référencé
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-8 sm:p-12 text-center">
      <div
        className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `${ORANGE}1A`, border: `1px solid ${ORANGE}33` }}
      >
        <Activity className="w-6 h-6" style={{ color: ORANGE }} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight mb-2">
        Collez un WOD pour démarrer
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Le moteur détecte le format (AMRAP, EMOM, For Time, Tabata, Hyrox…), parse les mouvements,
        estime la durée et calcule un profil sur{" "}
        <span className="text-foreground font-medium">10 dimensions physiologiques</span>.
      </p>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-2xl mx-auto text-left">
        {[
          { i: <Flame className="w-3.5 h-3.5" />, t: "3 filières énergétiques" },
          { i: <Zap className="w-3.5 h-3.5" />, t: "7 capacités neuromusculaires" },
          { i: <Timer className="w-3.5 h-3.5" />, t: "Durée estimée" },
          { i: <Gauge className="w-3.5 h-3.5" />, t: "Intensité globale" },
          { i: <Sparkles className="w-3.5 h-3.5" />, t: "Synthèse profil" },
        ].map((x, k) => (
          <div
            key={k}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-secondary/30 border border-border/50"
          >
            <span style={{ color: ORANGE }}>{x.i}</span>
            <span className="truncate">{x.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { currentRawText, setText, textareaRef, deathByCap, setDeathByCap } = useAnalyzerStore();
  const { customMovements, addCustomMovement } = useCustomMovements();
  const initialText = currentRawText || EXAMPLES.fran.text;
  const [text, setLocalText] = useState<string>(initialText);
  const [submitted, setSubmitted] = useState<string>(initialText);
  const [wodName, setWodName] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPrefill, setDialogPrefill] = useState("");

  // Sync : si le store change (depuis une autre page ou insertion catalogue), recharger
  useEffect(() => {
    if (currentRawText !== text) {
      setLocalText(currentRawText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRawText]);

  // Catalogue complet incluant les mouvements custom
  const allMovements = useMemo(
    () => (customMovements.length > 0 ? [...MOVEMENTS, ...customMovements] : MOVEMENTS),
    [customMovements]
  );

  const analysis = useMemo<WodAnalysis | null>(() => {
    if (!submitted.trim()) return null;
    return analyzeWod(submitted, customMovements);
  }, [submitted, customMovements]);

  const recovery = useMemo(() => (analysis ? computeRecovery(analysis) : null), [analysis]);

  const { add: addHistory } = useHistory();
  const { toast } = useToast();

  function runAnalyze() {
    setSubmitted(text);
    setText(text);
  }

  function loadExample(key: keyof typeof EXAMPLES) {
    const ex = EXAMPLES[key];
    setLocalText(ex.text);
    setSubmitted(ex.text);
    setText(ex.text);
    setWodName(ex.name);
  }

  function onSave() {
    if (!analysis) return;
    const firstLine = submitted.trim().split("\n")[0] || "";
    const name = wodName.trim() || firstLine.slice(0, 50) || "Sans titre";
    addHistory(name, submitted, analysis);
    toast({
      title: "Enregistré dans l'historique",
      description: `« ${name} » ajouté.`,
    });
  }

  async function onExportPdf() {
    if (!analysis) return;
    setExporting(true);
    try {
      const firstLine = submitted.trim().split("\n")[0] || "";
      await exportAnalysisPdf(analysis, {
        wodName: wodName.trim() || firstLine.slice(0, 40),
        radarElementId: "radar-container",
      });
      toast({ title: "PDF généré", description: "Téléchargement lancé." });
    } catch (e) {
      toast({
        title: "Erreur PDF",
        description: e instanceof Error ? e.message : "Échec inconnu",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  function openDialog(prefill?: string) {
    setDialogPrefill(prefill || "");
    setDialogOpen(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-xl font-semibold tracking-tight">
            Analysez n'importe quel WOD en quelques secondes
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            CrossFit, Hyrox, haltérophilie ou texte libre. Profil sur 10 dimensions, sans IA —
            uniquement de la physiologie et du parsing déterministe.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          {/* COLONNE GAUCHE */}
          <div className="space-y-4">
            <Card className="p-5 bg-card border-card-border">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="wod-input" className="text-sm font-medium">
                  Saisir le WOD
                </label>
                <span className="text-xs text-muted-foreground">
                  {text.split("\n").length} ligne{text.split("\n").length > 1 ? "s" : ""}
                </span>
              </div>
              <Input
                value={wodName}
                onChange={(e) => setWodName(e.target.value)}
                placeholder="Nom du WOD (optionnel)"
                className="mb-2 text-sm"
                data-testid="input-wod-name"
              />
              <Textarea
                id="wod-input"
                data-testid="input-wod"
                ref={textareaRef}
                value={text}
                onChange={(e) => setLocalText(e.target.value)}
                placeholder={"Ex:\nFor Time\n21-15-9\nThrusters 95lb\nPull-Ups"}
                className="font-mono text-sm min-h-[240px] resize-y bg-background/60 border-border focus-visible:ring-primary"
                spellCheck={false}
              />
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button
                  onClick={runAnalyze}
                  data-testid="button-analyze"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  <Activity className="w-4 h-4 mr-1.5" />
                  Analyser
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLocalText("");
                    setSubmitted("");
                    setText("");
                  }}
                  data-testid="button-clear"
                  className="sm:w-auto"
                >
                  Effacer
                </Button>
              </div>
            </Card>

            <Card className="p-5 bg-card border-card-border">
              <div className="text-sm font-medium mb-3">Exemples préchargés</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(EXAMPLES).map(([key, ex]) => (
                  <button
                    key={key}
                    data-testid={`button-example-${key}`}
                    onClick={() => loadExample(key as keyof typeof EXAMPLES)}
                    className="text-left px-3 py-2 rounded-lg bg-secondary/40 border border-border/50 hover-elevate group"
                  >
                    <div className="text-sm font-medium group-hover:text-primary transition-colors">
                      {ex.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{ex.desc}</div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5 bg-card border-card-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" style={{ color: ORANGE }} />
                Modèle d'analyse
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• 3 filières énergétiques (ATP-PCr, glycolytique, oxydative)</li>
                <li>
                  • 7 capacités neuromusculaires (force max, puissance, endurance de force,
                  VO2max, capacité lactique, gainage, skill)
                </li>
                <li>• Pondération par durée, charge, format et catégorie de mouvement</li>
              </ul>
            </Card>
          </div>

          {/* COLONNE DROITE */}
          <div className="space-y-5">
            {!analysis ? (
              <EmptyState />
            ) : (
              <>
                {/* Actions */}
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSave}
                    data-testid="button-save-history"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Enregistrer dans l'historique
                  </Button>
                  <Button
                    size="sm"
                    onClick={onExportPdf}
                    disabled={exporting}
                    data-testid="button-export-pdf"
                  >
                    {exporting ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Exporter PDF
                  </Button>
                </div>

                {/* Header analyse */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetaStat
                    icon={<Timer className="w-3.5 h-3.5" />}
                    label="Format"
                    value={analysis.formatLabel}
                    hint={
                      analysis.format === "death_by" && analysis.movements.length > 0
                        ? `${analysis.movements[0].reps} reps cumulées`
                        : analysis.movements.length + " mouvements"
                    }
                  />
                  <MetaStat
                    icon={<Activity className="w-3.5 h-3.5" />}
                    label="Durée estimée"
                    value={analysis.estimatedDurationLabel}
                  />
                  <MetaStat
                    icon={<Gauge className="w-3.5 h-3.5" />}
                    label="Intensité"
                    value={analysis.intensityLabel}
                  />
                  <MetaStat
                    icon={<Flame className="w-3.5 h-3.5" />}
                    label="Filière dominante"
                    value={
                      analysis.dominantEnergetic === "atp_pcr"
                        ? "ATP-PCr"
                        : analysis.dominantEnergetic === "glycolytic"
                        ? "Glycolytique"
                        : "Oxydative"
                    }
                    hint={`${Math.round(analysis.energetics[analysis.dominantEnergetic])}%`}
                  />
                </div>

                {/* Bandeau Death by : slider de point de rupture */}
                {analysis.format === "death_by" && analysis.movements.length > 0 && (() => {
                  const mv = analysis.movements[0].movement;
                  const defaultCap = estimateDeathByCap(mv);
                  const currentCap = deathByCap ?? defaultCap;
                  const totalReps = deathByTotalReps(currentCap);
                  return (
                    <Card
                      className="p-5 border-card-border"
                      style={{
                        background: `${ORANGE}0F`,
                        borderColor: `${ORANGE}44`,
                      }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${ORANGE}1A`, border: `1px solid ${ORANGE}33` }}
                        >
                          <Timer className="w-4 h-4" style={{ color: ORANGE }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                            Format Death by détecté — {mv.name}
                          </div>
                          <p className="text-sm leading-relaxed text-foreground">
                            EMOM progressif : <strong>+1 rep</strong> par minute jusqu'à ne plus pouvoir terminer la série dans la minute.
                            Le point de rupture est estimé selon le profil du mouvement, ajustable ci-dessous.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="px-3 py-2 rounded-md bg-card border border-card-border">
                          <div className="text-xs text-muted-foreground">Point de rupture</div>
                          <div className="text-lg font-semibold" style={{ color: ORANGE }}>
                            {currentCap} min
                          </div>
                        </div>
                        <div className="px-3 py-2 rounded-md bg-card border border-card-border">
                          <div className="text-xs text-muted-foreground">Reps cumulées</div>
                          <div className="text-lg font-semibold">{totalReps}</div>
                          <div className="text-[10px] text-muted-foreground">1 + 2 + … + {currentCap}</div>
                        </div>
                        <div className="px-3 py-2 rounded-md bg-card border border-card-border">
                          <div className="text-xs text-muted-foreground">Estimation par défaut</div>
                          <div className="text-lg font-semibold text-muted-foreground">{defaultCap} min</div>
                          {deathByCap !== null && deathByCap !== defaultCap && (
                            <button
                              type="button"
                              onClick={() => setDeathByCap(null)}
                              className="text-[10px] underline text-muted-foreground hover:text-foreground"
                              data-testid="button-deathby-reset"
                            >
                              Réinitialiser
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Ajuster le point de rupture</span>
                          <span className="text-muted-foreground">3 – 25 min</span>
                        </div>
                        <input
                          type="range"
                          min={3}
                          max={25}
                          step={1}
                          value={currentCap}
                          onChange={(e) => setDeathByCap(parseInt(e.target.value, 10))}
                          className="w-full accent-[hsl(20_100%_60%)]"
                          style={{ accentColor: ORANGE }}
                          data-testid="slider-deathby-cap"
                          aria-label="Point de rupture estimé en minutes"
                        />
                      </div>
                    </Card>
                  );
                })()}

                {/* Synthèse */}
                <Card className="p-5 bg-card border-card-border">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${ORANGE}1A`, border: `1px solid ${ORANGE}33` }}
                    >
                      <Sparkles className="w-4 h-4" style={{ color: ORANGE }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        Synthèse du profil
                      </div>
                      <p className="text-sm leading-relaxed" data-testid="text-summary">
                        {analysis.summary}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Radar */}
                <Card className="p-5 bg-card border-card-border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium">Radar des 10 capacités</div>
                      <div className="text-xs text-muted-foreground">
                        Filières (orange) · Neuromusculaire (cyan)
                      </div>
                    </div>
                  </div>
                  <RadarCapacities analysis={analysis} />
                </Card>

                {/* Filières */}
                <Card className="p-5 bg-card border-card-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="w-4 h-4" style={{ color: ORANGE }} />
                    <div className="text-sm font-medium">Filières énergétiques</div>
                  </div>
                  <div className="space-y-3.5">
                    <BarRow
                      label="ATP-PCr (phosphagène)"
                      value={analysis.energetics.atp_pcr}
                      color={ORANGE}
                      sub="Effort max 0-10s · charges lourdes · sprints courts"
                    />
                    <BarRow
                      label="Glycolytique anaérobie"
                      value={analysis.energetics.glycolytic}
                      color="#FF9558"
                      sub="10s → 2 min · production de lactate · « burn »"
                    />
                    <BarRow
                      label="Oxydative (aérobie)"
                      value={analysis.energetics.oxidative}
                      color="#FFB07A"
                      sub="> 2 min · VO2max et endurance"
                    />
                  </div>
                </Card>

                {/* Capacités */}
                <Card className="p-5 bg-card border-card-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4" style={{ color: CYAN }} />
                    <div className="text-sm font-medium">Capacités neuromusculaires</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                    {CAP_ORDER.map((c) => (
                      <BarRow
                        key={c}
                        label={capacityLabel(c)}
                        value={analysis.capacities[c]}
                        color={CYAN}
                        sub={CAPACITY_DESC[c]}
                      />
                    ))}
                  </div>
                </Card>

                {/* Récupération */}
                {recovery && (
                  <Card className="p-5 bg-card border-card-border" data-testid="card-recovery">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${CYAN}1A`, border: `1px solid ${CYAN}33` }}
                      >
                        <HeartPulse className="w-4 h-4" style={{ color: CYAN }} />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          Récupération & suite
                        </div>
                        <div className="text-sm mt-0.5">
                          <span className="font-semibold" style={{ color: CYAN }}>
                            {recovery.hoursLabel}
                          </span>{" "}
                          avant un stimulus de profil similaire ·{" "}
                          <span className="text-muted-foreground">
                            {recovery.beforeSameFiliere}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                          Séances complémentaires
                        </div>
                        <ul className="space-y-1.5 text-sm">
                          {recovery.complementary.map((c, i) => (
                            <li key={i} className="flex gap-2 items-start">
                              <span className="text-primary mt-1">•</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {recovery.warnings.length > 0 && (
                        <div>
                          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                            Points d'attention
                          </div>
                          <ul className="space-y-1.5 text-sm">
                            {recovery.warnings.map((w, i) => (
                              <li key={i} className="flex gap-2 items-start text-yellow-300/90">
                                <span className="mt-1">⚠</span>
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Mouvements */}
                <Card className="p-5 bg-card border-card-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <div className="text-sm font-medium">
                        Décomposition mouvement par mouvement
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {analysis.movements.length} détectés
                    </Badge>
                  </div>
                  <MovementBreakdown
                    analysis={analysis}
                    wodText={submitted}
                    allMovements={allMovements}
                    onOpenDialog={openDialog}
                  />
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Catalogue des mouvements */}
        <div className="mt-6">
          <MovementsCatalog />
        </div>

        <footer className="mt-12 pt-6 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
          <span>WOD Analyzer · Moteur déterministe — aucune donnée n'est envoyée à un service externe.</span>
          <span className="hidden sm:inline">Modèle hybride filières × neuromusculaire</span>
        </footer>
      </main>

      {/* Dialog mouvement custom */}
      <CustomMovementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={dialogPrefill}
        onAdd={addCustomMovement}
      />
    </div>
  );
}
