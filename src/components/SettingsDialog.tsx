import { useRef, useState, type ChangeEvent } from 'react';
import type { PersonalSnapshot } from '../personal/types';
import type { ParsedBackup } from '../personal/backup';
import { createPersonalBackup, downloadPersonalBackup, parsePersonalBackup, personalBackupSummary } from '../personal/backup';
import { MAX_BACKUP_SIZE } from '../savings/backup';
import { formatCOP } from '../savings/calculations';
import { Modal, Icon } from './Shared';

export function SettingsDialog({ data, onClose, onRestore }: { data: PersonalSnapshot; onClose: () => void; onRestore: (backup: ParsedBackup) => Promise<void> }) {
  const [backup, setBackup] = useState<ParsedBackup | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  function exportNow() {
    setError(''); setNotice('');
    try { downloadPersonalBackup(createPersonalBackup(data)); setNotice('Descarga solicitada. Comprueba que el archivo quedó guardado.'); }
    catch { setError('No se pudo preparar la copia. Inténtalo de nuevo.'); }
  }
  async function shareNow() {
    setError('');
    const snapshot = createPersonalBackup(data);
    const file = new File([JSON.stringify(snapshot, null, 2)], `aiden-personal.json`, { type: 'application/json' });
    if (!navigator.canShare?.({ files: [file] }) || !navigator.share) { setError('Tu navegador no permite compartir archivos. Usa Exportar copia.'); return; }
    try { await navigator.share({ files: [file], title: 'Copia de aiden.' }); }
    catch (e) { if ((e as DOMException).name !== 'AbortError') setError('No se pudo compartir. Usa Exportar copia.'); }
  }
  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    setBackup(null); setError(''); setNotice('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_SIZE) { setError('El archivo supera el límite de 5 MB.'); return; }
    try { setBackup(parsePersonalBackup(await file.text())); }
    catch (err) { setError(err instanceof Error ? err.message : 'La copia no es válida.'); }
  }
  async function restore() {
    if (!backup || gate.current) return;
    gate.current = true; setBusy(true); setError('');
    try { await onRestore(backup); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo importar. Tus datos anteriores no cambiaron.'); }
    finally { setBusy(false); gate.current = false; }
  }
  const info = backup ? personalBackupSummary(backup) : null;
  return <Modal title="Ajustes y copias" onClose={onClose} busy={busy} wide>
    <div className="backup-section">
      <h3>Guardar una copia</h3>
      <p>Tus ahorros, eventos, tareas y countdowns se guardan localmente. GitHub Pages no los respalda.</p>
      <button className="button-secondary" type="button" onClick={exportNow} disabled={busy}><Icon name="download" /> Exportar copia</button>
      <button className="text-action" type="button" onClick={() => { void shareNow(); }} disabled={busy}>Compartir archivo…</button>
    </div>
    <div className="section-divider" />
    <div className="backup-section">
      <h3>Restaurar desde un archivo</h3>
      <p>Una copia v3 reemplaza todos tus datos. Una copia antigua v1/v2 reemplaza solo los ahorros y conserva la agenda, tareas y countdowns.</p>
      <input ref={fileInput} className="sr-only" id="backup-file" type="file" accept=".json,application/json" onChange={(e) => { void chooseFile(e); }} />
      <button className="button-secondary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Icon name="upload" /> Importar copia</button>
      {backup && info && <div className="backup-preview" aria-label="Resumen de la copia">
        <p><strong>{backup.kind === 'full' ? 'Copia integral v3 validada' : 'Copia de ahorros v1/v2 validada'}</strong></p>
        <dl><div><dt>Movimientos</dt><dd>{info.movements}</dd></div><div><dt>Saldo</dt><dd>{formatCOP(info.total)}</dd></div><div><dt>Plan mensual</dt><dd>{(backup.kind === 'full' ? backup.data : backup.savings).settings.monthlyPlanCOP === null ? 'Sin configurar' : formatCOP((backup.kind === 'full' ? backup.data : backup.savings).settings.monthlyPlanCOP)}</dd></div><div><dt>Meta final</dt><dd>{(backup.kind === 'full' ? backup.data : backup.savings).settings.finalGoalCOP === null ? 'Sin configurar' : formatCOP((backup.kind === 'full' ? backup.data : backup.savings).settings.finalGoalCOP)}</dd></div></dl>
        {backup.kind==='full' && <p className="field-hint">{info.events} eventos · {info.tasks} tareas · {info.countdowns} countdowns</p>}
        <p className="backup-warning">{backup.kind === 'full' ? 'Se reemplazarán todos los datos actuales. Exporta una copia antes de continuar.' : 'Solo se reemplazarán los ahorros. Calendario, tareas y countdowns permanecerán intactos.'}</p>
        <button type="button" className="button-danger" disabled={busy} onClick={() => { void restore(); }}>{busy ? 'Importando…' : 'Reemplazar mis datos'}</button>
        <button type="button" className="text-action" disabled={busy} onClick={() => { setBackup(null); if (fileInput.current) fileInput.current.value = ''; }}>Cancelar importación</button>
      </div>}
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    {notice && <p className="field-hint" role="status">{notice}</p>}
    <p className="local-warning">Si cambias de teléfono, navegador o dirección web, necesitarás exportar e importar una copia. No existe sincronización automática.</p>
  </Modal>;
}
