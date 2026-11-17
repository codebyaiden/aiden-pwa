import { historicalBalanceError, isCalendarDate } from './calculations';
import { MAX_AMOUNT_COP, MAX_GOAL_COP } from './types';
import type { Movement, Settings, SettingsV1 } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUnsignedMoney(value: string, max: number): number | null {
  const trimmed = value.trim();
  if (!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(trimmed)) return null;
  const amount = Number(trimmed.replaceAll('.', ''));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= max ? amount : null;
}
export function parseMoneyInput(value: string): number | null { return parseUnsignedMoney(value, MAX_AMOUNT_COP); }
export function parseGoalInput(value: string): number | null { return parseUnsignedMoney(value, MAX_GOAL_COP); }
export function parsePlanInput(value: string): number | null {
  if (value.trim() === '0') return 0;
  return parseMoneyInput(value);
}
export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function validateMovement(value: unknown, today: string): value is Movement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  if (!UUID_RE.test(String(m.id)) || (m.type !== 'deposit' && m.type !== 'withdrawal')) return false;
  if (typeof m.amountCOP !== 'number' || !Number.isSafeInteger(m.amountCOP) || m.amountCOP <= 0 || m.amountCOP > MAX_AMOUNT_COP) return false;
  if (typeof m.localDate !== 'string' || !isCalendarDate(m.localDate) || m.localDate > today) return false;
  if (!isISODate(m.createdAt) || !isISODate(m.updatedAt) || m.updatedAt < m.createdAt) return false;
  if (m.note !== undefined && (typeof m.note !== 'string' || m.note.length > 120)) return false;
  if (Object.keys(m).some((k) => !['id', 'type', 'amountCOP', 'localDate', 'createdAt', 'updatedAt', 'note'].includes(k))) return false;
  return true;
}
function isValidPlan(plan: unknown): boolean {
  return plan === null || (typeof plan === 'number' && Number.isSafeInteger(plan) && plan >= 0 && plan <= MAX_AMOUNT_COP);
}
export function validateSettingsV1(value: unknown): value is SettingsV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return isValidPlan(s.monthlyPlanCOP) && s.targetEndMonth === '2029-07' && s.schemaVersion === 1
    && Object.keys(s).sort().join(',') === 'monthlyPlanCOP,schemaVersion,targetEndMonth';
}
export function validateSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return isValidPlan(s.monthlyPlanCOP)
    && (s.finalGoalCOP === null || (typeof s.finalGoalCOP === 'number' && Number.isSafeInteger(s.finalGoalCOP) && s.finalGoalCOP > 0 && s.finalGoalCOP <= MAX_GOAL_COP))
    && s.targetEndMonth === '2029-07' && s.schemaVersion === 2
    && Object.keys(s).sort().join(',') === 'finalGoalCOP,monthlyPlanCOP,schemaVersion,targetEndMonth';
}
export function migrateSettings(value: unknown): Settings {
  if (validateSettings(value)) return { ...value };
  if (validateSettingsV1(value)) return { ...value, finalGoalCOP: null, schemaVersion: 2 };
  throw new Error('La configuración guardada no es válida. No se ha modificado ningún dato.');
}
export function validateLedger(movements: unknown, today: string): asserts movements is Movement[] {
  if (!Array.isArray(movements) || movements.length > 20_000) throw new Error('La lista de movimientos no es válida o supera 20.000 registros.');
  const seen = new Set<string>();
  for (const m of movements) {
    if (!validateMovement(m, today)) throw new Error('Hay movimientos con datos no válidos.');
    if (seen.has(m.id)) throw new Error('La copia contiene movimientos duplicados.');
    seen.add(m.id);
  }
  const balanceError = historicalBalanceError(movements);
  if (balanceError) throw new Error(balanceError);
}
