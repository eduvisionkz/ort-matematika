import { FormulaCard } from '../engine/formulas';
import { Tag } from './ui';

export function FormulaCardView({ c }: { c: FormulaCard }) {
  return (
    <article className="fcard" id={`f-${c.id}`}>
      <header><span className="muted small">{c.section}</span><h4>{c.title}</h4></header>
      <ol className="fsteps">
        <li><b>Бастапқы деректер</b>
          <ul>{c.inputs.map((i, k) => <li key={k}>{i.name}: <b>{i.value}</b></li>)}</ul>
        </li>
        <li><b>Деректер мәртебесі</b>
          <div className="tags">{[...new Set(c.inputs.map((i) => i.status))].map((s) => <Tag key={s} s={s} />)}</div>
        </li>
        <li><b>Формула</b><div className="formula">{c.formula}</div><div className="muted small">{c.legend}</div></li>
        <li><b>Сандарды қою</b><div className="formula sub">{c.substitution}</div></li>
        <li><b>Нәтиже</b> <Tag s="result" short /><div className="formula res">{c.result}</div></li>
        <li><b>Модельдік шектеулер</b><p className="small">{c.limits}</p></li>
      </ol>
    </article>
  );
}
