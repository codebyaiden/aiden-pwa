import type { Snapshot } from '../savings/types';
import { balance, formatCOP, monthTotals, projection } from '../savings/calculations';
import { AnimatedMoney } from './Shared';

export function SavingsHero({ data, today, onConfigure }: { data: Snapshot; today: string; onConfigure: () => void }) {
  const total = balance(data.movements);
  const deposited = monthTotals(data.movements, today.slice(0, 7)).deposited;
  const estimate = projection(data.movements, data.settings, today);
  const expired = today.slice(0, 7) > data.settings.targetEndMonth;
  return <section className="savings-hero" aria-label="Resumen de mi alcancía">
    <p className="hero-eyebrow">En mi alcancía <span className="hero-currency">COP</span></p>
    <h1 className="hero-balance"><AnimatedMoney value={total} /></h1>
    <div className="hero-divider" />
    <div className="hero-stats">
      <div className="hero-stat"><span>Aportado este mes</span><strong><AnimatedMoney value={deposited} /></strong></div>
      <div className="hero-stat"><span>Julio de 2029</span>{estimate === null ? <button className="hero-link" onClick={onConfigure}>{expired ? 'Período terminado' : 'Configurar plan'}</button> : <strong><AnimatedMoney value={estimate} /></strong>}</div>
    </div>
  </section>;
}
