import { useScenario } from '../state/store';
import { useUI } from '../state/ui';
import { Section, Toggle, Note } from '../components/ui';
import { ROOMS } from '../data/building';
import { PHOTOS, photosFor, photoUrl, PLAN_FOR_FLOOR } from '../data/photos';

const OBJECTS: Record<string, { name: string; text: string; link: string }> = {
  callpoint: { name: 'Қолмен іске қосылатын өрт хабарлағышы', text: 'Фотосуреттерде қызыл хабарлағыштар көрінеді. 3D-де баспалдақ кіреберістерінде көрсетілген.', link: 'callpoint' },
  exitsign: { name: '«ШЫҒУ» белгісі', text: 'Фотосуреттерде есік үстіндегі «ШЫҒУ» белгілері көрінеді.', link: 'exitsign' },
  roof: { name: 'Шатыр', text: 'Шатыр алынды — ішкі бөлмелер мен дәліздер көрінеді. Қайтару үшін «Шатырды алу» батырмасын қайта басыңыз.', link: 'roof' },
  pg: { name: 'Өрт шкафы', text: 'Орны жоспардағы «ПГ» белгісі бойынша. Фото бойынша: ақ шкаф, жоғарғы бөлікте өрт сөндіргіш, төменгі бөлікте жең.', link: 'pg' },
  facade: { name: 'Басты қасбет', text: 'Ш. Уәлиханов атындағы орта мектеп, Желтоқсан көшесі, 32. Үш қабат — фотосуреттер бойынша.', link: 'facade' },
  station: { name: 'Тұғыл өрт бөлімі', text: 'Мектепке дейін 700 м. Ғимарат фотосурет бойынша салынған, жол масштабсыз.', link: 'station' },
  hydrant: { name: 'Гидрант — су толықтыру орны', text: 'Стадион маңындағы гидрант; мектеп фотосуретінде «ПГ 50 м» белгісі бар. 3D-дегі орны схемалық. Толықтыру есебінде кіріс ағыны есепке қабылданады.', link: 'hydrant' },
  shield: { name: 'Сыртқы өрт қалқаны', text: 'Фотосуретте көрінеді.', link: 'shield' },
  kamaz: { name: 'КамАЗ АЦ-5', text: 'Есепке алынатын су — 5000 л.', link: 'kamaz' },
  ural: { name: 'Урал АЦ-6', text: 'Есепке алынатын су — 6000 л.', link: 'ural' },
  calcroom: { name: 'Есептік бөлме', text: 'Өлшемдері «Бөлме ауданы» бөлімінде беріледі. Өрт ауданы осы бөлменің ортасынан есептеледі.', link: '' },
};

