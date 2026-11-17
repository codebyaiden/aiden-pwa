import { describe, expect, it } from 'vitest';
import { balance, bogotaToday, compareMovement, formatCOP, historicalBalanceError, isCalendarDate, monthTotals, monthlyProgress, projection, projectionForPlan, monthsRemainingToGoal, goalMetrics, lastSixMonths, savingsStreak, shiftMonth } from './calculations';
import { createBackup, parseBackup } from './backup';
import { parseMoneyInput, parseGoalInput, validateLedger } from './validation';
import type { Movement, Settings } from './types';

const settings = (amount: number | null): Settings => ({ schemaVersion: 2, monthlyPlanCOP: amount, finalGoalCOP: null, targetEndMonth: '2029-07' });
function m(amount: number, date = '2026-11-16', type: Movement['type'] = 'deposit', i = 1): Movement {
  return { id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`, type, amountCOP: amount, localDate: date, createdAt: `2026-11-16T18:00:${String(i).padStart(2, '0')}.000Z`, updatedAt: `2026-11-16T18:00:${String(i).padStart(2, '0')}.000Z` };
}
const today = '2026-11-16';
describe('libro contable', () => {
  it('primera apertura no inventa movimientos ni dinero', () => { expect(balance([])).toBe(0); expect(monthTotals([], '2026-11')).toEqual({ deposited: 0, withdrawn: 0, net: 0 }); });
  it('depósitos reales se suman y tienen métrica mensual independiente', () => {
    const moves = [m(20000), m(20000, today, 'deposit', 2)];
    expect(balance(moves)).toBe(40000); expect(monthTotals(moves, '2026-11').deposited).toBe(40000);
  });
  it('retiro reduce saldo pero no aportes', () => {
    const moves = [m(20000), m(5000, today, 'withdrawal', 2)];
    expect(balance(moves)).toBe(15000); expect(monthTotals(moves, '2026-11')).toEqual({ deposited: 20000, withdrawn: 5000, net: 15000 });
  });
  it('no permite saldo histórico negativo aunque termine positivo', () => {
    const moves = [m(10000, '2026-11-18', 'deposit'), m(5000, '2026-11-17', 'withdrawal', 2)];
    expect(historicalBalanceError(moves)).toContain('negativo');
  });
  it('cambiar fecha entre meses recalcula sin alterar el total', () => {
    const old = [m(20000)]; const changed = [{ ...old[0], localDate: '2026-10-31' }];
    expect(balance(changed)).toBe(balance(old)); expect(monthTotals(changed, '2026-10').deposited).toBe(20000); expect(monthTotals(changed, '2026-11').deposited).toBe(0);
  });
  it('editar o eliminar aporte puede invalidar retiros posteriores', () => {
    const moves = [m(20000), m(15000, '2026-11-16', 'withdrawal', 2)];
    expect(historicalBalanceError(moves)).toBe(null);
    expect(historicalBalanceError([{ ...moves[0], amountCOP: 10000 }, moves[1]])).not.toBe(null);
    expect(historicalBalanceError([moves[1]])).not.toBe(null);
  });
  it('ordena por fecha y luego creación e id', () => {
    expect(compareMovement(m(100, '2026-10-31'), m(100, '2026-11-01', 'deposit', 2))).toBeLessThan(0);
    expect(compareMovement(m(100), m(100, today, 'deposit', 2))).toBeLessThan(0);
  });
});
describe('plan y proyección', () => {
  it('sin plan no inventa proyección; plan 0 deja saldo igual', () => {
    expect(projection([m(30000)], settings(null), today)).toBe(null);
    expect(projection([m(30000)], settings(0), today)).toBe(30000);
    expect(monthlyProgress(100, 0)).toBe(null);
  });
  it('ejemplo noviembre 2026: 6.600.000, sin doble conteo', () => {
    expect(projection([m(166000)], settings(200000), today)).toBe(6600000);
    expect(projection([m(166000), m(20000, today, 'deposit', 2)], settings(200000), today)).toBe(6600000);
    expect(projection([m(166000), m(50000, today, 'deposit', 2)], settings(200000), today)).toBe(6616000);
  });
  it('progreso neto negativo, superado y cap visual', () => {
    expect(monthlyProgress(-5000, 200000)).toEqual({ fraction: 0, remaining: 205000, complete: false });
    expect(monthlyProgress(300000, 200000)).toEqual({ fraction: 1, remaining: 0, complete: true });
  });
  it('julio de 2029 no suma meses posteriores y después se detiene', () => {
    const moves = [m(50000, '2029-07-01')];
    expect(projection(moves, settings(200000), '2029-07-20')).toBe(200000);
    expect(projection(moves, settings(200000), '2029-08-01')).toBe(null);
  });
});
describe('fechas, dinero y respaldos', () => {
  it('medianoche colombiana, año nuevo y fecha bisiesta', () => {
    expect(bogotaToday(new Date('2027-01-01T03:59:59.000Z'))).toBe('2026-12-31');
    expect(bogotaToday(new Date('2027-01-01T05:00:00.000Z'))).toBe('2027-01-01');
    expect(isCalendarDate('2028-02-29')).toBe(true); expect(isCalendarDate('2027-02-29')).toBe(false);
  });
  it('dinero COP sin centavos; cantidades ambiguas rechazadas', () => {
    expect(formatCOP(20000)).toContain('20.000');
    expect(parseMoneyInput('20.000')).toBe(20000);
    expect(parseMoneyInput('20000')).toBe(20000);
    for (const bad of ['0', '-200', '1.5', '20,000', '1e3', 'NaN', 'Infinity', '999999999999', '1.00', '0002', '$20000', '']) expect(parseMoneyInput(bad)).toBe(null);
  });
  it('backup round-trip valida esquema y saldo', () => {
    const exported = createBackup({ settings: settings(200000), movements: [m(30000)] }, new Date('2026-11-16T12:00:00Z'));
    const imported = parseBackup(JSON.stringify(exported), today);
    expect(imported).toEqual(exported);
    expect(balance(imported.movements)).toBe(30000);
  });
  it('rechaza copia alterada, versión desconocida y duplicados', () => {
    const file = createBackup({ settings: settings(null), movements: [m(50000)] });
    expect(() => parseBackup(JSON.stringify({ ...file, version: 3 }), today)).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...file, movements: [...file.movements, ...file.movements] }), today)).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...file, movements: [{ ...file.movements[0], amountCOP: -1 }] }), today)).toThrow();
    expect(() => validateLedger([m(100, '2026-11-17')], today)).toThrow();
    expect(() => parseBackup('{broken', today)).toThrow();
  });
});

describe('v1.1: meta final y escenario hipotético', () => {
  it('meta sin configurar, alcanzada y superada', () => {
    expect(goalMetrics([], null, today, null)).toBe(null);
    expect(goalMetrics([m(8000000)], 8000000, today, null)).toMatchObject({ remaining: 0, reached: true, monthlyNeeded: 0, fraction: 1 });
    expect(goalMetrics([m(9000000)], 8000000, today, 8900000)).toMatchObject({ remaining: 0, reached: true, projectedDifference: 900000 });
  });
  it('plazo mensual incluye noviembre 2026 y julio 2029', () => {
    expect(monthsRemainingToGoal('2026-11-16')).toBe(33);
    expect(monthsRemainingToGoal('2026-12-31')).toBe(32);
    expect(monthsRemainingToGoal('2029-07-31')).toBe(1);
    expect(monthsRemainingToGoal('2029-08-01')).toBe(0);
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('calculadora de meta distribuye faltante entre meses sin redondear a la baja', () => {
    expect(goalMetrics([m(200000)], 8000000, today, 6600000)).toMatchObject({
      saved: 200000, remaining: 7800000, months: 33, monthlyNeeded: 236364, projectedDifference: -1400000
    });
  });
  it('simulación evita doble conteo y no altera movimientos ni preferencias', () => {
    const moves = [m(166000)];
    const originalSettings = settings(200000);
    const before = JSON.stringify({ moves, originalSettings });
    expect(projectionForPlan(moves, 200000, today)).toBe(6600000);
    expect(projectionForPlan([m(166000), m(20000, today, 'deposit', 2)], 200000, today)).toBe(6600000);
    expect(projectionForPlan(moves, 220000, today)).toBe(7260000);
    expect(projectionForPlan(moves, 0, today)).toBe(166000);
    expect(JSON.stringify({ moves, originalSettings })).toBe(before);
  });
  it('meta con plazo terminado no inventa meses restantes', () => {
    expect(goalMetrics([], 500000, '2029-08-01', null)?.monthlyNeeded).toBe(null);
    expect(projectionForPlan([], 100000, '2029-08-01')).toBe(null);
  });
  it('valida montos de meta independientes del límite por movimiento', () => {
    expect(parseGoalInput('8.000.000')).toBe(8000000);
    expect(parseGoalInput('8000000000')).toBe(8000000000);
    for (const bad of ['0', '-10', '2,500', '1.5', 'Infinity', '999999999999', 'abc']) expect(parseGoalInput(bad)).toBe(null);
  });
});
describe('v1.1: gráfica real de seis meses', () => {
  it('devuelve exactamente seis meses incluyendo ceros y cruza el año', () => {
    const bars = lastSixMonths([m(50000, '2026-11-08'), m(30000, '2026-09-05', 'deposit', 2)], today);
    expect(bars.map((b) => b.month)).toEqual(['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11']);
    expect(bars.map((b) => b.deposited)).toEqual([0,0,0,30000,0,50000]);
    expect(lastSixMonths([], '2027-02-01').map((b) => b.month)).toEqual(['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02']);
  });
  it('retiros no cuentan; corrección de fecha cambia únicamente barras afectadas', () => {
    const depo = m(50000); const withdrawal = m(30000, today, 'withdrawal', 2);
    const before = lastSixMonths([depo, withdrawal], today);
    expect(before.at(-1)?.deposited).toBe(50000);
    const after = lastSixMonths([{ ...depo, localDate: '2026-10-31' }, withdrawal], today);
    expect(after.at(-1)?.deposited).toBe(0);
    expect(after.at(-2)?.deposited).toBe(50000);
  });
});
describe('v1.1: rachas de ahorro', () => {
  it('varios depósitos del mismo mes cuentan una vez; retiros nunca cuentan', () => {
    const history = [m(1000, '2026-10-05'), m(1000, '2026-10-06', 'deposit', 2), m(1000, today, 'deposit', 3), m(1000, today, 'withdrawal', 4)];
    expect(savingsStreak(history, today)).toEqual({ months: 2, status: 'active' });
  });
  it('racha del mes anterior espera continuar durante el mes actual', () => {
    expect(savingsStreak([m(1000, '2026-09-05'), m(1000, '2026-10-20', 'deposit', 2)], today)).toEqual({ months: 2, status: 'pending' });
    expect(savingsStreak([m(1000, '2026-10-20')], '2026-12-01')).toEqual({ months: 0, status: 'broken' });
  });
  it('recalcula al editar o eliminar movimientos retroactivos', () => {
    const oct = m(1000, '2026-10-05'); const nov = m(1000, today, 'deposit', 2);
    expect(savingsStreak([oct, nov], today).months).toBe(2);
    expect(savingsStreak([nov], today).months).toBe(1);
    expect(savingsStreak([{ ...oct, localDate: '2026-09-30' }, nov], today).months).toBe(1);
    expect(savingsStreak([m(1000, '2026-01-01')], today)).toEqual({ months: 0, status: 'broken' });
    expect(savingsStreak([], today).status).toBe('none');
  });
});
describe('v1.1: respaldo anterior compatible', () => {
  it('lee copia v1 sin inventar meta y exporta copia v2', () => {
    const original = { format: 'aiden.savings.backup', version: 1, exportedAt: '2026-11-16T12:00:00.000Z',
      settings: { schemaVersion: 1, monthlyPlanCOP: 200000, targetEndMonth: '2029-07' }, movements: [m(20000)] };
    const restored = parseBackup(JSON.stringify(original), today);
    expect(restored).toMatchObject({ version: 2, settings: { monthlyPlanCOP: 200000, finalGoalCOP: null, schemaVersion: 2 } });
    expect(createBackup(restored).version).toBe(2);
  });
  it('rechaza v1 adulterada sin importar movimientos', () => {
    const invalid = { format: 'aiden.savings.backup', version: 1, exportedAt: '2026-11-16T12:00:00.000Z',
      settings: { schemaVersion: 1, monthlyPlanCOP: 1, targetEndMonth: '2029-07', finalGoalCOP: 1000 }, movements: [] };
    expect(() => parseBackup(JSON.stringify(invalid), today)).toThrow('configuración');
  });
});
