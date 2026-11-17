import type { Movement } from '../savings/types';
import { formatCOP, formatDate } from '../savings/calculations';
import { Icon } from './Shared';

export function MovementList({ movements, today, onSelect, newlySavedId }: { movements: Movement[]; today: string; onSelect: (m: Movement) => void; newlySavedId?: string | null }) {
  if (movements.length === 0) return <p className="empty-state">Todavía no has registrado dinero.</p>;
  return <div className="movement-list">{movements.map((m) => <button key={m.id} type="button" className={`movement-row ${newlySavedId === m.id ? 'new-row' : ''}`} onClick={() => onSelect(m)} aria-label={`${m.type === 'deposit' ? 'Aporte' : 'Retiro'} de ${formatCOP(m.amountCOP)} el ${m.localDate}${m.note ? `. ${m.note}` : ''}. Ver detalle`}>
    <span className="movement-main"><strong className={m.type === 'withdrawal' ? 'negative' : ''}>{m.type === 'deposit' ? '+' : '−'} {formatCOP(m.amountCOP)}</strong>{m.note && <span className="movement-note">{m.note}</span>}</span>
    <span className="movement-right"><span>{formatDate(m.localDate, today)}</span><Icon name="right" /></span>
  </button>)}</div>;
}
