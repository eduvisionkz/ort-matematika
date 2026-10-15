import React, { createContext, useContext } from 'react';
import type { ViewOpts } from '../three/scene';
import type { SceneMode } from '../engine/types';

export type SectionId = 'scene' | 'data' | 'area' | 'spread' | 'arrival' | 'evac' | 'school' | 'flow' | 'water' | 'refill' | 'staff' | 'conditions' | 'photos' | 'results';

export const SECTIONS: { id: SectionId; label: string; wide?: boolean; mode?: SceneMode }[] = [
  { id: 'scene', label: '3D мектеп' },
  { id: 'data', label: 'Бастапқы деректер', wide: true },
  { id: 'area', label: 'Бөлме ауданы', mode: 'fire' },
  { id: 'spread', label: 'Өрттің таралуы', mode: 'fire' },
  { id: 'arrival', label: 'Келу уақыты', mode: 'fire' },
  { id: 'evac', label: '2-қабаттан эвакуация', mode: 'evac2' },
  { id: 'school', label: '450 / 590 адам', mode: 'evacAll' },
  { id: 'flow', label: 'Су шығыны', mode: 'fire' },
  { id: 'water', label: 'Су қоры', mode: 'water' },
  { id: 'refill', label: 'Толықтыру', mode: 'refill' },
  { id: 'staff', label: 'Қызметкерлер', mode: 'staff' },
  { id: 'conditions', label: 'Есептеу шарттары', wide: true },
  { id: 'photos', label: 'Фото және жоспарлар', wide: true },
  { id: 'results', label: 'Нәтижелер', wide: true },
];

export interface UI {
  view: ViewOpts;
  setView: (v: Partial<ViewOpts>) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  openPhoto: (file: string) => void;
  go: (s: SectionId) => void;
  camera: (cmd: 'reset' | 'top' | 'station' | 'room' | 'trucks') => void;
  snapshotPNG: () => string | null;
  webgl: boolean;
}
export const UICtx = createContext<UI | null>(null);
export const useUI = () => { const c = useContext(UICtx); if (!c) throw new Error('no ui'); return c; };
export const UIProvider = ({ value, children }: { value: UI; children: React.ReactNode }) => <UICtx.Provider value={value}>{children}</UICtx.Provider>;
