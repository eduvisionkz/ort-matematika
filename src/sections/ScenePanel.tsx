import { useScenario } from '../state/store';
import { useUI } from '../state/ui';
import { Section, Toggle, Note, Tag } from '../components/ui';
import { ROOMS, EXITS } from '../data/building';
import { PHOTOS, photosFor, photoUrl, PLAN_FOR_FLOOR } from '../data/photos';
import { STATUS_LABEL } from '../engine/types';

const OBJECTS: Record<string, { name: string; text: string; link: string }> = {
  callpoint: { name: 'Қолмен іске қосылатын өрт хабарлағышы', text: 'Фотосуреттерде қызыл хабарлағыштар көрінеді. 3D-де баспалдақ кіреберістерінде шартты орында көрсетілген; жұмыс қабілеті тексерілмеген.', link: 'callpoint' },
  exitsign: { name: '«ШЫҒУ» белгісі', text: 'Фотосуреттерде есік үстіндегі «ШЫҒУ» жарық белгілері көрінеді. 3D-де эвакуация бағыттарындағы шартты орындарда.', link: 'exitsign' },
  roof: { name: 'Шатыр', text: 'Шатыр жасырылды — ішкі бөлмелер мен дәліздер көрінеді. Қайтару үшін «Шатыр жоқ» батырмасын қайта басыңыз.', link: 'roof' },
  pg: { name: 'Өрт шкафы (ішкі өрт крані, ПГ)', text: 'Орны жоспардағы «ПГ» белгісі бойынша шамамен. Фото бойынша: ақ шкаф, жоғарғы бөлікте өрт сөндіргіш, төменгі бөлікте жең. Жұмыс қабілеті тексерілмеген.', link: 'pg' },
  facade: { name: 'Басты қасбет', text: 'Үш қабат, ашық түсті қаптама, қоңыр тік элементтер, әйнектелген орталық кіреберіс — фотосуреттер бойынша.', link: 'facade' },
  station: { name: 'Өрт бөлімі', text: 'Желтоқсан көшесі, 32 (мектеп өкілінің мәліметі). Ғимарат фотосурет бойынша шартты түрде салынған; орналасуы схемалық.', link: 'station' },
  hydrant: { name: 'Шартты гидрант', text: 'Мектеп өкілінің мәліметі: стадион маңында, 50 м; фотосуретте «ПГ 50 м» белгісі. Аумақ жоспарынсыз нақты орны көрсетілмейді, өнімділігі расталмаған.', link: 'hydrant' },
  shield: { name: 'Сыртқы өрт қалқаны', text: 'Фотосуретте көрінеді. 3D-дегі орны шартты; толықтығы мен жарамдылығы расталмаған.', link: 'shield' },
  kamaz: { name: 'КАМАЗ АЦ-5 (TUGYL 16)', text: 'Шартты 3D модель фотосурет бойынша. 5000 л — АЦ-5 атауы бойынша есептік көлем. Сорғы сипаттамалары қосылмаған.', link: 'kamaz' },
  ural: { name: 'Урал АЦ-6 (үш осьті)', text: 'Шартты 3D модель фотосурет бойынша. 6000 л — АЦ-6 атауы бойынша есептік көлем («6 т су»).', link: 'ural' },
};

export function ScenePanel() {
  const { params, update } = useScenario();
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
        </div>
        <div className="toggles">
          <Toggle label="Шатырды жасыру" checked={view.hideRoof} onChange={(v) => setView({ hideRoof: v })} />
          <Toggle label="Сыртқы қабырғаларды жасыру" checked={view.hideWalls} onChange={(v) => setView({ hideWalls: v })} />
          <Toggle label="Қабаттарды ажырату" checked={view.exploded} onChange={(v) => setView({ exploded: v })} />
          <Toggle label="Маршруттарды көрсету" checked={view.showRoutes} onChange={(v) => setView({ showRoutes: v })} />
          <Toggle label="Жоспар фотосын қабат жанында көрсету" checked={view.showPlans} onChange={(v) => setView({ showPlans: v })} />
          <Toggle label="Бөлме атаулары" checked={view.showLabels} onChange={(v) => setView({ showLabels: v })} />
        </div>
        <div className="seg" role="group" aria-label="Эвакуация көрінісі">
          <button className={`btn ${params.scene.mode === 'segment' ? 'primary' : ''}`} onClick={() => update((p) => { p.scene.mode = 'segment'; })}>Бір учаске (L₁ + L₂)</button>
          <button className={`btn ${params.scene.mode === 'routes' ? 'primary' : ''}`} onClick={() => update((p) => { p.scene.mode = 'routes'; })}>Екі маршрут</button>
        </div>
        <p className="muted small">Тінтуір: айналдыру — сол батырма, жылжыту — оң батырма, жақындату — дөңгелек. Сенсорлы экранда — бір және екі саусақ.</p>
      </Section>

      <Section title="Таңдалған нысан">
        {!selected && <p className="muted">3D сахнадағы бөлмені, ПГ, машинаны, гидрантты немесе өрт бөлімін басыңыз.</p>}
        {room && (
          <>
            <h4>{room.name} <span className="muted">· {room.floor}-қабат</span></h4>
            <p><Tag s={room.status} /> {room.note}</p>
            <div className="seg">
              <button className={`btn ${params.scene.fireRoomId === room.id ? 'danger' : ''}`} onClick={() => update((p) => { p.scene.fireRoomId = p.scene.fireRoomId === room.id ? null : room.id; })}>
                {params.scene.fireRoomId === room.id ? '✕ Шартты ошақты алып тастау' : '🔥 Шартты ошақ ретінде белгілеу'}
              </button>
              <button className="btn ghost" onClick={() => setSelected(null)}>Таңдауды алу</button>
            </div>
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
          <li><i className="sw" style={{ background: '#0f8b8d' }} /> 1-маршрут / модельдік учаске (дәліз → баспалдақ → шығу)</li>
          <li><i className="sw" style={{ background: '#2b6cb0' }} /> 2-маршрут</li>
          <li><i className="sw" style={{ background: '#1f9d55' }} /> Шығу ({EXITS.length}, жоспардағы бағыттар бойынша, схемалық); шыққан адамдар</li>
          <li><i className="sw" style={{ background: '#c8261c' }} /> ПГ — өрт шкафы (бары ғана, жарамдылығы расталмаған)</li>
          <li><i className="sw" style={{ background: '#ff5a1a' }} /> Шартты ошақ (оқу мақсатында таңдалған)</li>
          <li><i className="sw" style={{ background: '#e67e22', opacity: 0.6 }} /> Қызғылт сары контур — жетіспейтін қызметкер</li>
          <li><i className="sw" style={{ background: '#1e6fd0' }} /> Жең: көк — сұралған шығын беріледі; қызғылт сары — толық берілмейді; сұр — су жоқ</li>
        </ul>
        <Note>Бөлмелердің реті жоспар фотосуреттерінен алынған; өлшемдер — шамамен. Мәртебелер: {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'clarify').map(([, v]) => v).join(', ')}.</Note>
      </Section>
    </>
  );
}