export function ScenePanel() {
  const { mode, setMode } = useScenario();
  const { view, setView, selected, setSelected, openPhoto, camera, webgl } = useUI();
  const room = selected ? ROOMS.find((r) => r.id === selected) : null;
  const plan = selected?.startsWith('plan-') ? Number(selected.slice(5)) : null;
  const obj = selected && OBJECTS[selected];
  const photos = room ? photosFor(room.photoLink ?? '') : obj ? photosFor(obj.link) : plan ? PHOTOS.filter((p) => p.file === PLAN_FOR_FLOOR[plan]) : [];
  const planFloors = view.floor === 'all' ? [1, 2, 3] : [view.floor];

  return (
    <>
      <Section title="Көрініс">
        <div className="seg" role="group" aria-label="Қабат">
          {(['all', 1, 2, 3] as const).map((f) => (
            <button key={String(f)} className={`btn ${view.floor === f ? 'primary' : ''}`} onClick={() => setView({ floor: f })}>{f === 'all' ? 'Барлық қабат' : `${f}-қабат`}</button>
          ))}
        </div>
        <div className="seg">
          <button className="btn" onClick={() => camera('reset')} disabled={!webgl}>⟲ Бастапқы көрініс</button>
          <button className="btn" onClick={() => camera('top')} disabled={!webgl}>⬒ Жоғарыдан</button>
          <button className="btn" onClick={() => camera('station')} disabled={!webgl}>🚒 Өрт бөлімі</button>
          <button className="btn" onClick={() => camera('room')} disabled={!webgl}>Есептік бөлме</button>
        </div>
        <div className="toggles">
          <Toggle label="Шатырды жасыру" checked={view.hideRoof} onChange={(v) => setView({ hideRoof: v })} />
          <Toggle label="Сыртқы қабырғаларды жасыру" checked={view.hideWalls} onChange={(v) => setView({ hideWalls: v })} />
          <Toggle label="Қабаттарды ажырату" checked={view.exploded} onChange={(v) => setView({ exploded: v })} />
          <Toggle label="Маршруттарды көрсету" checked={view.showRoutes} onChange={(v) => setView({ showRoutes: v })} />
          <Toggle label="Жоспар фотосын қабат жанында көрсету" checked={view.showPlans} onChange={(v) => setView({ showPlans: v })} />
          <Toggle label="Бөлме атаулары" checked={view.showLabels} onChange={(v) => setView({ showLabels: v })} />
        </div>
        <div className="seg" role="group" aria-label="3D-де көрсетілетін есеп">
          {([['fire', 'Өрт және келу'], ['evac2', '2-қабат: эвакуация'], ['evacAll', '450 / 590 адам'], ['water', 'Су қоры'], ['refill', 'Толықтыру'], ['staff', 'Міндеттер']] as const).map(([m, l]) => (
            <button key={m} className={`btn small ${mode === m ? 'primary' : ''}`} onClick={() => setMode(m)}>{l}</button>
          ))}
        </div>
        <p className="muted small">Тінтуір: айналдыру — сол батырма, жылжыту — оң батырма, жақындату — дөңгелек. Сенсорлы экранда — бір және екі саусақ.</p>
      </Section>

      <Section title="Таңдалған нысан">
        {!selected && <p className="muted">3D сахнадағы бөлмені, ПГ, машинаны, гидрантты немесе өрт бөлімін басыңыз.</p>}
        {room && (
          <>
            <h4>{room.name} <span className="muted">· {room.floor}-қабат</span></h4>
            {room.note && <p>{room.note}</p>}
            <button className="btn ghost small" onClick={() => setSelected(null)}>Таңдауды алу</button>
          </>
        )}
        {obj && <><h4>{obj.name}</h4><p>{obj.text}</p></>}
        {plan && <><h4>{plan}-қабаттың эвакуация жоспары</h4><p>Бекітілген жоспардың фотосуреті (түпнұсқа өзгертілмеген).</p></>}
        {selected && photos.length > 0 && (
          <div className="thumbs">
            {photos.map((p) => <button key={p.file} className="thumb" onClick={() => openPhoto(p.file)} title={p.title}><img src={photoUrl(p, 'thumb', true)} alt={p.title} loading="lazy" /><span>{p.file}</span></button>)}
          </div>
        )}
        {selected && photos.length === 0 && (room || obj) && <p className="muted small">Бұл нысанмен нақты байланыстырылған фотосурет жоқ (мысалы, кабинет фотосуреттерінің нөмірі белгісіз).</p>}
      </Section>

      <Section title="Эвакуация жоспары (түпнұсқа фото)">
        <div className="thumbs">
          {planFloors.map((f) => { const p = PHOTOS.find((x) => x.file === PLAN_FOR_FLOOR[f])!; return (
            <button key={f} className="thumb" onClick={() => openPhoto(p.file)}><img src={photoUrl(p, 'thumb', true)} alt={p.title} /><span>{f}-қабат · {p.file}</span></button>
          ); })}
        </div>
      </Section>

      <Section title="Белгілер">
        <ul className="legend-list">
          <li><i className="sw" style={{ background: '#0f8b8d' }} /> 1-бағыт: дәліз → сол жақ баспалдақ → шығу</li>
          <li><i className="sw" style={{ background: '#2b6cb0' }} /> 2-бағыт: дәліз → оң жақ баспалдақ → шығу</li>
          <li><i className="sw" style={{ background: '#1f9d55' }} /> Шығу және шығып болған адамдар</li>
          <li><i className="sw" style={{ background: '#c8261c' }} /> Өрт шкафы (жоспардағы «ПГ»)</li>
          <li><i className="sw" style={{ background: '#ff6a2a' }} /> Есептік бөлмедегі өрт ауданы</li>
          <li><i className="sw" style={{ background: '#e67e22', opacity: 0.6 }} /> Мөлдір контур — жетіспейтін қызметкер</li>
          <li><i className="sw" style={{ background: '#2f8fd8' }} /> Цистернадағы су деңгейі</li>
        </ul>
        <Note>Бөлмелердің реті жоспар фотосуреттерінен алынған; өлшемдер шамамен.</Note>
      </Section>
    </>
  );
}
