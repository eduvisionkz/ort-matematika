import { useState } from 'react';
import { ROOMS, ROUTE_PATHS, PG_MARKERS, EXITS } from '../data/building';

/** WebGL жоқ кезде де қолжетімді жоғарыдан көрініс (схема, масштабсыз). */
export function Schematic2D({ floor: f0, selected, onPick }: { floor: 1 | 2 | 3; selected: string | null; onPick: (id: string | null) => void }) {
  const [floor, setFloor] = useState<1 | 2 | 3>(f0);
  const X = (x: number) => (x + 37) * 10;
  const Z = (z: number) => (9 - z) * 10;
  const fire: string | null = null;
  const rooms = ROOMS.filter((r) => r.floor === floor);
  const path = [...ROUTE_PATHS.r1.corridor, ...ROUTE_PATHS.r1.stairs, ROUTE_PATHS.r1.door];
  return (
    <div className="schematic">
      <div className="seg">
        {([1, 2, 3] as const).map((k) => <button key={k} className={`btn ${floor === k ? 'primary' : ''}`} onClick={() => setFloor(k)}>{k}-қабат</button>)}
      </div>
      <svg viewBox="0 0 740 330" role="img" aria-label={`${floor}-қабаттың схемасы`}>
        {rooms.map((r) => (
          <g key={r.id} onClick={() => onPick(r.id)} style={{ cursor: 'pointer' }}>
            <rect x={X(r.x[0])} y={Z(r.z[1])} width={(r.x[1] - r.x[0]) * 10} height={(r.z[1] - r.z[0]) * 10}
              fill={r.id === selected ? '#ffd8b5' : r.id === fire ? '#ffe1dc' : r.kind === 'corridor' ? '#d5e6e7' : r.kind === 'stair' ? '#e7e2d6' : '#f7f4ee'}
              stroke="#6b7280" strokeWidth={1} />
            {(r.x[1] - r.x[0]) > 4 && <text x={X((r.x[0] + r.x[1]) / 2)} y={Z((r.z[0] + r.z[1]) / 2)} fontSize={r.kind === 'stair' || r.kind === 'service' ? 8 : 10} textAnchor="middle" dominantBaseline="middle">{r.kind === 'stair' ? 'Баспалдақ' : r.name}{r.id === fire ? ' 🔥' : ''}</text>}
          </g>
        ))}
        {PG_MARKERS.filter((p) => p.floor === floor).map((p, i) => <g key={i}><rect x={X(p.x) - 7} y={Z(-3) - 6} width={14} height={10} fill="#c8261c" /><text x={X(p.x)} y={Z(-3) + 16} fontSize={9} textAnchor="middle">ПГ</text></g>)}
        {floor === 1 && EXITS.map((e) => <g key={e.id}><rect x={X(e.x) - 5} y={Z(e.z) - 5} width={10} height={10} fill="#1f9d55" /><title>{e.name}</title></g>)}
        {floor <= 2 && <polyline points={path.filter((p) => (floor === 2 ? p[1] >= 0.5 : p[1] <= 0.5)).map((p) => `${X(p[0])},${Z(p[2])}`).join(' ')} fill="none" stroke="#0f8b8d" strokeWidth={3} strokeDasharray="6 4" />}
      </svg>
      <p className="muted small">Жоспар фотосуреттері бойынша схема, масштабсыз. Сызық — 2-қабат дәлізінен баспалдақ арқылы шығу бағыты. Барлық есеп бөлімдерде жұмыс істейді.</p>
    </div>
  );
}
