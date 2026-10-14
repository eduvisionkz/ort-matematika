import { useState } from 'react';
import { PHOTOS, photoUrl, CAT_LABEL } from '../data/photos';
import { Modal } from './ui';

export function PhotoViewer({ file, onClose, onNav }: { file: string; onClose: () => void; onNav: (f: string) => void }) {
  const p = PHOTOS.find((x) => x.file === file);
  const [rot, setRot] = useState(0);
  const [readable, setReadable] = useState(true);
  if (!p) return null;
  const same = PHOTOS.filter((x) => x.cat === p.cat);
  const i = same.indexOf(p);
  return (
    <Modal title={`${p.title} — ${p.file}`} onClose={onClose} wide>
      <div className="viewer">
        <div className="viewer-img">
          <img src={photoUrl(p, 'web', readable)} alt={p.title} style={{ transform: `rotate(${rot}deg)` }} />
        </div>
        <div className="viewer-side">
          <div className="seg">
            <button className="btn" onClick={() => onNav(same[(i - 1 + same.length) % same.length].file)}>← Алдыңғы</button>
            <button className="btn" onClick={() => onNav(same[(i + 1) % same.length].file)}>Келесі →</button>
          </div>
          <div className="seg">
            <button className="btn" onClick={() => setRot((r) => (r + 90) % 360)}>↻ 90° бұру</button>
            {p.rotated && <button className="btn" onClick={() => setReadable((v) => !v)}>{readable ? 'Түпнұсқа бағыт' : 'Оқуға ыңғайлы'}</button>}
            <a className="btn" href={photoUrl(p, 'original')} target="_blank" rel="noreferrer">Түпнұсқа файл</a>
          </div>
          <dl className="meta">
            <dt>Бастапқы файл</dt><dd><code>{p.folder}/{p.file}</code></dd>
            <dt>Санат</dt><dd>{CAT_LABEL[p.cat]}</dd>
            <dt>Не бейнеленген</dt><dd>{p.shows}</dd>
            <dt>Модельде қолданылуы</dt><dd>{p.usedFor}</dd>
            <dt>Фото бойынша расталатыны</dt><dd>{p.confirms}</dd>
          </dl>
          {p.rotated && <p className="muted small">Жоспар оқуға ыңғайлы болу үшін бөлек көшірмеде бұрылған; түпнұсқа өзгертілмеген. Бұл — бекітілген жоспардың фотосуреті, оның орнына ойдан шығарылған ресми схема қолданылмайды.</p>}
          {p.people && <p className="muted small">Суретте адамдар бар — жария ету алдында келісімді тексеріңіз.</p>}
        </div>
      </div>
    </Modal>
  );
}
