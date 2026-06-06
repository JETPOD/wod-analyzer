// Context React pour les mouvements personnalisés de session.
// Mémoire React uniquement — effacé à F5, pas de localStorage.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { MovementDef } from "./movementsDb";

interface CustomMovementsContextValue {
  customMovements: MovementDef[];
  addCustomMovement: (def: MovementDef) => void;
  removeCustomMovement: (id: string) => void;
  clearCustomMovements: () => void;
}

const CustomMovementsContext = createContext<CustomMovementsContextValue | null>(null);

export function CustomMovementsProvider({ children }: { children: ReactNode }) {
  const [customMovements, setCustomMovements] = useState<MovementDef[]>([]);

  const addCustomMovement = useCallback((def: MovementDef) => {
    setCustomMovements((prev) => {
      // Éviter les doublons par id
      if (prev.some((m) => m.id === def.id)) return prev;
      return [...prev, def];
    });
  }, []);

  const removeCustomMovement = useCallback((id: string) => {
    setCustomMovements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearCustomMovements = useCallback(() => {
    setCustomMovements([]);
  }, []);

  const value = useMemo<CustomMovementsContextValue>(
    () => ({ customMovements, addCustomMovement, removeCustomMovement, clearCustomMovements }),
    [customMovements, addCustomMovement, removeCustomMovement, clearCustomMovements]
  );

  return (
    <CustomMovementsContext.Provider value={value}>
      {children}
    </CustomMovementsContext.Provider>
  );
}

export function useCustomMovements() {
  const ctx = useContext(CustomMovementsContext);
  if (!ctx) throw new Error("useCustomMovements must be used inside CustomMovementsProvider");
  return ctx;
}
