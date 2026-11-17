import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bogotaToday, balance } from './calculations';
import { loadSnapshot, removeMovement, restoreSnapshot, saveMovement, saveMonthlyPlan, saveFinalGoal } from './storage';
import type { Movement } from './types';

let creationSequence = 0;
function createMovement(amount: number, type: Movement['type'] = 'deposit', id = crypto.randomUUID(), localDate = bogotaToday()): Movement {
  const now = new Date(Date.now() + creationSequence++ * 1000).toISOString();
  return { id, amountCOP: amount, type, localDate, createdAt: now, updatedAt: now };
}
function resetDB(): Promise<void> {
  return new Promise((resolve, reject) => { const req = indexedDB.deleteDatabase('aiden-savings'); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); });
}
beforeEach(async () => { vi.restoreAllMocks(); await resetDB(); });
describe('IndexedDB real por transacción (fake-indexeddb)', () => {
  it('arranca sin movimientos ni plan; sobrevive a lecturas posteriores', async () => {
    expect(await loadSnapshot()).toMatchObject({ movements: [], settings: { monthlyPlanCOP: null } });
    const move = createMovement(20000);
    await saveMovement(move, 'add');
    const data = await loadSnapshot();
    expect(data.movements).toEqual([move]); expect(balance(data.movements)).toBe(20000);
  });
  it('dos intentos simultáneos con el mismo id crean uno; segundo id cuenta', async () => {
    const first = createMovement(20000);
    await Promise.all([saveMovement(first, 'add'), saveMovement(first, 'add')]);
    expect((await loadSnapshot()).movements).toHaveLength(1);
    await saveMovement(createMovement(20000), 'add');
    expect(balance((await loadSnapshot()).movements)).toBe(40000);
  });
  it('retiro válido persiste; retiro imposible aborta sin datos parciales', async () => {
    await saveMovement(createMovement(20000), 'add');
    await saveMovement(createMovement(5000, 'withdrawal'), 'add');
    await expect(saveMovement(createMovement(16000, 'withdrawal'), 'add')).rejects.toThrow('negativo');
    const moves = (await loadSnapshot()).movements;
    expect(moves).toHaveLength(2); expect(balance(moves)).toBe(15000);
  });
  it('edición y eliminación verifican historial en la misma transacción', async () => {
    const dep = createMovement(20000); const withdrawal = createMovement(15000, 'withdrawal');
    await saveMovement(dep, 'add'); await saveMovement(withdrawal, 'add');
    await expect(saveMovement({ ...dep, amountCOP: 10000 }, 'edit')).rejects.toThrow('negativo');
    await expect(removeMovement(dep.id)).rejects.toThrow('negativo');
    expect(balance((await loadSnapshot()).movements)).toBe(5000);
    await removeMovement(withdrawal.id);
    await saveMovement({ ...dep, amountCOP: 10000 }, 'edit');
    expect(balance((await loadSnapshot()).movements)).toBe(10000);
  });
  it('plan mensual se guarda y no crea depósitos', async () => {
    await saveMonthlyPlan(200000);
    expect((await loadSnapshot()).settings.monthlyPlanCOP).toBe(200000);
    expect((await loadSnapshot()).movements).toHaveLength(0);
  });
  it('restauración válida reemplaza movimientos y plan conjuntamente', async () => {
    await saveMovement(createMovement(5000), 'add');
    const imported = createMovement(25000);
    await restoreSnapshot({ movements: [imported], settings: { schemaVersion: 2, targetEndMonth: '2029-07', monthlyPlanCOP: 100000, finalGoalCOP: null } });
    const result = await loadSnapshot();
    expect(result.movements).toEqual([imported]); expect(result.settings.monthlyPlanCOP).toBe(100000);
  });
  it('backup inválido nunca borra datos; error inducido en escritura también hace rollback', async () => {
    const original = createMovement(5000);
    await saveMovement(original, 'add'); await saveMonthlyPlan(120000);
    await expect(restoreSnapshot({ movements: [createMovement(6000, 'withdrawal')], settings: { schemaVersion: 2, targetEndMonth: '2029-07', monthlyPlanCOP: 1000, finalGoalCOP: null } })).rejects.toThrow();
    const add = IDBObjectStore.prototype.add;
    let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
      calls++;
      if (calls === 2) throw new Error('Fallo inducido');
      return add.apply(this, args);
    });
    await expect(restoreSnapshot({ movements: [createMovement(12000), createMovement(13000)], settings: { schemaVersion: 2, targetEndMonth: '2029-07', monthlyPlanCOP: 90000, finalGoalCOP: null } })).rejects.toThrow('Fallo inducido');
    vi.restoreAllMocks();
    const result = await loadSnapshot();
    expect(result.movements).toEqual([original]); expect(result.settings.monthlyPlanCOP).toBe(120000);
  });
});

