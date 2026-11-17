import type { Movement, Settings } from './types';

const localeDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
});
const moneyFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0, useGrouping: true });

export function bogotaToday(now: Date = new Date()): string {
  const parts = localeDateFormatter.formatToParts(now);
  const val = (t: string) => parts.find((part) => part.type === t)?.value;
  return `${val('year')}-${val('month')}-${val('day')}`;
}
export function formatCOP(amount: number): string {
  return `$${moneyFormatter.format(amount)}`;
}
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() + 1 === m && check.getUTCDate() === d;
}
export function monthKey(date: string): string { return date.slice(0, 7); }
export function compareMovement(a: Movement, b: Movement): number {
  return a.localDate.localeCompare(b.localDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
export function sortNewest(movements: Movement[]): Movement[] { return [...movements].sort((a, b) => compareMovement(b, a)); }
export function balance(movements: Movement[]): number {
  return movements.reduce((value, m) => value + (m.type === 'deposit' ? m.amountCOP : -m.amountCOP), 0);
}
export function monthTotals(movements: Movement[], month: string): { deposited: number; withdrawn: number; net: number } {
  let deposited = 0; let withdrawn = 0;
  for (const m of movements) if (monthKey(m.localDate) === month) {
    if (m.type === 'deposit') deposited += m.amountCOP;
    else withdrawn += m.amountCOP;
  }
  return { deposited, withdrawn, net: deposited - withdrawn };
}
export function historicalBalanceError(movements: Movement[]): string | null {
  let running = 0;
  for (const m of [...movements].sort(compareMovement)) {
    running += m.type === 'deposit' ? m.amountCOP : -m.amountCOP;
    if (!Number.isSafeInteger(running)) return 'El total supera el límite seguro de cálculo.';
    if (running < 0) return `El saldo quedaría negativo el ${m.localDate}. Revisa el importe o la fecha.`;
  }
  return null;
}
export function monthlyProgress(net: number, plan: number | null) {
  if (plan === null || plan === 0) return null;
  return { fraction: Math.min(1, Math.max(0, net / plan)), remaining: Math.max(0, plan - net), complete: net >= plan };
}
export function projection(movements: Movement[], settings: Settings, today: string): number | null {
  const plan = settings.monthlyPlanCOP;
  if (plan === null || monthKey(today) > settings.targetEndMonth) return null;
  const [year, month] = monthKey(today).split('-').map(Number);
  const monthsAfter = Math.max(0, (2029 - year) * 12 + (7 - month));
  const net = monthTotals(movements, monthKey(today)).net;
  return balance(movements) + Math.max(0, plan - net) + monthsAfter * plan;
}
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
export function formatDate(date: string, today: string): string {
  if (date === today) return 'Hoy';
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: y !== Number(today.slice(0, 4)) ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
