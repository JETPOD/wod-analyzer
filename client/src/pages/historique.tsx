import { useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useHistory, type SavedAnalysis } from "@/lib/HistoryContext";
import { capacityLabel, type Capacity } from "@/lib/wodAnalyzer";
import { RadarCompare, COMPARE_COLORS } from "@/components/RadarCompare";
import {
  History,
  Search,
  Download,
  Upload,
  Trash2,
  GitCompare,
  AlertTriangle,
} from "lucide-react";

const FILIERE_LABEL = {
  atp_pcr: "ATP-PCr",
  glycolytic: "Glyco",
  oxidative: "Oxydat.",
};

const CAPS: Capacity[] = [
  "force_max",
  "puissance",
  "endurance_force",
  "vo2max",
  "lactique",
  "gainage",
  "skill",
];

export default function HistoriquePage() {
  const { history, remove, clear, exportJson, importJson } = useHistory();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.rawText.toLowerCase().includes(q) ||
        h.result.formatLabel.toLowerCase().includes(q)
    );
  }, [history, query]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }

  const selectedEntries: SavedAnalysis[] = useMemo(
    () => history.filter((h) => selected.has(h.id)),
    [history, selected]
  );

  // Stats agrégées sur l'ensemble de l'historique
  const aggregate = useMemo(() => {
    if (history.length === 0) return null;
    const acc = { atp_pcr: 0, glycolytic: 0, oxidative: 0 };
    const caps: Record<Capacity, number> = {
      force_max: 0,
      puissance: 0,
      endurance_force: 0,
      vo2max: 0,
      lactique: 0,
      gainage: 0,
      skill: 0,
    };
    const dom = { atp_pcr: 0, glycolytic: 0, oxidative: 0 };
    for (const h of history) {
      acc.atp_pcr += h.result.energetics.atp_pcr;
      acc.glycolytic += h.result.energetics.glycolytic;
      acc.oxidative += h.result.energetics.oxidative;
      dom[h.result.dominantEnergetic]++;
      for (const c of CAPS) caps[c] += h.result.capacities[c];
    }
    const n = history.length;
    const out: { energetics: Record<string, number>; caps: Record<Capacity, number>; dom: Record<string, number> } = {
      energetics: {
        atp_pcr: acc.atp_pcr / n,
        glycolytic: acc.glycolytic / n,
        oxidative: acc.oxidative / n,
      },
      caps: Object.fromEntries(CAPS.map((c) => [c, caps[c] / n])) as Record<Capacity, number>,
      dom,
    };
    return out;
  }, [history]);

  const imbalances = useMemo(() => {
    if (!aggregate || history.length < 3) return [];
    const out: string[] = [];
    if (aggregate.dom.glycolytic >= 0.6 * history.length)
      out.push(
        `${aggregate.dom.glycolytic} WODs glycolytiques sur ${history.length} — pensez à varier vers du force max ou de l'oxydatif long.`
      );
    if (aggregate.caps.force_max < 30)
      out.push("Force max moyenne < 30% : peu de stimulus de force pure dans votre historique.");
    if (aggregate.caps.vo2max < 30)
      out.push("VO2max moyen < 30% : déficit de cardio long / zone 2.");
    if (aggregate.caps.skill < 25)
      out.push("Skill technique < 25% : peu de travail haltéro / gym technique.");
    return out;
  }, [aggregate, history.length]);

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportMsg(null);
    const res = await importJson(f);
    setImportMsg(
      res.ok
        ? `${res.count} analyses importées.`
        : `Erreur : ${res.error ?? "format invalide"}.`
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Historique des analyses
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {history.length} analyse{history.length > 1 ? "s" : ""} en mémoire de session ·
              Export / Import JSON pour persister entre sessions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-json"
              onClick={exportJson}
              disabled={history.length === 0}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-import-json"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              data-testid="input-import-json"
              className="hidden"
              onChange={onImportFile}
            />
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-clear-history"
                onClick={() => {
                  if (confirm("Vider tout l'historique ?")) clear();
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Vider
              </Button>
            )}
          </div>
        </div>

        {importMsg && (
          <div className="mb-4 text-xs px-3 py-2 rounded-md bg-primary/10 border border-primary/30 text-primary">
            {importMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Liste */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher dans l'historique…"
                className="pl-9"
                data-testid="input-search-history"
              />
            </div>

            {filtered.length === 0 ? (
              <Card className="p-8 text-center bg-card border-card-border">
                <p className="text-sm text-muted-foreground">
                  {history.length === 0
                    ? "Aucune analyse sauvegardée. Lancez une analyse puis « Enregistrer dans l'historique »."
                    : "Aucun résultat pour cette recherche."}
                </p>
              </Card>
            ) : (
              filtered.map((h) => (
                <Card
                  key={h.id}
                  className="p-4 bg-card border-card-border"
                  data-testid={`card-history-${h.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.has(h.id)}
                      onCheckedChange={() => toggle(h.id)}
                      data-testid={`checkbox-history-${h.id}`}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="font-medium text-sm">{h.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(h.date).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {h.result.formatLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{ borderColor: "#FF6B3555", color: "#FF6B35" }}
                        >
                          {FILIERE_LABEL[h.result.dominantEnergetic]} ·{" "}
                          {Math.round(h.result.energetics[h.result.dominantEnergetic])}%
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {h.result.estimatedDurationLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {h.result.intensityLabel}
                        </Badge>
                      </div>
                      <pre className="text-[11px] text-muted-foreground font-mono mt-2 line-clamp-2 whitespace-pre-wrap">
                        {h.rawText}
                      </pre>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      data-testid={`button-remove-${h.id}`}
                      onClick={() => remove(h.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Sidebar : comparaison + stats agrégées */}
          <div className="space-y-4">
            <Card className="p-4 bg-card border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <GitCompare className="w-4 h-4 text-primary" />
                  Comparaison ({selected.size}/4)
                </div>
                {selected.size > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(new Set())}
                    className="h-7 text-xs"
                  >
                    Tout désélectionner
                  </Button>
                )}
              </div>
              {selectedEntries.length < 2 ? (
                <p className="text-xs text-muted-foreground">
                  Cochez 2 à 4 WODs ci-contre pour superposer leur profil.
                </p>
              ) : (
                <>
                  <RadarCompare
                    series={selectedEntries.map((e, i) => ({
                      label: e.name,
                      analysis: e.result,
                      color: COMPARE_COLORS[i % COMPARE_COLORS.length],
                    }))}
                    height={300}
                  />
                  <div className="overflow-x-auto mt-3">
                    <table className="text-[11px] w-full">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left font-normal py-1">Capacité</th>
                          {selectedEntries.map((e, i) => (
                            <th
                              key={e.id}
                              className="text-right font-normal py-1"
                              style={{ color: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                            >
                              {e.name.slice(0, 10)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ["ATP-PCr", (e: SavedAnalysis) => e.result.energetics.atp_pcr],
                            ["Glyco", (e: SavedAnalysis) => e.result.energetics.glycolytic],
                            ["Oxydatif", (e: SavedAnalysis) => e.result.energetics.oxidative],
                            ...CAPS.map((c) => [
                              capacityLabel(c),
                              (e: SavedAnalysis) => e.result.capacities[c],
                            ]) as [string, (e: SavedAnalysis) => number][],
                          ] as [string, (e: SavedAnalysis) => number][]
                        ).map(([label, getter]) => (
                          <tr key={label} className="border-t border-border/30">
                            <td className="py-1 text-muted-foreground">{label}</td>
                            {selectedEntries.map((e) => (
                              <td key={e.id} className="text-right num-mono py-1">
                                {Math.round(getter(e))}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>

            {aggregate && (
              <Card className="p-4 bg-card border-card-border">
                <div className="text-sm font-medium mb-2">
                  Stats agrégées ({history.length} WODs)
                </div>
                <div className="text-xs space-y-1.5">
                  <Line label="ATP-PCr moy." v={aggregate.energetics.atp_pcr} />
                  <Line label="Glyco moy." v={aggregate.energetics.glycolytic} />
                  <Line label="Oxydat. moy." v={aggregate.energetics.oxidative} />
                  <div className="border-t border-border/30 my-1.5" />
                  {CAPS.map((c) => (
                    <Line key={c} label={capacityLabel(c)} v={aggregate.caps[c]} />
                  ))}
                </div>
                {imbalances.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                    <div className="text-xs font-medium flex items-center gap-1.5 text-yellow-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Déséquilibres détectés
                    </div>
                    {imbalances.map((m, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground">
                        • {m}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Line({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className="num-mono">{Math.round(v)}%</span>
    </div>
  );
}
