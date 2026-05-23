import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronDown, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOVEMENTS } from "@/lib/movementsDb";
import type { Capacity, Category } from "@/lib/movementsDb";
import { useAnalyzerStore } from "@/lib/analyzerStore";
import { useToast } from "@/hooks/use-toast";

// ─── Constantes de palette app ────────────────────────────────────────────────
const ORANGE = "#FF6B35";
const CYAN = "#22D3EE";
const TEAL = "#2DD4BF";

// ─── IDs des mouvements strongman ─────────────────────────────────────────────
const STRONGMAN_IDS = new Set([
  "atlas_stone",
  "yoke_walk",
  "log_press",
  "farmer_handles_heavy",
  "tire_flip",
  "sled_heavy",
  "axle_deadlift",
  "sandbag_carry",
]);

// ─── Types de filtre ──────────────────────────────────────────────────────────
type FilterKey = Category | "all" | "strongman";

interface FilterOption {
  key: FilterKey;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: "all", label: "Tous" },
  { key: "weightlifting", label: "Haltérophilie" },
  { key: "gymnastics", label: "Gymnastique" },
  { key: "cardio", label: "Cardio" },
  { key: "hyrox", label: "Hyrox" },
  { key: "core", label: "Core" },
  { key: "strongman", label: "Strongman" },
];

// ─── Traductions ──────────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<Category, string> = {
  weightlifting: "Haltérophilie",
  gymnastics: "Gymnastique",
  cardio: "Cardio",
  hyrox: "Hyrox",
  core: "Core",
};

const CAPACITY_FR: Record<Capacity, string> = {
  force_max: "Force max",
  puissance: "Puissance",
  endurance_force: "Endurance force",
  vo2max: "VO2max",
  lactique: "Lactique",
  gainage: "Gainage",
  skill: "Skill",
};

// ─── Couleurs des filières ────────────────────────────────────────────────────
const FILIERE_COLORS = {
  atp_pcr: ORANGE,
  glycolytic: CYAN,
  oxidative: TEAL,
};

const FILIERE_LABELS = {
  atp_pcr: "ATP-PCr",
  glycolytic: "Glycolytique",
  oxidative: "Oxydative",
};

// ─── Helper : extraire pattern lisible depuis le .source d'une RegExp ─────────
// Source pattern: \b<pattern>(?:s|es)?\b  → on extrait <pattern>
function extractAliasPattern(rx: RegExp): string {
  // Remove leading \b and trailing (?:s|es)?\b or (?:s)?\b etc.
  let src = rx.source;
  // Remove leading \b
  src = src.replace(/^\\b/, "");
  // Remove trailing (?:s|es)?\b or (?:s)?\b
  src = src.replace(/\(\?:s(?:\|es)?\)\?\\b$/, "");
  src = src.replace(/\(\?:es\)\?\\b$/, "");
  src = src.replace(/\\b$/, "");
  // Clean up any trailing ? left over
  src = src.replace(/\?$/, "");
  return src;
}

// ─── Calcul du label + défaut quantité pour l'insertion ──────────────────────
function getQuantityConfig(movement: typeof MOVEMENTS[number]): {
  label: string;
  defaultValue: number;
  isDistance: boolean;
} {
  const { id, category, dominantCapacity } = movement;
  const isCardioMovement = movement.isCardio || category === "cardio";

  if (isCardioMovement) {
    // Cardio: distance en mètres
    let defaultValue = 400;
    if (id === "row" || id === "ski_erg" || id === "echo_bike" || id === "bike_erg") {
      defaultValue = 500;
    } else if (id === "run") {
      defaultValue = 400;
    } else if (id === "burpee" || id === "burpee_box") {
      defaultValue = 100;
    } else if (id === "jump_rope" || id === "double_under") {
      defaultValue = 100;
    } else {
      defaultValue = 400;
    }
    return { label: "Distance (m)", defaultValue, isDistance: true };
  }

  if (category === "hyrox") {
    // Hyrox: distance en mètres avec standards Hyrox
    let defaultValue = 100;
    if (id === "sled_push") defaultValue = 50;
    else if (id === "sled_pull") defaultValue = 50;
    else if (id === "farmer") defaultValue = 200;
    else if (id === "sandbag_lunge") defaultValue = 100;
    else if (id === "burpee_broad") defaultValue = 80;
    else defaultValue = 100;
    return { label: "Distance (m)", defaultValue, isDistance: true };
  }

  // Tout le reste: reps basées sur dominantCapacity
  let defaultValue = 10;
  switch (dominantCapacity) {
    case "force_max":
      defaultValue = 5;
      break;
    case "puissance":
      defaultValue = 10;
      break;
    case "endurance_force":
      defaultValue = 15;
      break;
    case "gainage":
    case "skill":
      defaultValue = 10;
      break;
    case "vo2max":
      defaultValue = 20;
      break;
    case "lactique":
      defaultValue = 15;
      break;
    default:
      defaultValue = 10;
  }
  return { label: "Reps", defaultValue, isDistance: false };
}

