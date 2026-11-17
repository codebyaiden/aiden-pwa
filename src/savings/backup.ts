import { bogotaToday, balance } from './calculations';
import type { BackupV1, Snapshot } from './types';
import { validateLedger, validateSettings, isISODate } from './validation';

export const MAX_BACKUP_SIZE = 5 * 1024 * 1024;

export function createBackup(snapshot: Snapshot, now: Date = new Date()): BackupV1 {
  return {
    format: 'aiden.savings.backup', version: 1, exportedAt: now.toISOString(),
    settings: { ...snapshot.settings }, movements: snapshot.movements.map((m) => ({ ...m }))
  };
}

export function parseBackup(raw: string, today: string = bogotaToday()): BackupV1 {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_SIZE) throw new Error('El archivo supera el límite de 5 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('El archivo no contiene JSON válido.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('El archivo no es una copia válida.');
  const b = parsed as Record<string, unknown>;
  if (b.format !== 'aiden.savings.backup' || b.version !== 1) throw new Error('Formato o versión de copia no compatible.');
  if (!isISODate(b.exportedAt)) throw new Error('La fecha de exportación no es válida.');
  if (!validateSettings(b.settings)) throw new Error('La configuración de la copia no es válida.');
  validateLedger(b.movements, today);
  if (Object.keys(b).sort().join(',') !== 'exportedAt,format,movements,settings,version') throw new Error('La estructura de la copia no es válida.');
  return b as unknown as BackupV1;
}

export function backupSummary(b: BackupV1) { return { count: b.movements.length, total: balance(b.movements) }; }

export function downloadBackup(backup: BackupV1): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aiden-alcancia-${bogotaToday()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
