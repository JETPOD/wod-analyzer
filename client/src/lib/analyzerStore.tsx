// Context partagé pour le WOD courant (texte + dernière analyse)
// Permet aux autres pages (Benchmarks, Programmation) de référencer le WOD actif.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { analyzeWod, type WodAnalysis } from "./wodAnalyzer";

interface AnalyzerStoreValue {
  currentRawText: string;
  currentAnalysis: WodAnalysis | null;
  setText: (text: string) => void;
  /** Définit le texte ET déclenche immédiatement l'analyse */
  loadAndAnalyze: (text: string) => void;
  clear: () => void;
}

const AnalyzerStoreContext = createContext<AnalyzerStoreValue | null>(null);

export function AnalyzerStoreProvider({ children }: { children: ReactNode }) {
  const [currentRawText, setCurrentRawText] = useState<string>("");

  const currentAnalysis = useMemo<WodAnalysis | null>(() => {
    if (!currentRawText.trim()) return null;
    try {
      return analyzeWod(currentRawText);
    } catch {
      return null;
    }
  }, [currentRawText]);

  const setText = useCallback((text: string) => {
    setCurrentRawText(text);
  }, []);

  const loadAndAnalyze = useCallback((text: string) => {
    setCurrentRawText(text);
  }, []);

  const clear = useCallback(() => setCurrentRawText(""), []);

  const value = useMemo<AnalyzerStoreValue>(
    () => ({ currentRawText, currentAnalysis, setText, loadAndAnalyze, clear }),
    [currentRawText, currentAnalysis, setText, loadAndAnalyze, clear]
  );

  return (
    <AnalyzerStoreContext.Provider value={value}>{children}</AnalyzerStoreContext.Provider>
  );
}

export function useAnalyzerStore() {
  const ctx = useContext(AnalyzerStoreContext);
  if (!ctx) throw new Error("useAnalyzerStore must be used inside AnalyzerStoreProvider");
  return ctx;
}
