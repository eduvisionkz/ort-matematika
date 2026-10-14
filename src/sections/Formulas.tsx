import { useMemo } from 'react';
import { useScenario } from '../state/store';
import { formulaCards } from '../engine/formulas';
import { FormulaCardView } from '../components/FormulaCardView';
import { Note } from '../components/ui';

export function Formulas() {
  const { results } = useScenario();
  const cards = useMemo(() => formulaCards(results), [results]);
  return (
    <>
      <Note>Әр карточка ағымдағы параметрлерден қайта есептеледі. Есептеулерде толық дәлдік сақталады, тек көрсетілетін нәтиже дөңгелектенеді. Секундтар мен минуттар түрлендірусіз қосылмайды: 1 мин = 60 с; Q л/с шығыны 1 минутта 60·Q литр береді.</Note>
      <div className="fgrid">{cards.map((c) => <FormulaCardView key={c.id} c={c} />)}</div>
    </>
  );
}
