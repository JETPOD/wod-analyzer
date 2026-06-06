// Contexte global du poids du corps (BW) de l'athlète.
// Persisté en localStorage pour rester entre les sessions navigateur.
// Sert au calcul du %1RM théorique à partir d'une charge absolue (kg) et du
// loadRatioReference de chaque mouvement (cf. movementsDb.ts).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "wod-analyzer:bodyweight-kg";

interface BodyweightContextValue {
  /** Poids du corps en kg, ou null si l'athlète n'a pas renseigné de valeur. */
  bodyweightKg: number | null;
  setBodyweightKg: (kg: number | null) => void;
  /** Vrai si l'athlète a renseigné un poids valide (> 20 et < 300). */
  hasBodyweight: boolean;
}

const BodyweightContext = createContext<BodyweightContextValue | null>(null);

export function BodyweightProvider({ children }: { children: ReactNode }) {
  const [bodyweightKg, setBwInternal] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const v = parseFloat(stored);
      if (Number.isFinite(v) && v > 20 && v < 300) return v;
      return null;
    } catch {
      return null;
    }
  });

  const setBodyweightKg = useCallback((kg: number | null) => {
    setBwInternal(kg);
    try {
      if (kg === null || !Number.isFinite(kg)) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, String(kg));
      }
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const hasBodyweight = bodyweightKg !== null && bodyweightKg > 20 && bodyweightKg < 300;

  const value = useMemo<BodyweightContextValue>(
    () => ({ bodyweightKg, setBodyweightKg, hasBodyweight }),
    [bodyweightKg, setBodyweightKg, hasBodyweight]
  );

  return <BodyweightContext.Provider value={value}>{children}</BodyweightContext.Provider>;
}

export function useBodyweight() {
  const ctx = useContext(BodyweightContext);
  if (!ctx) throw new Error("useBodyweight must be used inside BodyweightProvider");
  return ctx;
}
