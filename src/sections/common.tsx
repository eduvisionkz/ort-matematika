import { useUI } from '../state/ui';

export const PHASE_KK: Record<string, string> = {
  wait: 'қозғалыс басталғанға дейінгі кідіріс', corridor: 'дәліз бойымен қозғалыс', stairs: 'баспалдақ', exit: 'тар учаскеден (есіктен) өту',
  done: 'аяқталды', blocked: 'өту мүмкін емес (модельде)',
  station: 'бөлімде', gather: 'жиналу', driving: 'жолда', deploying: 'су беруге дайындық', ready: 'су беруге дайын',
};

export function FormulaBtn({ id, label = 'Формула' }: { id: string; label?: string }) {
  const { openFormula } = useUI();
  return <button className="btn small ghost" onClick={() => openFormula(id)}>ƒ {label}</button>;
}
