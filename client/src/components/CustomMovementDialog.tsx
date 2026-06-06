// Dialog formulaire guidé pour ajouter un mouvement non référencé au catalogue de session.

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { capacityLabel } from "@/lib/wodAnalyzer";
import type { MovementDef, Capacity, Category } from "@/lib/movementsDb";

const ORANGE = "#FF6B35";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "weightlifting", label: "Haltérophilie / Force" },
  { value: "gymnastics", label: "Gymnastique" },
  { value: "cardio", label: "Cardio monostructurel" },
  { value: "hyrox", label: "Hyrox" },
  { value: "core", label: "Core / Gainage" },
];

const CAPACITIES: Capacity[] = [
  "force_max",
  "puissance",
  "endurance_force",
  "vo2max",
  "lactique",
  "gainage",
  "skill",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function buildAliasesFromName(name: string): RegExp[] {
  const normalized = slugify(name).replace(/_/g, "\\s*");
  return [new RegExp(`\\b${normalized}(?:s|es)?\\b`, "i")];
}

function parseAliasesFromText(text: string, fallbackName: string): RegExp[] {
  const parts = text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return buildAliasesFromName(fallbackName);
  return parts.map((p) => {
    try {
      return new RegExp(p, "i");
    } catch {
      return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
  });
}

function loadLabel(v: number): string {
  if (v === 0) return "poids du corps";
  if (v <= 0.3) return "très léger";
  if (v <= 0.5) return "modéré";
  if (v <= 0.7) return "lourd";
  if (v >= 0.85) return "très lourd (proche 1RM)";
  return "lourd";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onAdd: (def: MovementDef) => void;
}

interface Energetics {
  atp_pcr: number;
  glycolytic: number;
  oxidative: number;
}

export function CustomMovementDialog({ open, onOpenChange, initialName = "", onAdd }: Props) {
  const [name, setName] = useState(initialName);
  const [aliasText, setAliasText] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [dominant, setDominant] = useState<Capacity | "">("");
  const [secondaries, setSecondaries] = useState<Capacity[]>([]);
  const [energetics, setEnergetics] = useState<Energetics>({
    atp_pcr: 33,
    glycolytic: 34,
    oxidative: 33,
  });
  const [typicalLoad, setTypicalLoad] = useState(0.5);
  const [secondsPerRep, setSecondsPerRep] = useState(3);
  const [isCardio, setIsCardio] = useState(false);

  // Reset when dialog opens with new initialName
  const handleOpenChange = useCallback(
    (val: boolean) => {
      if (val) {
        setName(initialName);
        setAliasText("");
        setCategory("");
        setDominant("");
        setSecondaries([]);
        setEnergetics({ atp_pcr: 33, glycolytic: 34, oxidative: 33 });
        setTypicalLoad(0.5);
        setSecondsPerRep(3);
        setIsCardio(false);
      }
      onOpenChange(val);
    },
    [initialName, onOpenChange]
  );

  // Slider répartition filières — ajuste les deux autres proportionnellement
  function handleEnergeticSlider(key: keyof Energetics, rawVal: number) {
    const val = Math.round(rawVal);
    const remaining = 100 - val;
    const others = (["atp_pcr", "glycolytic", "oxidative"] as (keyof Energetics)[]).filter(
      (k) => k !== key
    );
    const prevTotal = energetics[others[0]] + energetics[others[1]];
    let a: number, b: number;
    if (prevTotal === 0) {
      a = Math.round(remaining / 2);
      b = remaining - a;
    } else {
      a = Math.round((energetics[others[0]] / prevTotal) * remaining);
      b = remaining - a;
    }
    setEnergetics({
      ...energetics,
      [key]: val,
      [others[0]]: Math.max(0, a),
      [others[1]]: Math.max(0, b),
    });
  }

  function toggleSecondary(cap: Capacity) {
    if (cap === dominant) return; // pas de doublon avec dominante
    setSecondaries((prev) => {
      if (prev.includes(cap)) return prev.filter((c) => c !== cap);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, cap];
    });
  }

  const energeticsSum = energetics.atp_pcr + energetics.glycolytic + energetics.oxidative;
  const sumOk = Math.abs(energeticsSum - 100) <= 1;

  const isValid =
    name.trim().length > 0 &&
    category !== "" &&
    dominant !== "" &&
    sumOk;

  function handleAdd() {
    if (!isValid || category === "" || dominant === "") return;
    const slug = slugify(name.trim());
    const id = `custom_${Date.now()}_${slug}`;
    const aliases =
      aliasText.trim().length > 0
        ? parseAliasesFromText(aliasText, name.trim())
        : buildAliasesFromName(name.trim());

    const def: MovementDef = {
      id,
      name: name.trim(),
      aliases,
      category,
      dominantCapacity: dominant,
      secondaryCapacities: secondaries.filter((s) => s !== dominant),
      energetics: {
        atp_pcr: energetics.atp_pcr / 100,
        glycolytic: energetics.glycolytic / 100,
        oxidative: energetics.oxidative / 100,
      },
      typicalLoad,
      secondsPerRep,
      isCardio: isCardio || category === "cardio",
    };
    onAdd(def);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-card-border">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Ajouter un mouvement non référencé
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor="cm-name" className="text-sm font-medium">
              Nom du mouvement <span style={{ color: ORANGE }}>*</span>
            </Label>
            <Input
              id="cm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sandbag Clean"
              className="text-sm bg-background/60"
            />
          </div>

          {/* Alias regex */}
          <div className="space-y-1.5">
            <Label htmlFor="cm-aliases" className="text-sm font-medium">
              Alias regex{" "}
              <span className="text-muted-foreground font-normal">(séparés par virgule, optionnel)</span>
            </Label>
            <Input
              id="cm-aliases"
              value={aliasText}
              onChange={(e) => setAliasText(e.target.value)}
              placeholder="Ex: sandbag\\s*clean, sbc"
              className="text-sm bg-background/60 font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Laissez vide pour utiliser le nom normalisé comme pattern.
            </p>
          </div>

          {/* Catégorie */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Catégorie <span style={{ color: ORANGE }}>*</span>
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
            >
              <SelectTrigger className="text-sm bg-background/60">
                <SelectValue placeholder="Choisir une catégorie…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capacité dominante */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Capacité dominante <span style={{ color: ORANGE }}>*</span>
            </Label>
            <Select
              value={dominant}
              onValueChange={(v) => {
                setDominant(v as Capacity);
                setSecondaries((prev) => prev.filter((s) => s !== v));
              }}
            >
              <SelectTrigger className="text-sm bg-background/60">
                <SelectValue placeholder="Choisir la capacité dominante…" />
              </SelectTrigger>
              <SelectContent>
                {CAPACITIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {capacityLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capacités secondaires */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Capacités secondaires{" "}
              <span className="text-muted-foreground font-normal">(0 à 3)</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {CAPACITIES.map((cap) => {
                const isDisabled = cap === dominant;
                const isChecked = secondaries.includes(cap);
                return (
                  <div key={cap} className="flex items-center gap-2">
                    <Checkbox
                      id={`sec-${cap}`}
                      checked={isChecked}
                      disabled={isDisabled}
                      onCheckedChange={() => toggleSecondary(cap)}
                    />
                    <label
                      htmlFor={`sec-${cap}`}
                      className={`text-xs cursor-pointer ${isDisabled ? "text-muted-foreground/50" : ""}`}
                    >
                      {capacityLabel(cap)}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sliders filières */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Répartition filières énergétiques</Label>
              <span
                className="text-xs font-mono"
                style={{ color: sumOk ? ORANGE : "#ef4444" }}
              >
                {energeticsSum}% {!sumOk && "(doit être 100%)"}
              </span>
            </div>

            {(
              [
                { key: "atp_pcr" as const, label: "ATP-PCr (phosphagène)" },
                { key: "glycolytic" as const, label: "Glycolytique" },
                { key: "oxidative" as const, label: "Oxydative" },
              ] as { key: keyof Energetics; label: string }[]
            ).map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="num-mono font-medium">{energetics[key]}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[energetics[key]]}
                  onValueChange={([v]) => handleEnergeticSlider(key, v)}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {/* Charge typique */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Charge typique relative au 1RM</Label>
              <span className="text-xs text-muted-foreground">
                {typicalLoad.toFixed(2)} — {loadLabel(typicalLoad)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[typicalLoad]}
              onValueChange={([v]) => setTypicalLoad(v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Poids du corps</span>
              <span>Modéré</span>
              <span>Très lourd</span>
            </div>
          </div>

          {/* Temps par rep */}
          <div className="space-y-1.5">
            <Label htmlFor="cm-spr" className="text-sm font-medium">
              Temps moyen par rep (secondes)
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="cm-spr"
                type="number"
                min={0.1}
                max={30}
                step={0.1}
                value={secondsPerRep}
                onChange={(e) => setSecondsPerRep(Math.max(0.1, Math.min(30, parseFloat(e.target.value) || 3)))}
                className="w-24 text-sm bg-background/60 border border-input rounded-md px-3 py-1.5 text-center num-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">
                Utilisé pour estimer la durée du WOD
              </span>
            </div>
          </div>

          {/* Cardio */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <Checkbox
              id="cm-cardio"
              checked={isCardio || category === "cardio"}
              disabled={category === "cardio"}
              onCheckedChange={(v) => setIsCardio(!!v)}
            />
            <div className="space-y-0.5">
              <label htmlFor="cm-cardio" className="text-sm font-medium cursor-pointer">
                Mouvement cardio monostructurel
              </label>
              <p className="text-xs text-muted-foreground">
                Cochez si le volume est mesuré en distance ou calories (rameur, vélo, course…)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-sm"
          >
            Annuler
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!isValid}
            className="text-sm font-medium"
            style={
              isValid
                ? { background: ORANGE, color: "#fff", border: `1px solid ${ORANGE}` }
                : {}
            }
          >
            Ajouter à ma session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
