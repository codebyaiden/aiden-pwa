import { useRef, useState, type FormEvent } from 'react';
import { bogotaToday, formatCOP } from '../savings/calculations';
import type { Movement, MovementType } from '../savings/types';
import { parseMoneyInput } from '../savings/validation';
import { Modal } from './Shared';

export function AddMovementDialog({ type, original, onDismiss, onSave }: {
  type: MovementType; original?: Movement;
  onDismiss: () => void;
  onSave: (next: Movement, mode: 'add' | 'edit') => Promise<void>;
}) {
  const today = bogotaToday();
  const [amount, setAmount] = useState(original ? String(original.amountCOP) : '');
  const [date, setDate] = useState(original?.localDate ?? today);
  const [note, setNote] = useState(original?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const gate = useRef(false);
  const pending = useRef<Movement | null>(null);
  const value = parseMoneyInput(amount);
  const valid = value !== null && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today && note.length <= 120;
  const isEdit = Boolean(original);
  const action = isEdit ? 'Guardar cambios' : type === 'deposit' ? 'Guardar aporte' : 'Registrar retiro';
  const title = isEdit ? 'Editar movimiento' : type === 'deposit' ? 'Añadir dinero' : 'Retirar dinero';
  const dirty = amount !== (original ? String(original.amountCOP) : '') || date !== (original?.localDate ?? today) || note !== (original?.note ?? '');
  function updateAmount(v: string) { setAmount(v); setError(''); setWithdrawConfirm(false); }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gate.current || !valid || value === null) { setTried(true); return; }
    if (type === 'withdrawal' && !withdrawConfirm) { setWithdrawConfirm(true); return; }
    gate.current = true;
    setBusy(true);
    setError('');
    const now = new Date().toISOString();
    const normalizedNote = note.trim() || undefined;
    const previous = pending.current;
    const changedSinceAttempt = previous !== null && (previous.amountCOP !== value || previous.localDate !== date || previous.note !== normalizedNote);
    const movement: Movement = isEdit ? {
      ...original!, amountCOP: value, localDate: date, note: normalizedNote, updatedAt: now
    } : previous ? {
      ...previous, amountCOP: value, localDate: date, note: normalizedNote,
      updatedAt: changedSinceAttempt ? now : previous.updatedAt
    } : {
      id: crypto.randomUUID(), type, amountCOP: value, localDate: date,
      createdAt: now, updatedAt: now, note: normalizedNote
    };
    if (!isEdit) pending.current = movement;
    try { await onSave(movement, isEdit ? 'edit' : 'add'); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar. Inténtalo de nuevo.'); }
    finally { gate.current = false; setBusy(false); }
  }
  return <Modal title={title} onClose={onDismiss} dirty={dirty} busy={busy}>
    <form onSubmit={(e) => { void submit(e); }} className="form-stack" noValidate>
      <div className="field"><label htmlFor="amount">Cantidad</label>
        <div className="amount-wrap"><span aria-hidden="true">$</span><input id="amount" type="text" inputMode="numeric" autoComplete="off" placeholder="0" value={amount} onChange={(e) => updateAmount(e.target.value)} aria-invalid={tried && value === null} aria-describedby="amount-hint" /></div>
        <p id="amount-hint" className={`field-hint ${tried && value === null ? 'field-error' : ''}`}>{value !== null ? `${formatCOP(value)} COP` : tried && value === null ? 'Escribe un monto entero entre $1 y $999.999.999.' : 'Pesos colombianos, sin decimales.'}</p>
        {!isEdit && type === 'deposit' && <div className="chips" aria-label="Montos rápidos">{[5000, 10000, 20000, 50000].map((v) => <button type="button" className={value === v ? 'chip selected' : 'chip'} onClick={() => updateAmount(String(v))} key={v}>{formatCOP(v)}</button>)}</div>}
      </div>
      <div className="field"><label htmlFor="movement-date">Fecha</label><input id="movement-date" className="text-field" type="date" value={date} min="1900-01-01" max={today} required onChange={(e) => { setDate(e.target.value); setWithdrawConfirm(false); }} /></div>
      <div className="field"><label htmlFor="movement-note">Nota (opcional)</label><input id="movement-note" className="text-field" type="text" maxLength={120} value={note} onChange={(e) => { setNote(e.target.value); setWithdrawConfirm(false); }} placeholder="" /></div>
      {withdrawConfirm && value !== null && <p className="confirm-message">Confirma el retiro de <strong>{formatCOP(value)}</strong> del {date}. Se descontará del saldo.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="button-primary" type="submit" disabled={!valid || busy}>{busy ? 'Guardando…' : type === 'withdrawal' && !withdrawConfirm ? 'Continuar' : action}</button>
    </form>
  </Modal>;
}