describe('v1.1 IndexedDB upgrade and data integrity', () => {
  it('v1 database upgrades to version 2 preserving saved movements and monthly plan', async () => {
    const movement = createMovement(30000);
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open('aiden-savings', 1);
      opening.onupgradeneeded = () => {
        opening.result.createObjectStore('movements', { keyPath: 'id' }).put(movement);
        opening.result.createObjectStore('settings').put({ schemaVersion: 1, monthlyPlanCOP: 150000, targetEndMonth: '2029-07' }, 'current');
      };
      opening.onsuccess = () => { opening.result.close(); resolve(); };
      opening.onerror = () => reject(opening.error);
    });
    const result = await loadSnapshot();
    expect(result.movements).toEqual([movement]);
    expect(balance(result.movements)).toBe(30000);
    expect(result.settings).toEqual({ schemaVersion: 2, monthlyPlanCOP: 150000, finalGoalCOP: null, targetEndMonth: '2029-07' });
    const onDisk = await new Promise<unknown>((resolve, reject) => {
      const opening = indexedDB.open('aiden-savings', 3);
      opening.onsuccess = () => {
        const db = opening.result;
        const req = db.transaction('settings').objectStore('settings').get('current');
        req.onsuccess = () => { resolve(req.result); db.close(); };
        req.onerror = () => { reject(req.error); db.close(); };
      };
      opening.onerror = () => reject(opening.error);
    });
    expect(onDisk).toEqual(result.settings);
  });
  it('plan and final goal may be changed independently without creating movements', async () => {
    await saveFinalGoal(8000000);
    await saveMonthlyPlan(200000);
    expect((await loadSnapshot()).settings).toMatchObject({ finalGoalCOP: 8000000, monthlyPlanCOP: 200000 });
    await saveMonthlyPlan(null);
    expect((await loadSnapshot()).settings).toMatchObject({ finalGoalCOP: 8000000, monthlyPlanCOP: null });
    await saveFinalGoal(null);
    const data = await loadSnapshot();
    expect(data.settings.finalGoalCOP).toBe(null);
    expect(data.movements).toEqual([]);
  });
  it('simulating scenarios is read-only and does not change IndexedDB', async () => {
    const deposit = createMovement(166000);
    await saveMovement(deposit, 'add');
    await saveMonthlyPlan(200000);
    await saveFinalGoal(8000000);
    const original = await loadSnapshot();
    const { projectionForPlan } = await import('./calculations');
    expect(projectionForPlan(original.movements, 220000, bogotaToday())).toBeGreaterThan(balance(original.movements));
    expect(await loadSnapshot()).toEqual(original);
  });
  it('importing a previous v1 backup migrates it without losing deposits', async () => {
    const { parseBackup } = await import('./backup');
    const movement = createMovement(50000);
    const backup = { format: 'aiden.savings.backup', version: 1, exportedAt: new Date().toISOString(),
      settings: { schemaVersion: 1, monthlyPlanCOP: 100000, targetEndMonth: '2029-07' }, movements: [movement] };
    await saveFinalGoal(8000000);
    const restored = parseBackup(JSON.stringify(backup));
    await restoreSnapshot(restored);
    expect(await loadSnapshot()).toEqual({ movements: [movement], settings: { schemaVersion: 2, monthlyPlanCOP: 100000, finalGoalCOP: null, targetEndMonth: '2029-07' } });
  });
  it('failed goal write and invalid restoration do not change existing data', async () => {
    await saveFinalGoal(8000000); await saveMonthlyPlan(200000);
    const baseline = await loadSnapshot();
    await expect(saveFinalGoal(-1)).rejects.toThrow();
    await expect(restoreSnapshot({ ...baseline, settings: { ...baseline.settings, finalGoalCOP: -1 } })).rejects.toThrow();
    expect(await loadSnapshot()).toEqual(baseline);
  });
});
