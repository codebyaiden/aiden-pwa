import { bogotaToday } from './calculations';
import { DEFAULT_SETTINGS } from './types';
import type { Movement, Settings, Snapshot } from './types';
import { migrateSettings, validateLedger, validateSettings, validateSettingsV1 } from './validation';

const DB_NAME = 'aiden-savings';
const DB_VERSION = 5;
const SETTING_KEY = 'current';

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Error al acceder al almacenamiento.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    const timeout = globalThis.setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('La base de datos está bloqueada. Cierra otras pestañas e inténtalo de nuevo.')); }
    }, 9000);
    function fail(error: Error) { if (!settled) { settled = true; clearTimeout(timeout); reject(error); } }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('movements')) db.createObjectStore('movements', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('eventOccurrenceStates')) db.createObjectStore('eventOccurrenceStates', { keyPath: 'occurrenceKey' });
      if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('countdowns')) db.createObjectStore('countdowns', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('routine')) db.createObjectStore('routine');
      if (!db.objectStoreNames.contains('financeEntries')) {
        const fs = db.createObjectStore('financeEntries', { keyPath: 'id' });
        fs.createIndex('byOccurrence', 'occurrenceKey', { unique: true });
      }
      // Schema v2 adds an independent final goal. Keep every movement and the existing plan.
      if (req.transaction && req.transaction.objectStoreNames.contains('settings')) {
        const settingsStore = req.transaction.objectStore('settings');
        const existing = settingsStore.get(SETTING_KEY);
        existing.onsuccess = () => {
          if (validateSettingsV1(existing.result)) {
            settingsStore.put(migrateSettings(existing.result), SETTING_KEY);
          }
          // Unknown records remain untouched and will produce a recoverable load error.
        };
      }
    };
    req.onerror = () => fail(req.error ?? new Error('No se pudo abrir la base de datos.'));
    req.onblocked = () => fail(new Error('Otra pestaña está impidiendo abrir la base de datos. Ciérrala e inténtalo de nuevo.'));
    req.onsuccess = () => {
      if (settled) { req.result.close(); return; }
      settled = true;
      clearTimeout(timeout);
      const db = req.result;
      db.onversionchange = () => { db.close(); typeof window !== 'undefined' && window.dispatchEvent(new Event('aiden:storage-changed')); };
      resolve(db);
    };
  });
}

export async function transaction<T>(mode: IDBTransactionMode, stores: string[], work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(stores, mode);
    const complete = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('No se pudieron guardar los cambios.'));
      tx.onerror = () => { /* onabort comunica el error final */ };
    });
    try {
      const result = await work(tx);
      await complete; // éxito únicamente después de oncomplete (commit real)
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* ya terminó */ }
      await complete.catch(() => undefined);
      throw error;
    }
  } finally {
    db.close();
  }
}

function checkedSettings(raw: unknown): Settings {
  if (raw === undefined) return { ...DEFAULT_SETTINGS };
  return migrateSettings(raw);
}

export async function loadSnapshot(): Promise<Snapshot> {
  return transaction('readonly', ['movements', 'settings'], async (tx) => {
    const movementsReq = request<Movement[]>(tx.objectStore('movements').getAll());
    const settingsReq = request<Settings | undefined>(tx.objectStore('settings').get(SETTING_KEY));
    const [movements, rawSettings] = await Promise.all([movementsReq, settingsReq]);
    validateLedger(movements, bogotaToday());
    return { movements, settings: checkedSettings(rawSettings) };
  });
}

export async function saveMovement(next: Movement, mode: 'add' | 'edit'): Promise<void> {
  const today = bogotaToday();
  await transaction('readwrite', ['movements'], async (tx) => {
    const store = tx.objectStore('movements');
    const existing = await request<Movement[]>(store.getAll());
    validateLedger(existing, today);
    const old = existing.find((m) => m.id === next.id);
    if (mode === 'add' && old) {
      // A retry after an uncertain failure must not create a second deposit.
      if (JSON.stringify(old) === JSON.stringify(next)) return;
      throw new Error('Este movimiento ya existe y tiene información diferente.');
    }
    if (mode === 'edit' && !old) throw new Error('El movimiento ya no existe. Actualiza la vista.');
    if (mode === 'edit' && old && (old.createdAt !== next.createdAt || old.type !== next.type)) {
      throw new Error('No puedes cambiar la identidad o el tipo del movimiento.');
    }
    const changed = [...existing.filter((m) => m.id !== next.id), next];
    validateLedger(changed, today);
    if (mode === 'add') store.add(next);
    else store.put(next);
  });
}

export async function removeMovement(id: string): Promise<void> {
  await transaction('readwrite', ['movements'], async (tx) => {
    const store = tx.objectStore('movements');
    const movements = await request<Movement[]>(store.getAll());
    validateLedger(movements, bogotaToday());
    if (!movements.some((m) => m.id === id)) throw new Error('El movimiento ya no existe. Actualiza la vista.');
    validateLedger(movements.filter((m) => m.id !== id), bogotaToday());
    store.delete(id);
  });
}

/** Update one setting without overwriting the other. Writes commit before resolving. */
async function updateSettings(patch: Pick<Settings, 'monthlyPlanCOP'> | Pick<Settings, 'finalGoalCOP'>): Promise<void> {
  await transaction('readwrite', ['settings'], async (tx) => {
    const store = tx.objectStore('settings');
    const current = checkedSettings(await request<Settings | undefined>(store.get(SETTING_KEY)));
    const next: Settings = { ...current, ...patch };
    if (!validateSettings(next)) throw new Error('La configuración no es válida.');
    store.put(next, SETTING_KEY);
  });
}

export async function saveMonthlyPlan(monthlyPlanCOP: number | null): Promise<void> {
  return updateSettings({ monthlyPlanCOP });
}

export async function saveFinalGoal(finalGoalCOP: number | null): Promise<void> {
  return updateSettings({ finalGoalCOP });
}

export async function restoreSnapshot(snapshot: Snapshot): Promise<void> {
  validateLedger(snapshot.movements, bogotaToday());
  if (!validateSettings(snapshot.settings)) throw new Error('La configuración de la copia no es válida.');
  await transaction('readwrite', ['movements', 'settings'], async (tx) => {
    const movementsStore = tx.objectStore('movements');
    const settingsStore = tx.objectStore('settings');
    // El clear + todas las escrituras comparten UN commit atómico.
    movementsStore.clear();
    settingsStore.clear();
    for (const m of snapshot.movements) movementsStore.add(m);
    settingsStore.put(snapshot.settings, SETTING_KEY);
  });
}