// ─── Mini-prompt inline ───────────────────────────────────────────────────────
interface MiniPromptProps {
  movement: typeof MOVEMENTS[number];
  onConfirm: (qty: number) => void;
  onCancel: () => void;
}

function MiniPrompt({ movement, onConfirm, onCancel }: MiniPromptProps) {
  const config = useMemo(() => getQuantityConfig(movement), [movement]);
  const [value, setValue] = useState<string>(String(config.defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus when prompt appears
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const num = parseInt(value, 10);
      if (!isNaN(num) && num > 0) onConfirm(num);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  function handleConfirm() {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) onConfirm(num);
  }

  return (
    <div
      className="mt-2 p-2 rounded-lg border border-border/60 bg-background/80 flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {config.label}
        </label>
        <input
          ref={inputRef}
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border/60 focus:border-primary/60 pb-0.5 transition-colors"
        />
      </div>
      <button
        onClick={handleConfirm}
        className="shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
        style={{
          background: `${ORANGE}22`,
          color: ORANGE,
          border: `1px solid ${ORANGE}60`,
        }}
      >
        Ajouter
      </button>
      <button
        onClick={onCancel}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Annuler"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Carte d'un mouvement ─────────────────────────────────────────────────────
interface MovementCardProps {
  movement: typeof MOVEMENTS[number];
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onInsert: (movement: typeof MOVEMENTS[number], qty: number) => void;
}

function MovementCard({ movement, isActive, onActivate, onDeactivate, onInsert }: MovementCardProps) {
  const isStrongman = STRONGMAN_IDS.has(movement.id);
  const displayCategory = isStrongman ? "Strongman" : CATEGORY_LABEL[movement.category];

  // Aliases : extraire les patterns lisibles, limiter à 5
  const allAliases = movement.aliases.map(extractAliasPattern);
  const visibleAliases = allAliases.slice(0, 5);
  const hasMore = allAliases.length > 5;

  // Énergétiques en %
  const { atp_pcr, glycolytic, oxidative } = movement.energetics;

  return (
    <div className="rounded-xl bg-card border border-card-border p-4 space-y-3 flex flex-col min-w-0 relative">
      {/* Nom + catégorie + bouton + */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="font-semibold text-sm leading-tight truncate flex-1">{movement.name}</div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: isStrongman ? ORANGE : undefined,
              borderColor: isStrongman ? `${ORANGE}60` : undefined,
            }}
          >
            {displayCategory}
          </Badge>
          <button
            onClick={(e) => {
              e.stopPropagation();
              isActive ? onDeactivate() : onActivate();
            }}
            className="flex items-center justify-center w-5 h-5 rounded-full transition-all hover:scale-110"
            style={{
              background: isActive ? `${ORANGE}33` : `${ORANGE}15`,
              color: ORANGE,
              border: `1px solid ${ORANGE}${isActive ? "80" : "40"}`,
            }}
            aria-label={`Ajouter ${movement.name} au WOD`}
            title="Ajouter au WOD"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Mini-prompt inline */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden" }}
          >
            <MiniPrompt
              movement={movement}
              onConfirm={(qty) => onInsert(movement, qty)}
              onCancel={onDeactivate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dominante + secondaires */}
      <div className="flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium"
          style={{
            background: `${ORANGE}22`,
            color: ORANGE,
            border: `1px solid ${ORANGE}40`,
          }}
        >
          {CAPACITY_FR[movement.dominantCapacity]}
        </span>
        {movement.secondaryCapacities.map((cap) => (
          <span
            key={cap}
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px]"
            style={{
              background: `${CYAN}1A`,
              color: CYAN,
              border: `1px solid ${CYAN}33`,
            }}
          >
            {CAPACITY_FR[cap]}
          </span>
        ))}
      </div>

      {/* Filières énergétiques */}
      <div className="space-y-1.5">
        {(["atp_pcr", "glycolytic", "oxidative"] as const).map((key) => {
          const pct = Math.round(movement.energetics[key] * 100);
          if (pct === 0) return null;
          const color = FILIERE_COLORS[key];
          return (
            <div key={key} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{FILIERE_LABELS[key]}</span>
                <span className="text-[11px] num-mono text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-secondary/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                    boxShadow: `0 0 6px ${color}40`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charge typique + temps/rep */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          Charge typique :{" "}
          <span className="text-foreground font-medium num-mono">
            {Math.round(movement.typicalLoad * 100)}%
          </span>
        </span>
        <span className="text-border">·</span>
        <span>
          Temps/rep :{" "}
          <span className="text-foreground font-medium num-mono">
            {movement.secondsPerRep}s
          </span>
        </span>
      </div>

      {/* Aliases */}
      {visibleAliases.length > 0 && (
        <div className="pt-1 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
            Alias reconnus
          </p>
          <p className="text-[11px] font-mono text-muted-foreground/80 break-all">
            {visibleAliases.join(", ")}
            {hasMore && <span className="text-muted-foreground/50"> ...</span>}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────
export function MovementsCatalog() {
  const [expanded, setExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FilterKey>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { insertMovement } = useAnalyzerStore();
  const { toast } = useToast();

  const filteredMovements = useMemo(() => {
    if (selectedCategory === "all") return MOVEMENTS;
    if (selectedCategory === "strongman") {
      return MOVEMENTS.filter((m) => STRONGMAN_IDS.has(m.id));
    }
    // For weightlifting filter, exclude strongman IDs
    if (selectedCategory === "weightlifting") {
      return MOVEMENTS.filter(
        (m) => m.category === "weightlifting" && !STRONGMAN_IDS.has(m.id)
      );
    }
    return MOVEMENTS.filter((m) => m.category === selectedCategory);
  }, [selectedCategory]);

  const totalCount = MOVEMENTS.length;

  // Label du compteur dynamique
  const counterLabel = useMemo(() => {
    if (selectedCategory === "all") {
      return `Catalogue des mouvements reconnus (${totalCount})`;
    }
    const filterLabel = FILTER_OPTIONS.find((f) => f.key === selectedCategory)?.label ?? "";
    return `${filteredMovements.length} mouvement${filteredMovements.length > 1 ? "s" : ""} · catégorie ${filterLabel}`;
  }, [selectedCategory, filteredMovements.length, totalCount]);

  const handleInsert = useCallback(
    (movement: typeof MOVEMENTS[number], qty: number) => {
      const config = getQuantityConfig(movement);
      const formatted = config.isDistance
        ? `${qty}m ${movement.name}\n`
        : `${qty} ${movement.name}\n`;

      insertMovement(formatted);

      toast({
        title: `${movement.name} ajouté au WOD`,
        duration: 2000,
      });

      setActiveId(null);
    },
    [insertMovement, toast]
  );

  // Close active prompt when pressing Escape globally
  useEffect(() => {
    if (!activeId) return;
    function handleGlobalEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveId(null);
    }
    window.addEventListener("keydown", handleGlobalEsc);
    return () => window.removeEventListener("keydown", handleGlobalEsc);
  }, [activeId]);

  return (
    <Card className="bg-card border-card-border overflow-hidden">
      {/* Header bar — toujours visible, cliquable */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen
            className="w-4 h-4 shrink-0"
            style={{ color: ORANGE }}
          />
          <span className="text-sm font-medium truncate">{counterLabel}</span>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {/* Contenu collapsible */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="catalog-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5 pt-1 space-y-4">
              {/* Filtres par catégorie */}
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((opt) => {
                  const isActive = selectedCategory === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setSelectedCategory(opt.key)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all border"
                      style={
                        isActive
                          ? {
                              background: `${ORANGE}22`,
                              color: ORANGE,
                              borderColor: `${ORANGE}60`,
                            }
                          : {
                              background: "transparent",
                              color: "hsl(220 9% 55%)",
                              borderColor: "hsl(220 10% 22%)",
                            }
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Grille de cartes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredMovements.map((mv) => (
                  <MovementCard
                    key={mv.id}
                    movement={mv}
                    isActive={activeId === mv.id}
                    onActivate={() => setActiveId(mv.id)}
                    onDeactivate={() => setActiveId(null)}
                    onInsert={handleInsert}
                  />
                ))}
              </div>

              {filteredMovements.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Aucun mouvement dans cette catégorie.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
