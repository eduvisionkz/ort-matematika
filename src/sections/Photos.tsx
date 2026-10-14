import { useState } from 'react';
import { PHOTOS, CAT_LABEL, PhotoCat, photoUrl } from '../data/photos';
import { useUI } from '../state/ui';
import { Section, Note } from '../components/ui';

const ORDER: PhotoCat[] = ['plans', 'facade', 'corridors', 'classrooms', 'library', 'gym', 'assembly', 'canteen', 'equipment', 'station'];

export function Photos() {
  const { openPhoto } = useUI();
  const [cat, setCat] = useState<PhotoCat | 'all'>('all');
  const [showReg, setShowReg] = useState(false);
  const cats = cat === 'all' ? ORDER : [cat];
  return (
    <>
      <div className="seg wrap">
        <button className={`btn ${cat === 'all' ? 'primary' : ''}`} onClick={() => setCat('all')}>Барлығы ({PHOTOS.filter((p) => p.cat !== 'docs').length})</button>
        {ORDER.map((c) => <button key={c} className={`btn ${cat === c ? 'primary' : ''}`} onClick={() => setCat(c)}>{CAT_LABEL[c]} ({PHOTOS.filter((p) => p.cat === c).length})</button>)}
      </div>
      {cats.map((c) => (
        <Section key={c} title={CAT_LABEL[c]}>
          <div className="gallery">
            {PHOTOS.filter((p) => p.cat === c).map((p) => (
              <button key={p.file} className="gitem" onClick={() => openPhoto(p.file)}>
                <img src={photoUrl(p, 'thumb', true)} alt={p.title} loading="lazy" />
                <span className="gt">{p.title}</span><span className="gf">{p.file}</span>
              </button>
            ))}
          </div>
        </Section>
      ))}
      <Section title="Материалдар тізілімі" right={<button className="btn small" onClick={() => setShowReg((v) => !v)}>{showReg ? 'Жасыру' : 'Көрсету'}</button>}>
        <Note>44 бастапқы сурет: 43-і ғимарат пен өрт бөлімін сипаттайды, біреуі (1000297076.jpg — жұмысты ресімдеу талаптары) модельде ғимарат немесе жабдық ретінде қолданылмайды. Түпнұсқалар өзгертілмеген; көру үшін оңтайландырылған көшірмелер жасалған, жоспарлар оқуға ыңғайлы болу үшін бөлек көшірмеде бұрылған.</Note>
        {showReg && (
          <div className="table-wrap"><table>
            <thead><tr><th>Файл</th><th>Санат</th><th>Не бейнеленген</th><th>Модельде қолданылуы</th><th>Расталатыны</th></tr></thead>
            <tbody>{PHOTOS.map((p) => <tr key={p.file}><td><code>{p.file}</code></td><td>{CAT_LABEL[p.cat]}</td><td>{p.shows}</td><td>{p.usedFor}</td><td>{p.confirms}</td></tr>)}</tbody>
          </table></div>
        )}
      </Section>
    </>
  );
}
