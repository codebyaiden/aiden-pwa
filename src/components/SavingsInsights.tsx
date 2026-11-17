import { useEffect, useMemo, useState } from 'react';
import type { Movement, Snapshot } from '../savings/types';
import { balance, formatCOP, formatMonth, goalMetrics, lastSixMonths, monthsRemainingToGoal, projection, projectionForPlan, savingsStreak } from '../savings/calculations';
import { parsePlanInput } from '../savings/validation';
import { AnimatedMoney } from './Shared';

export function StreakIndicator({ movements, today, celebrate = false, compact = false }: {
  movements: Movement[]; today: string; celebrate?: boolean; compact?: boolean;
}) {
  const streak = savingsStreak(movements, today);
  if (streak.months === 0) return null;
  return <div className={`streak-indicator ${compact ? 'streak-compact' : ''}`} aria-label={`${streak.months} ${streak.months === 1 ? 'mes' : 'meses'} consecutivos con depósitos. ${streak.status === 'pending' ? 'Pendiente de continuar este mes.' : 'Activo este mes.'}`}>
    <svg className={`streak-fire ${celebrate ? 'streak-earned' : ''}`} viewBox="0 0 32 36" width="23" height="26" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M17 2c1 7-3 9-4 14-3-3-2-6-2-8C4 14 3 19 5 25c2 6 7 9 12 9s11-4 11-11c0-5-3-9-6-12 0 4-2 6-4 7 1-6 2-10-1-16Z" />
      <path d="M17 23c-2 2-4 4-3 7 1 2 5 3 7 0 1-2 0-5-2-8-.2 2-.9 2.5-2 3" />
    </svg>
    <span><strong>{streak.months} {streak.months === 1 ? 'mes' : 'meses'}</strong>{!compact && <small>{streak.status === 'pending' ? 'Pendiente este mes' : 'Racha activa'}</small>}</span>
  </div>;
}

