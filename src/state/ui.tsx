import React, { createContext, useContext } from 'react';
import type { ViewOpts } from '../three/scene';

export type SectionId = 'scene' | 'source' | 'evac' | 'arrival' | 'water' | 'staff' | 'ph' | 'compare' | 'formulas' | 'photos' | 'results';

export const SECTIONS: { id: SectionId; label: string; wide?: boolean }[] = [
  { id: 'scene', label: '3D мектеп' },
  { id: 'source', label: 'Бастапқы деректер', wide: true },
  { id: 'evac', label: 'Эвакуация' },
  { id: 'arrival', label: 'Келу уақыты' },
  { id: 'water', label: 'Су қоры' },
  { id: 'staff', label: 'Жеке құрам' },
  { id: 'ph', label: 'Адам-сағат' },
  { id: 'compare', label: 'Сценарийлерді салыстыру', wide: true },
  { id: 'formulas', label: 'Формулалар', wide: true },
  { id: 'photos', label: 'Фото және жоспарлар', wide: true },
  { id: 'results', label: 'Нәтижелер', wide: true },
];

export interface UI {
  view: ViewOpts;
  setView: (v: Partial<ViewOpts>) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  openPhoto: (file: string) => void;
  openFormula: (id: string) => void;
  go: (s: SectionId) => void;
  camera: (cmd: 'reset' | 'top' | 'station') => void;
  snapshotPNG: () => string | null;
  webgl: boolean;
}
export const UICtx = createContext<UI | null>(null);
export const useUI = () => { const c = useContext(UICtx); if (!c) throw new Error('no ui'); return c; };
export const UIProvider = ({ value, children }: { value: UI; children: React.ReactNode }) => <UICtx.Provider value={value}>{children}</UICtx.Provider>;
