// Context partagé pour le WOD courant (texte + dernière analyse)
// Permet aux autres pages (Benchmarks, Programmation) de référencer le WOD actif.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { analyzeWod, type WodAnalysis } from "./wodAnalyzer";
import { useCustomMovements } from "./CustomMovementsContext";

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
}

const AnalyzerStoreContext = createContext<AnalyzerStoreValue | null>(null);

export function AnalyzerStoreProvider({ children }: { children: ReactNode }) {
  const [currentRawText, setCurrentRawText] = useState<string>("");
  const { customMovements } = useCustomMovements();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentAnalysis = useMemo<WodAnalysis | null>(() => {
    if (!currentRawText.trim()) return null;
    try {
      return analyzeWod(currentRawText, customMovements);
    } catch {
      return null;
    }
  }, [currentRawText, customMovements]);

  const setText = useCallback((text: string) => {
    setCurrentRawText(text);
  }, []);

  const loadAndAnalyze = useCallback((text: string) => {
    setCurrentRawText(text);
  }, []);

  const clear = useCallback(() => setCurrentRawText(""), []);

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
    () => ({ currentRawText, currentAnalysis, setText, loadAndAnalyze, clear, textareaRef, insertMovement }),
    [currentRawText, currentAnalysis, setText, loadAndAnalyze, clear, textareaRef, insertMovement]
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