export function MonthlyChart({ movements, today }: { movements: Movement[]; today: string }) {
  const months = useMemo(() => lastSixMonths(movements, today), [movements, today]);
  const [selected, setSelected] = useState(() => months.slice().reverse().find((m) => m.deposited > 0)?.month ?? months[5].month);
  useEffect(() => { if (!months.some((m) => m.month === selected)) setSelected(months[5].month); }, [months, selected]);
  if (movements.length === 0) return <p className="empty-detail">La gráfica aparecerá después de tu primer aporte.</p>;
  const max = Math.max(1, ...months.map((m) => m.deposited));
  const current = months.find((m) => m.month === selected) ?? months[5];
  const fmtMonth = (month: string) => new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`)).replace('.', '');
  return <div className="chart-content">
    <div className="chart-readout" role="status" aria-live="polite"><span>{formatMonth(current.month)}</span><strong>{formatCOP(current.deposited)}</strong></div>
    <div className="monthly-chart" role="group" aria-label="Aportes de los últimos seis meses. Selecciona un mes para consultar su valor exacto.">
      {months.map((m) => <button type="button" key={m.month} className={`chart-column ${current.month === m.month ? 'chart-selected' : ''}`} onClick={() => setSelected(m.month)} aria-pressed={current.month === m.month} aria-label={`${formatMonth(m.month)}: ${formatCOP(m.deposited)} aportados`}>
        <span className="chart-track"><span className="chart-bar" style={{ height: `${m.deposited === 0 ? 0 : Math.max(3, 100 * m.deposited / max)}%` }} /></span>
        <span className="chart-month">{fmtMonth(m.month)}</span>
      </button>)}
    </div>
    <p className="chart-caption">Aportes reales, sin descontar retiros.</p>
  </div>;
}

export function FinalGoal({ data, today, onEdit }: { data: Snapshot; today: string; onEdit: () => void }) {
  const estimate = projection(data.movements, data.settings, today);
  const metrics = goalMetrics(data.movements, data.settings.finalGoalCOP, today, estimate);
  return <section className="section-detail goal-section">
    <div className="section-title-row"><h2>Meta final</h2><button type="button" className="text-action" onClick={onEdit}>{metrics ? 'Editar meta' : 'Configurar'}</button></div>
    {!metrics ? <p className="empty-detail">Define cuánto quieres tener el 31 de julio de 2029.</p> : <>
      <p className="goal-target"><AnimatedMoney value={metrics.goal} /> <span>para julio de 2029</span></p>
      <div className="goal-progress-head"><span>{Math.round(metrics.saved / metrics.goal * 100).toLocaleString('es-CO')}% alcanzado</span><strong>{metrics.reached ? 'Meta alcanzada' : `Faltan ${formatCOP(metrics.remaining)}`}</strong></div>
      <div className="progress-track goal-progress" role="progressbar" aria-label="Progreso de la meta final" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(metrics.fraction * 100)}><div style={{ width: `${metrics.fraction * 100}%` }} /></div>
      <dl className="goal-details">
        <div><dt>Saldo real</dt><dd>{formatCOP(metrics.saved)}</dd></div>
        <div><dt>Aporte mensual necesario</dt><dd>{metrics.monthlyNeeded === null ? 'Plazo terminado' : formatCOP(metrics.monthlyNeeded)}</dd></div>
        <div><dt>Proyección de tu plan</dt><dd>{estimate === null ? 'Sin plan mensual' : `${metrics.projectedDifference! >= 0 ? '+' : '−'}${formatCOP(Math.abs(metrics.projectedDifference!))} vs. meta`}</dd></div>
      </dl>
      <p className="explanation">{metrics.months > 0 ? `Promedio de lo que falta, repartido entre ${metrics.months} ${metrics.months === 1 ? 'mes' : 'meses'} calendario, incluido el actual.` : 'El plazo terminó el 31 de julio de 2029.'}</p>
    </>}
  </section>;
}

export function SavingsSimulator({ data, today }: { data: Snapshot; today: string }) {
  const realPlan = data.settings.monthlyPlanCOP;
  const [value, setValue] = useState(() => String(realPlan ?? 0));
  const amount = parsePlanInput(value);
  const saved = balance(data.movements);
  const estimate = amount === null ? null : projectionForPlan(data.movements, amount, today);
  const realEstimate = projection(data.movements, data.settings, today);
  const needed = goalMetrics(data.movements, data.settings.finalGoalCOP, today, realEstimate)?.monthlyNeeded ?? 0;
  const sliderMax = Math.min(5_000_000, Math.max(500_000, Math.ceil(Math.max(needed, realPlan ?? 0, 250_000) * 2 / 50_000) * 50_000));
  const sliderAmount = amount === null ? 0 : Math.min(sliderMax, Math.round(amount / 10_000) * 10_000);
  const ended = monthsRemainingToGoal(today) === 0;
  return <section className="section-detail simulator-section">
    <div className="section-title-row"><h2>Simulador</h2><button type="button" className="text-action" onClick={() => setValue(String(realPlan ?? 0))}>Restablecer</button></div>
    <p className="simulator-label">Escenario hipotético. Tu saldo real sigue siendo {formatCOP(saved)}.</p>
    <div className="field simulator-field"><label htmlFor="simulate-amount">Aporte mensual simulado</label><div className="amount-wrap"><span aria-hidden="true">$</span><input type="text" id="simulate-amount" inputMode="numeric" value={value} aria-invalid={amount === null} aria-describedby="simulate-hint" onChange={(e) => setValue(e.target.value)} /></div>
      <input type="range" className="simulator-slider" aria-label="Ajustar aporte hipotético" min={0} max={sliderMax} step={10000} value={sliderAmount} onChange={(e) => setValue(String(e.target.value))} />
      <div className="slider-ends" aria-hidden="true"><span>$0</span><span>{formatCOP(sliderMax)}</span></div>
      <p id="simulate-hint" className={amount === null ? 'field-error' : 'field-hint'}>{amount === null ? 'Escribe un monto entero válido (puede ser 0).' : 'No se guarda ni registra dinero.'}</p>
    </div>
    <div className="simulator-results">
      <span className="eyebrow">Simulación · julio de 2029</span>
      <p className="simulator-amount">{ended ? 'Período terminado' : estimate === null ? 'Monto no válido' : <AnimatedMoney value={estimate} />}</p>
      {amount !== null && !ended && <dl className="simulator-compare">
        <div><dt>Vs. plan mensual real</dt><dd>{realPlan === null ? 'Sin configurar' : `${amount - realPlan >= 0 ? '+' : '−'}${formatCOP(Math.abs(amount - realPlan))} /mes`}</dd></div>
        <div><dt>Vs. proyección del plan</dt><dd>{realEstimate === null ? 'Sin plan real' : `${estimate! - realEstimate >= 0 ? '+' : '−'}${formatCOP(Math.abs(estimate! - realEstimate))}`}</dd></div>
        {data.settings.finalGoalCOP !== null && <div><dt>Vs. meta final</dt><dd>{estimate! - data.settings.finalGoalCOP >= 0 ? '+' : '−'}{formatCOP(Math.abs(estimate! - data.settings.finalGoalCOP))}</dd></div>}
      </dl>}
    </div>
    <p className="explanation">La estimación parte del saldo real y descuenta lo ya ahorrado del aporte previsto de este mes. No incluye retiros futuros.</p>
  </section>;
}
