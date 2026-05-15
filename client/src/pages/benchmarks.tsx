import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BENCHMARK_WODS, type BenchmarkCategory, type BenchmarkWod } from "@/lib/benchmarkWods";
import { analyzeWod } from "@/lib/wodAnalyzer";
import { RadarCompare, COMPARE_COLORS } from "@/components/RadarCompare";
import { useAnalyzerStore } from "@/lib/analyzerStore";
import { useLocation } from "wouter";
import { Search, Dumbbell, BookOpen, Timer, ChevronRight, GitCompare } from "lucide-react";

const CATS: { key: BenchmarkCategory | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "Girls", label: "Girls" },
  { key: "Heroes", label: "Heroes" },
  { key: "Open", label: "Open" },
];

const CAT_COLOR: Record<BenchmarkCategory, string> = {
  Girls: "#FF6B35",
  Heroes: "#C084FC",
  Open: "#22D3EE",
};

export default function BenchmarksPage() {
  const [cat, setCat] = useState<BenchmarkCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BenchmarkWod | null>(null);
  const { setText, currentAnalysis, currentRawText } = useAnalyzerStore();
  const [, setLocation] = useLocation();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BENCHMARK_WODS.filter((w) => {
      if (cat !== "all" && w.category !== cat) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        (w.notes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [cat, query]);

  const benchmarkAnalysis = useMemo(() => {
    if (!selected) return null;
    return analyzeWod(selected.description);
  }, [selected]);

  function loadInAnalyzer(b: BenchmarkWod) {
    setText(`${b.name}\n${b.description}`);
    setLocation("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Bibliothèque de benchmarks
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            42 WODs de référence (Girls, Heroes, Open). Cliquez pour comparer le profil au vôtre,
            ou chargez-le directement dans l'analyseur.
          </p>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex flex-wrap gap-1.5">
            {CATS.map((c) => (
              <Button
                key={c.key}
                size="sm"
                variant={cat === c.key ? "default" : "outline"}
                onClick={() => setCat(c.key)}
                data-testid={`filter-${c.key}`}
                className={cat === c.key ? "" : "border-border/60"}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search-benchmarks"
              placeholder="Rechercher un benchmark…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Grille de cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((w) => (
            <Card
              key={w.id}
              data-testid={`card-benchmark-${w.id}`}
              className="p-4 bg-card border-card-border flex flex-col gap-2 hover-elevate cursor-pointer"
              onClick={() => setSelected(w)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{w.name}</h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase tracking-wider"
                      style={{
                        borderColor: `${CAT_COLOR[w.category]}55`,
                        color: CAT_COLOR[w.category],
                      }}
                    >
                      {w.category}
                    </Badge>
                  </div>
                  {w.expectedDuration && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Timer className="w-3 h-3" />
                      {w.expectedDuration}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </div>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono leading-snug line-clamp-5">
                {w.description}
              </pre>
              {w.rxWeight && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/30">
                  <Dumbbell className="w-3 h-3" />
                  Rx : {w.rxWeight.men} · F : {w.rxWeight.women}
                </div>
              )}
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Aucun WOD ne correspond à votre recherche.
          </div>
        )}
      </main>

      {/* Modale de détail + comparaison */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && benchmarkAnalysis && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.name}
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{
                      borderColor: `${CAT_COLOR[selected.category]}55`,
                      color: CAT_COLOR[selected.category],
                    }}
                  >
                    {selected.category}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selected.notes || selected.expectedDuration}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <pre className="text-xs whitespace-pre-wrap font-mono bg-secondary/40 border border-border/50 rounded-md p-3">
                  {selected.description}
                </pre>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Format" value={benchmarkAnalysis.formatLabel} />
                  <Stat label="Durée est." value={benchmarkAnalysis.estimatedDurationLabel} />
                  <Stat label="Intensité" value={benchmarkAnalysis.intensityLabel} />
                </div>

                <div className="bg-card border border-border/40 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground px-2 pt-1 pb-2">
                    Radar du benchmark{currentAnalysis ? " · vs votre WOD" : ""}
                  </div>
                  <RadarCompare
                    series={[
                      ...(currentAnalysis && currentRawText
                        ? [{ label: "Mon WOD", analysis: currentAnalysis, color: COMPARE_COLORS[1] }]
                        : []),
                      { label: selected.name, analysis: benchmarkAnalysis, color: COMPARE_COLORS[0] },
                    ]}
                    height={340}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    onClick={() => loadInAnalyzer(selected)}
                    data-testid="button-load-in-analyzer"
                    className="flex-1"
                  >
                    Charger dans l'analyseur
                  </Button>
                  {currentAnalysis ? (
                    <Button
                      variant="outline"
                      data-testid="button-compare-to-mine"
                      className="flex-1"
                      onClick={() => {
                        // déjà superposé ci-dessus
                      }}
                    >
                      <GitCompare className="w-4 h-4 mr-1.5" />
                      Comparé à mon WOD ✓
                    </Button>
                  ) : (
                    <Button variant="outline" disabled className="flex-1">
                      <GitCompare className="w-4 h-4 mr-1.5" />
                      Analysez d'abord un WOD pour comparer
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/30 border border-border/50 rounded-md p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
