import { useRef, useState, type FormEvent } from 'react';
import { formatCOP } from '../savings/calculations';
import { parseGoalInput } from '../savings/validation';
import { Modal } from './Shared';

export function GoalDialog({ current, onClose, onSave }: {
  current: number | null; onClose: () => void; onSave: (goal: number | null) => Promise<void>;
}) {
  const [input, setInput] = useState(current === null ? '' : String(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const gate = useRef(false);
  const parsed = parseGoalInput(input);
  const changed = input !== (current === null ? '' : String(current));
  async function persist(value: number | null) {
    if (gate.current) return;
    gate.current = true; setBusy(true); setError('');
    try { await onSave(value); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.'); }
    finally { setBusy(false); gate.current = false; }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (parsed !== null) void persist(parsed);
  }
  return <Modal title="Meta de julio de 2029" onClose={onClose} dirty={changed} busy={busy}>
    <form onSubmit={submit} className="form-stack" noValidate>
      <div className="field"><label htmlFor="goal-amount">Dinero que quieres alcanzar</label>
        <div className="amount-wrap"><span aria-hidden="true">$</span><input id="goal-amount" inputMode="numeric" type="text" autoComplete="off" value={input} onChange={(e) => { setInput(e.target.value); setError(''); }} placeholder="0" aria-invalid={input.length > 0 && parsed === null} aria-describedby="goal-hint" /></div>
        <p id="goal-hint" className={input.length > 0 && parsed === null ? 'field-error' : 'field-hint'}>{parsed === null ? 'Pesos enteros entre $1 y $99.999.999.999.' : `${formatCOP(parsed)} COP para el 31 de julio de 2029.`}</p>
      </div>
      <p className="explanation">Esta meta es independiente del plan mensual. Cambiarla no altera lo que has guardado.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" className="button-primary" disabled={busy || parsed === null}>{busy ? 'Guardando…' : 'Guardar meta'}</button>
      {current !== null && <button type="button" className="text-action remove-goal" disabled={busy} onClick={() => { if (window.confirm('¿Eliminar la meta final? Tus movimientos y tu saldo no cambiarán.')) void persist(null); }}>Eliminar meta</button>}
    </form>
  </Modal>;
}
