import { useRef, useState, type FormEvent } from 'react';
import { formatCOP } from '../savings/calculations';
import { parsePlanInput } from '../savings/validation';
import { Modal } from './Shared';

export function PlanDialog({ current, onClose, onSave }: { current: number | null; onClose: () => void; onSave: (plan: number | null) => Promise<void> }) {
  const [value, setValue] = useState(current === null ? '' : String(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const gate = useRef(false);
  const parsed = value.trim() === '' ? null : parsePlanInput(value);
  const valid = value.trim() === '' || parsed !== null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || gate.current) return;
    gate.current = true; setBusy(true); setError('');
    try { await onSave(parsed); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.'); }
    finally { setBusy(false); gate.current = false; }
  }
  return <Modal title="Plan mensual" onClose={onClose} busy={busy} dirty={value !== (current === null ? '' : String(current))}>
    <form className="form-stack" onSubmit={(e) => { void submit(e); }}>
      <div className="field"><label htmlFor="plan-amount">Aporte previsto cada mes</label><div className="amount-wrap"><span>$</span><input id="plan-amount" type="text" inputMode="numeric" value={value} placeholder="Sin configurar" onChange={(e) => { setValue(e.target.value); setError(''); }} aria-invalid={!valid} aria-describedby="plan-hint" /></div><p className="field-hint" id="plan-hint">{!valid ? 'Escribe pesos enteros, sin decimales.' : parsed === null ? 'Sin plan configurado.' : parsed === 0 ? 'Sin aportes previstos.' : `${formatCOP(parsed)} COP al mes.`}</p></div>
      <p className="explanation">La proyección hasta julio de 2029 supone que completas este plan cada mes. No agrega dinero automáticamente ni anticipa retiros futuros.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="button-primary" type="submit" disabled={!valid || busy}>{busy ? 'Guardando…' : 'Guardar plan'}</button>
    </form>
  </Modal>;
}
