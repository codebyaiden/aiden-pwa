import type { FinanceEntry } from './types';

export const FINANCE_CATEGORIES = [
  ['general', 'General'], ['servicios', 'Servicios'], ['alimentacion', 'Alimentación'],
  ['transporte', 'Transporte'], ['personal', 'Personal'], ['otros', 'Otros'],
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number][0];

export function financeTotals(entries: readonly FinanceEntry[], month: string) {
  let spent = 0, received = 0;
  for (const entry of entries) {
    if (entry.localDate.slice(0, 7) !== month) continue;
    if (entry.kind === 'expense') spent += entry.amountCOP;
    else received += entry.amountCOP;
  }
  return { spent, received, net: received - spent };
}
export function financeHistory(entries: readonly FinanceEntry[], month?: string) {
  return entries.filter(e => !month || e.localDate.startsWith(month))
    .sort((a, b) => b.localDate.localeCompare(a.localDate)
      || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
