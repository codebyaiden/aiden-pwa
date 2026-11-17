import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bogotaToday, balance } from './calculations';
import { loadSnapshot, removeMovement, restoreSnapshot, saveMovement, saveMonthlyPlan } from './storage';
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
    await restoreSnapshot({ movements: [imported], settings: { schemaVersion: 1, targetEndMonth: '2029-07', monthlyPlanCOP: 100000 } });
    const result = await loadSnapshot();
    expect(result.movements).toEqual([imported]); expect(result.settings.monthlyPlanCOP).toBe(100000);
  });
  it('backup inválido nunca borra datos; error inducido en escritura también hace rollback', async () => {
    const original = createMovement(5000);
    await saveMovement(original, 'add'); await saveMonthlyPlan(120000);
    await expect(restoreSnapshot({ movements: [createMovement(6000, 'withdrawal')], settings: { schemaVersion: 1, targetEndMonth: '2029-07', monthlyPlanCOP: 1000 } })).rejects.toThrow();
    const add = IDBObjectStore.prototype.add;
    let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
      calls++;
      if (calls === 2) throw new Error('Fallo inducido');
      return add.apply(this, args);
    });
    await expect(restoreSnapshot({ movements: [createMovement(12000), createMovement(13000)], settings: { schemaVersion: 1, targetEndMonth: '2029-07', monthlyPlanCOP: 90000 } })).rejects.toThrow('Fallo inducido');
    vi.restoreAllMocks();
    const result = await loadSnapshot();
    expect(result.movements).toEqual([original]); expect(result.settings.monthlyPlanCOP).toBe(120000);
  });
});
