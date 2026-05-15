// Context React pour l'historique des analyses en mémoire de session.
// PAS de localStorage / sessionStorage / IndexedDB / cookies (bloqués dans le sandbox).
// Export / Import via fichier JSON.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import type { WodAnalysis } from "./wodAnalyzer";

export interface SavedAnalysis {
  id: string;
  date: string; // ISO
  name: string;
  rawText: string;
  result: WodAnalysis;
  notes?: string;
}

interface HistoryContextValue {
  history: SavedAnalysis[];
  add: (name: string, rawText: string, result: WodAnalysis, notes?: string) => SavedAnalysis;
  remove: (id: string) => void;
  clear: () => void;
  exportJson: () => void;
  importJson: (file: File) => Promise<{ ok: boolean; count: number; error?: string }>;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<SavedAnalysis[]>([]);

  const add = useCallback(
    (name: string, rawText: string, result: WodAnalysis, notes?: string) => {
      const entry: SavedAnalysis = {
        id: uuidv4(),
        date: new Date().toISOString(),
        name: name.trim() || autoName(),
        rawText,
        result,
        notes,
      };
      setHistory((h) => [entry, ...h]);
      return entry;
    },
    []
  );

  const remove = useCallback((id: string) => {
    setHistory((h) => h.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => setHistory([]), []);

  const exportJson = useCallback(() => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `wod-history-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [history]);

  const importJson = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const entries: SavedAnalysis[] = Array.isArray(data?.entries)
        ? data.entries
        : Array.isArray(data)
        ? data
        : [];
      if (entries.length === 0) {
        return { ok: false, count: 0, error: "Fichier vide ou format invalide." };
      }
      // Validation minimale
      const valid = entries.filter(
        (e) =>
          e &&
          typeof e.id === "string" &&
          typeof e.name === "string" &&
          typeof e.rawText === "string" &&
          e.result &&
          typeof e.result === "object"
      );
      setHistory((current) => {
        const existingIds = new Set(current.map((e) => e.id));
        const merged = [
          ...valid.filter((e) => !existingIds.has(e.id)),
          ...current,
        ];
        return merged;
      });
      return { ok: true, count: valid.length };
    } catch (err) {
      return {
        ok: false,
        count: 0,
        error: err instanceof Error ? err.message : "Erreur de lecture.",
      };
    }
  }, []);

  const value = useMemo<HistoryContextValue>(
    () => ({ history, add, remove, clear, exportJson, importJson }),
    [history, add, remove, clear, exportJson, importJson]
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used inside HistoryProvider");
  return ctx;
}

function autoName(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `WOD du ${day}/${month}/${year} ${h}:${m}`;
}
