import { useEffect, useRef, useState } from 'react';
import { useScenario } from '../state/store';
import { Section, Note, download } from '../components/ui';
import { compareScenarios, paramDiff, toCSV } from '../engine/tables';
import { fmt, fmtDateKk } from '../engine/num';

export function Compare() {
  const { params, slots, setSlot, replace, saved, saveCurrent, deleteSaved, notify } = useScenario();
  const [name, setName] = useState(params.name);
  useEffect(() => setName(params.name), [params.name]);
  const file = useRef<HTMLInputElement>(null);
  const A = slots.A, B = slots.B;
  const rows = A && B ? compareScenarios(A, B) : null;
  const pd = A && B ? paramDiff(A, B) : [];
  const v = (x: number | null, u: string) => (x === null ? '—' : `${fmt(x, 2)} ${u}`);

  const importJSON = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try { const data = JSON.parse(String(r.result)); replace(data.params ?? data, `«${f.name}» файлынан сценарий импортталды.`); }
      catch { notify('JSON файлын оқу мүмкін болмады: пішімі дұрыс емес.'); }
    };
    r.readAsText(f);
  };

  return (
    <>
      <Section title="Сценарийлерді сақтау">
        <div className="seg">
          <label className="field inline"><span className="field-label">Атауы</span><span className="field-input"><input value={name} onChange={(e) => setName(e.target.value)} /></span></label>
          <button className="btn primary" onClick={() => saveCurrent(name)}>Браузерде сақтау</button>
          <button className="btn" onClick={() => download(`${(name || 'scenarij').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.json`, JSON.stringify({ app: 'ort-sondiru-matematika', version: 1, params: { ...params, name } }, null, 2), 'application/json')}>JSON экспорт</button>
          <button className="btn" onClick={() => file.current?.click()}>JSON импорт</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ''; }} />
        </div>
        {saved.length === 0 ? <p className="muted">Сақталған сценарий жоқ.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Атауы</th><th>Сақталған уақыты</th><th /></tr></thead>
            <tbody>{saved.map((s, i) => (
              <tr key={i}><td>{s.name}</td><td>{fmtDateKk(new Date(s.savedAt))}</td>
                <td className="actions">
                  <button className="btn small" onClick={() => replace(s.params, `«${s.name}» жүктелді.`)}>Жүктеу</button>
                  <button className="btn small" onClick={() => setSlot('A', s.params)}>→ A</button>
                  <button className="btn small" onClick={() => setSlot('B', s.params)}>→ B</button>
                  <button className="btn small ghost" onClick={() => deleteSaved(i)}>Жою</button>
                </td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Section>

      <Section title="А және Б сценарийлері">
        <ol className="steps-hint">
          <li>Параметрлерді орнатып, <b>«Ағымдағыны А ретінде»</b> басыңыз.</li>
          <li>Параметрлерді өзгертіп, <b>«Ағымдағыны Б ретінде»</b> басыңыз.</li>
        </ol>
        <div className="seg">
          <button className="btn primary" onClick={() => { setSlot('A', { ...params, name: params.name + ' (А)' }); notify('Ағымдағы сценарий А ретінде сақталды.'); }}>Ағымдағыны А ретінде</button>
          <button className="btn primary" onClick={() => { setSlot('B', { ...params, name: params.name + ' (Б)' }); notify('Ағымдағы сценарий Б ретінде сақталды.'); }}>Ағымдағыны Б ретінде</button>
          <button className="btn" disabled={!A} onClick={() => A && replace(A, 'А сценарийі өңдеуге жүктелді.')}>А-ны өңдеу</button>
          <button className="btn" disabled={!B} onClick={() => B && replace(B, 'Б сценарийі өңдеуге жүктелді.')}>Б-ны өңдеу</button>
          <button className="btn ghost" onClick={() => { setSlot('A', null); setSlot('B', null); }}>Тазалау</button>
        </div>
        <p className="small">А: <b>{A ? A.name : 'жоқ'}</b> · Б: <b>{B ? B.name : 'жоқ'}</b></p>
        {rows && (
          <>
            <h4>Өзгерген бастапқы параметрлер</h4>
            {pd.length === 0 ? <p className="muted">Параметрлер бірдей.</p> : (
              <div className="table-wrap"><table><thead><tr><th>Параметр</th><th>А</th><th>Б</th></tr></thead>
                <tbody>{pd.map((d) => <tr key={d.path}><td><code>{d.path}</code></td><td>{d.a}</td><td>{d.b}</td></tr>)}</tbody></table></div>
            )}
            <h4>Нәтижелер</h4>
            <div className="table-wrap"><table>
              <thead><tr><th>Көрсеткіш</th><th>А</th><th>Б</th><th>Б − А</th><th>% (А-ға қатысты)</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.name}><td>{r.name}</td><td>{v(r.a, r.unit)}</td><td>{v(r.b, r.unit)}</td>
                  <td className={r.diff && r.diff !== 0 ? 'changed' : ''}>{r.diff === null ? '—' : `${r.diff > 0 ? '+' : ''}${fmt(r.diff, 2)} ${r.unit}`}</td>
                  <td>{r.diffPct === null ? (r.diff === null ? '—' : 'база 0 — % есептелмейді') : `${r.diffPct > 0 ? '+' : ''}${fmt(r.diffPct, 2)} %`}</td></tr>
              ))}</tbody>
            </table></div>
            <button className="btn" onClick={() => download('salystyru.csv', toCSV(['Көрсеткіш', 'Бірлік', 'А', 'Б', 'Б − А', '% А-ға қатысты'], rows.map((r) => [r.name, r.unit, r.a === null ? '' : fmt(r.a, 3), r.b === null ? '' : fmt(r.b, 3), r.diff === null ? '' : fmt(r.diff, 3), r.diffPct === null ? '' : fmt(r.diffPct, 2)])), 'text/csv')}>Салыстыруды CSV-ға экспорттау</button>
            <Note>Пайыздар тек А сценарийіндегі нөлдік емес мәнге қатысты есептеледі. Бір көрсеткіш бойынша сценарийді біржақты «қауіпсіз» немесе «оңтайлы» деп атауға болмайды: су, уақыт және жеке құрам — әртүрлі шектеулер.</Note>
          </>
        )}
      </Section>
    </>
  );
}
