import { bogotaToday, balance } from './calculations';
import type { BackupV1, BackupV2, Snapshot } from './types';
import { validateLedger, validateSettings, validateSettingsV1, isISODate, migrateSettings } from './validation';

export const MAX_BACKUP_SIZE = 5 * 1024 * 1024;

export function createBackup(snapshot: Snapshot, now: Date = new Date()): BackupV2 {
  return {
    format: 'aiden.savings.backup', version: 2, exportedAt: now.toISOString(),
    settings: { ...snapshot.settings }, movements: snapshot.movements.map((m) => ({ ...m }))
  };
}

/** Parse and validate *everything* before permitting any database write. V1 backups are normalized to V2. */
export function parseBackup(raw: string, today: string = bogotaToday()): BackupV2 {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_SIZE) throw new Error('El archivo supera el límite de 5 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('El archivo no contiene JSON válido.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('El archivo no es una copia válida.');
  const b = parsed as Record<string, unknown>;
  if (b.format !== 'aiden.savings.backup' || (b.version !== 1 && b.version !== 2)) throw new Error('Formato o versión de copia no compatible.');
  if (Object.keys(b).sort().join(',') !== 'exportedAt,format,movements,settings,version') throw new Error('La estructura de la copia no es válida.');
  if (!isISODate(b.exportedAt)) throw new Error('La fecha de exportación no es válida.');
  if (b.version === 1 ? !validateSettingsV1(b.settings) : !validateSettings(b.settings)) throw new Error('La configuración de la copia no es válida.');
  validateLedger(b.movements, today);
  const legacy = b as unknown as BackupV1;
  return { format: 'aiden.savings.backup', version: 2, exportedAt: legacy.exportedAt,
    settings: migrateSettings(b.settings), movements: legacy.movements.map((m) => ({ ...m })) };
}

export function backupSummary(b: BackupV2) { return { count: b.movements.length, total: balance(b.movements) }; }

export function downloadBackup(backup: BackupV2): void {
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
