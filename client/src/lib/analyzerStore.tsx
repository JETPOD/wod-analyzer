// Context partagé pour le WOD courant (texte + dernière analyse)
// Permet aux autres pages (Benchmarks, Programmation) de référencer le WOD actif.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { analyzeWod, type WodAnalysis } from "./wodAnalyzer";
import { useCustomMovements } from "./CustomMovementsContext";
import { useBodyweight } from "./BodyweightContext";

interface AnalyzerStoreValue {
  currentRawText: string;
  currentAnalysis: WodAnalysis | null;
  setText: (text: string) => void;
  /** Définit le texte ET déclenche immédiatement l'analyse */
  loadAndAnalyze: (text: string) => void;
  clear: () => void;
  /** Ref vers le textarea WOD (attaché par home.tsx) */
  textareaRef: RefObject<HTMLTextAreaElement>;
  /** Insère du texte à la position courante du caret dans le textarea */
  insertMovement: (text: string) => void;
  /** Override du point de rupture pour un format Death by (en minutes). null = estimation auto */
  deathByCap: number | null;
  setDeathByCap: (cap: number | null) => void;
  /** Override du nombre de rounds pour un format EXMOM. null = valeur détectée par parser */
  exmomRounds: number | null;
  setExmomRounds: (rounds: number | null) => void;
  /** Overrides manuels des reps cumulées par mouvement (clé = nom du mouvement, valeur = reps) */
  repsOverrides: Record<string, number>;
  setRepsOverride: (movementName: string, reps: number) => void;
  clearRepsOverride: (movementName: string) => void;
  clearAllRepsOverrides: () => void;
}

const AnalyzerStoreContext = createContext<AnalyzerStoreValue | null>(null);

export function AnalyzerStoreProvider({ children }: { children: ReactNode }) {
  const [currentRawText, setCurrentRawText] = useState<string>("");
  const [deathByCap, setDeathByCap] = useState<number | null>(null);
  const [exmomRounds, setExmomRounds] = useState<number | null>(null);
  const [repsOverrides, setRepsOverrides] = useState<Record<string, number>>({});
  const { customMovements } = useCustomMovements();
  const { bodyweightKg } = useBodyweight();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentAnalysis = useMemo<WodAnalysis | null>(() => {
    if (!currentRawText.trim()) return null;
    try {
      return analyzeWod(currentRawText, customMovements, {
        deathByCapOverride: deathByCap ?? undefined,
        exmomRoundsOverride: exmomRounds ?? undefined,
        bodyweightKg: bodyweightKg ?? null,
        repsOverrides: Object.keys(repsOverrides).length > 0 ? repsOverrides : undefined,
      });
    } catch {
      return null;
    }
  }, [currentRawText, customMovements, deathByCap, exmomRounds, bodyweightKg, repsOverrides]);

  const setText = useCallback((text: string) => {
    setCurrentRawText(text);
    // Reset des overrides reps quand le texte change : ils sont attachés au WOD courant
    setRepsOverrides({});
  }, []);

  const loadAndAnalyze = useCallback((text: string) => {
    setCurrentRawText(text);
    setRepsOverrides({});
  }, []);

  const clear = useCallback(() => {
    setCurrentRawText("");
    setDeathByCap(null);
    setExmomRounds(null);
    setRepsOverrides({});
  }, []);

  const setRepsOverride = useCallback((movementName: string, reps: number) => {
    setRepsOverrides((prev) => ({ ...prev, [movementName]: Math.max(0, Math.round(reps)) }));
  }, []);

  const clearRepsOverride = useCallback((movementName: string) => {
    setRepsOverrides((prev) => {
      const next = { ...prev };
      delete next[movementName];
      return next;
    });
  }, []);

  const clearAllRepsOverrides = useCallback(() => {
    setRepsOverrides({});
  }, []);

  // Reset automatique du cap quand le format change vers autre chose que death_by
  // (évite de garder un cap obsolète si l'utilisateur passe à un AMRAP)
  if (deathByCap !== null && currentAnalysis && currentAnalysis.format !== "death_by") {
    setTimeout(() => setDeathByCap(null), 0);
  }
  // Idem pour EXMOM
  if (exmomRounds !== null && currentAnalysis && currentAnalysis.format !== "exmom") {
    setTimeout(() => setExmomRounds(null), 0);
  }

  const insertMovement = useCallback(
    (insertText: string) => {
      const ta = textareaRef.current;

      // Determine current text and caret position
      const current = ta ? ta.value : "";
      const selStart = ta ? (ta.selectionStart ?? current.length) : current.length;

      let prefix = "";
      if (selStart > 0) {
        // If we're not at position 0 and the char before caret is not a newline, add one
        const charBefore = current[selStart - 1];
        if (charBefore !== "\n") {
          prefix = "\n";
        }
      }

      const before = current.slice(0, selStart);
      const after = current.slice(selStart);
      const newText = before + prefix + insertText + after;
      const newCaretPos = selStart + prefix.length + insertText.length;

      // Update React state — home.tsx useEffect will sync this to its local state
      setCurrentRawText(newText);

      // After React re-renders and syncs, restore caret if textarea is focused
      if (ta) {
        setTimeout(() => {
          if (document.activeElement === ta) {
            ta.setSelectionRange(newCaretPos, newCaretPos);
          }
        }, 0);
      }
    },
    []
  );

  const value = useMemo<AnalyzerStoreValue>(
    () => ({
      currentRawText,
      currentAnalysis,
      setText,
      loadAndAnalyze,
      clear,
      textareaRef,
      insertMovement,
      deathByCap,
      setDeathByCap,
      exmomRounds,
      setExmomRounds,
      repsOverrides,
      setRepsOverride,
      clearRepsOverride,
      clearAllRepsOverrides,
    }),
    [currentRawText, currentAnalysis, setText, loadAndAnalyze, clear, textareaRef, insertMovement, deathByCap, exmomRounds, repsOverrides, setRepsOverride, clearRepsOverride, clearAllRepsOverrides]
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
