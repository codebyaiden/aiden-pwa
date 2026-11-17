import { describe, expect, it } from 'vitest';
import { balance, bogotaToday, compareMovement, formatCOP, historicalBalanceError, isCalendarDate, monthTotals, monthlyProgress, projection } from './calculations';
import { createBackup, parseBackup } from './backup';
import { parseMoneyInput, validateLedger } from './validation';
import type { Movement, Settings } from './types';

const settings = (amount: number | null): Settings => ({ schemaVersion: 1, monthlyPlanCOP: amount, targetEndMonth: '2029-07' });
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
    expect(() => parseBackup(JSON.stringify({ ...file, version: 2 }), today)).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...file, movements: [...file.movements, ...file.movements] }), today)).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...file, movements: [{ ...file.movements[0], amountCOP: -1 }] }), today)).toThrow();
    expect(() => validateLedger([m(100, '2026-11-17')], today)).toThrow();
    expect(() => parseBackup('{broken', today)).toThrow();
  });
});
