import { useEffect, useMemo, useState } from 'react';
import type { Movement, Snapshot } from '../savings/types';
import { balance, formatCOP, formatMonth, monthTotals, monthlyProgress, projection, sortNewest } from '../savings/calculations';
import { MovementList } from './MovementList';
import { AnimatedMoney, Icon } from './Shared';

export function SavingsDetail({ data, today, onBack, onAdd, onWithdraw, onSelect, onPlan, newlySavedId }: {
  data: Snapshot; today: string; onBack: () => void; onAdd: () => void; onWithdraw: () => void;
  onSelect: (m: Movement) => void; onPlan: () => void; newlySavedId: string | null;
}) {
  const current = today.slice(0, 7);
  const [selected, setSelected] = useState(current);
  const months = useMemo(() => Array.from(new Set([current, ...data.movements.map((m) => m.localDate.slice(0, 7))])).sort(), [data.movements, current]);
  useEffect(() => { if (!months.includes(selected)) setSelected(current); }, [months, selected, current]);
  const index = months.indexOf(selected);
  const total = monthTotals(data.movements, selected);
  const projected = projection(data.movements, data.settings, today);
  const progress = monthlyProgress(monthTotals(data.movements, current).net, data.settings.monthlyPlanCOP);
  const expired = current > data.settings.targetEndMonth;
  return <>
    <div className="detail-heading"><button type="button" className="back-button" onClick={onBack}><Icon name="back" /> Inicio</button><h1>Alcancía</h1></div>
    <section className="detail-overview" aria-label="Saldo de la alcancía"><p className="eyebrow">Total guardado · COP</p><p className="detail-balance"><AnimatedMoney value={balance(data.movements)} /></p>
      <div className="detail-actions"><button className="button-primary" type="button" onClick={onAdd}><Icon name="plus" /> Añadir dinero</button><button type="button" className="button-secondary" onClick={onWithdraw}>Retirar dinero</button></div>
    </section>
    <section className="section-detail">
      <div className="section-title-row"><h2>Movimientos</h2></div>
      <div className="month-switcher"><button type="button" className="icon-button" disabled={index <= 0} aria-label="Mes anterior con movimientos" onClick={() => setSelected(months[index - 1])}><Icon name="left" /></button><strong>{formatMonth(selected)}</strong><button type="button" className="icon-button" disabled={index < 0 || index >= months.length - 1} aria-label="Mes siguiente con movimientos" onClick={() => setSelected(months[index + 1])}><Icon name="right" /></button></div>
      <div className="detail-stats"><div><span>Aportado</span><strong>{formatCOP(total.deposited)}</strong></div><div><span>Retirado</span><strong>{formatCOP(total.withdrawn)}</strong></div>{total.withdrawn > 0 && <div><span>Cambio neto</span><strong>{total.net < 0 ? '−' : total.net > 0 ? '+' : ''}{formatCOP(Math.abs(total.net))}</strong></div>}</div>
      <div key={selected} className="month-results"><MovementList movements={sortNewest(data.movements.filter((m) => m.localDate.startsWith(selected)))} onSelect={onSelect} today={today} newlySavedId={newlySavedId} /></div>
    </section>
    <section className="section-detail plan-detail">
      <div className="section-title-row"><h2>Plan mensual</h2><button className="text-action" type="button" onClick={onPlan}>Editar plan</button></div>
      {data.settings.monthlyPlanCOP === null ? <button type="button" className="quiet-link" onClick={onPlan}>Configura tu aporte mensual</button> : <>
        <p className="plan-amount">{formatCOP(data.settings.monthlyPlanCOP)} <span>al mes</span></p>
        {progress && <><div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)} aria-label="Progreso del plan mensual"><div style={{ width: `${progress.fraction * 100}%` }} /></div><p className="progress-description">{progress.complete ? 'Plan cumplido' : `Faltan ${formatCOP(progress.remaining)}`}</p></>}
      </>}
      <div className="projection-section"><span className="eyebrow">Julio de 2029</span>{expired ? <p className="projection-unset">Período terminado</p> : projected === null ? <p className="projection-unset">Configura tu aporte mensual</p> : <p className="projection-number"><AnimatedMoney value={projected} /></p>}
      {projected !== null && <p className="explanation">Estimación si mantienes tu plan mensual. No incluye retiros futuros.</p>}</div>
    </section>
  </>;
}
