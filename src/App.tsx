import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { bogotaToday, formatCOP, monthTotals, monthlyProgress, sortNewest } from './savings/calculations';
import type { BackupV1, Movement, MovementType, Snapshot } from './savings/types';
import { loadSnapshot, removeMovement, restoreSnapshot, saveMonthlyPlan, saveMovement } from './savings/storage';
import { AddMovementDialog } from './components/AddMovementDialog';
import { MovementList } from './components/MovementList';
import { PlanDialog } from './components/PlanDialog';
import { SavingsDetail } from './components/SavingsDetail';
import { SavingsHero } from './components/SavingsHero';
import { SettingsDialog } from './components/SettingsDialog';
import { Icon, Modal } from './components/Shared';

type Overlay = { kind: 'movement'; type: MovementType; movement?: Movement } | { kind: 'detail'; movement: Movement } | { kind: 'plan' } | { kind: 'settings' };

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [today, setToday] = useState(bogotaToday);
  const [view, setView] = useState<'home' | 'detail'>(() => location.hash === '#alcancia' ? 'detail' : 'home');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(''), 2900); return () => clearTimeout(timer); }, [message]);
  const [newId, setNewId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW() { /* no actualización automática que descarte un formulario */ }
  });
  const refresh = useCallback(async () => {
    try {
      const fresh = await loadSnapshot();
      setSnapshot(fresh); setLoadError(''); setToday(bogotaToday());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'No se pudieron leer tus datos.');
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const handler = () => setView(location.hash === '#alcancia' ? 'detail' : 'home');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try { if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('aiden-savings-updates'); } catch { /* recarga al recuperar foco */ }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const onFocus = () => { void refresh(); };
    const onMessage = () => { void refresh(); };
    channel?.addEventListener('message', onMessage);
    window.addEventListener('focus', onFocus);
    window.addEventListener('aiden:storage-changed', onMessage);
    document.addEventListener('visibilitychange', onVisible);
    return () => { channel?.close(); window.removeEventListener('focus', onFocus); window.removeEventListener('aiden:storage-changed', onMessage); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);
  const changed = () => {
    try { const channel = new BroadcastChannel('aiden-savings-updates'); channel.postMessage('changed'); channel.close(); } catch { /* soporte opcional */ }
  };
  const commitAndRefresh = async (work: () => Promise<void>) => {
    await work();
    changed();
    try {
      const fresh = await loadSnapshot();
      setSnapshot(fresh); setLoadError(''); setToday(bogotaToday());
    } catch {
      throw new Error('El cambio se guardó, pero no se pudo leer de nuevo. Reintenta sin cerrar este formulario.');
    }
  };
  async function save(next: Movement, mode: 'add' | 'edit') {
    await commitAndRefresh(() => saveMovement(next, mode));
    setOverlay(null); setNewId(next.id);
    setMessage(mode === 'edit' ? 'Movimiento actualizado' : next.type === 'deposit' ? 'Aporte guardado' : 'Retiro registrado');
  }
  async function savePlan(next: number | null) {
    await commitAndRefresh(() => saveMonthlyPlan(next));
    setOverlay(null); setMessage('Plan guardado');
  }
  async function restore(backup: BackupV1) {
    await commitAndRefresh(() => restoreSnapshot(backup));
    setNewId(null); setOverlay(null); setMessage('Copia restaurada');
  }
  async function remove(movement: Movement) {
    if (removing) return;
    setRemoving(true); setRemoveError('');
    try { await commitAndRefresh(() => removeMovement(movement.id)); setOverlay(null); setNewId(null); setMessage('Movimiento eliminado'); }
    catch (e) { setRemoveError(e instanceof Error ? e.message : 'No se pudo eliminar. Inténtalo de nuevo.'); }
    finally { setRemoving(false); }
  }
  function navigate(which: 'home' | 'detail') {
    location.hash = which === 'detail' ? '#alcancia' : '';
    setView(which);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  const nowLabel = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${today}T12:00:00-05:00`));
  const net = snapshot ? monthTotals(snapshot.movements, today.slice(0, 7)).net : 0;
  const progress = monthlyProgress(net, snapshot?.settings.monthlyPlanCOP ?? null);
  const selectedMovement = overlay?.kind === 'detail' ? snapshot?.movements.find((m) => m.id === overlay.movement.id) : null;
  return <div className="app-shell">
    <header className="app-header"><div><button type="button" className="wordmark" onClick={() => navigate('home')} aria-label="Ir a inicio">aiden<span>.</span></button><p className="header-date">{nowLabel}</p></div><button type="button" className="icon-button settings-button" aria-label="Ajustes y copias de seguridad" disabled={!snapshot} onClick={() => setOverlay({ kind: 'settings' })}><Icon name="settings" /></button></header>
    <main id="main-content">
      {loadError ? <section className="load-error" role="alert"><h1>No pudimos leer tus datos</h1><p>{loadError}</p><p>No se han reemplazado ni reiniciado tus movimientos. Comprueba el almacenamiento del navegador.</p><button className="button-primary" onClick={() => { void refresh(); }}>Reintentar</button></section>
        : !snapshot ? <p className="loading-label" role="status">Cargando alcancía…</p>
        : view === 'home' ? <>
          <SavingsHero data={snapshot} today={today} onConfigure={() => setOverlay({ kind: 'plan' })} />
          <button className="button-primary add-main" onClick={() => setOverlay({ kind: 'movement', type: 'deposit' })}><Icon name="plus" /> Añadir dinero</button>
          {progress && <section className="monthly-progress" aria-label="Plan mensual"><div className="section-title-row"><h2>Plan mensual</h2><span className="progress-percent">{Math.round(progress.fraction * 100)}%</span></div><div className="progress-track" role="progressbar" aria-label="Progreso del plan mensual" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}><div style={{ width: `${progress.fraction * 100}%` }} /></div><p className="progress-description">{progress.complete ? 'Plan cumplido' : `Faltan ${formatCOP(progress.remaining)}`}</p></section>}
          <section className="recent-movements"><div className="section-title-row"><h2>Movimientos recientes</h2><button type="button" className="text-action" onClick={() => navigate('detail')}>Ver todos</button></div><MovementList movements={sortNewest(snapshot.movements).slice(0, 4)} today={today} onSelect={(movement) => setOverlay({ kind: 'detail', movement })} newlySavedId={newId} /></section>
          {snapshot.movements.length > 0 && <button type="button" className="footer-link" onClick={() => navigate('detail')}>Ver historial completo <Icon name="right" /></button>}
        </> : <SavingsDetail data={snapshot} today={today} newlySavedId={newId} onBack={() => navigate('home')} onAdd={() => setOverlay({ kind: 'movement', type: 'deposit' })} onWithdraw={() => setOverlay({ kind: 'movement', type: 'withdrawal' })} onPlan={() => setOverlay({ kind: 'plan' })} onSelect={(movement) => { setRemoveError(''); setOverlay({ kind: 'detail', movement }); }} /> }
    </main>
    {needRefresh && !overlay && <aside className="update-banner"><span>Hay una versión nueva.</span><button type="button" className="text-action" onClick={() => { void updateServiceWorker(true); }}>Actualizar</button></aside>}
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</div>
    {message && <div className="toast" role="presentation">{message}</div>}
    {snapshot && overlay?.kind === 'movement' && <AddMovementDialog key={`${overlay.type}-${overlay.movement?.id ?? 'new'}`} type={overlay.type} original={overlay.movement} onDismiss={() => setOverlay(null)} onSave={save} />}
    {snapshot && overlay?.kind === 'plan' && <PlanDialog current={snapshot.settings.monthlyPlanCOP} onClose={() => setOverlay(null)} onSave={savePlan} />}
    {snapshot && overlay?.kind === 'settings' && <SettingsDialog data={snapshot} onClose={() => setOverlay(null)} onRestore={restore} />}
    {snapshot && overlay?.kind === 'detail' && selectedMovement && <Modal title="Detalle del movimiento" onClose={() => setOverlay(null)} busy={removing}>
      <div className="movement-inspection"><span className="eyebrow">{selectedMovement.type === 'deposit' ? 'Aporte' : 'Retiro'}</span><strong>{selectedMovement.type === 'deposit' ? '+' : '−'} {formatCOP(selectedMovement.amountCOP)}</strong><p>{selectedMovement.localDate}</p>{selectedMovement.note && <p className="detail-note">{selectedMovement.note}</p>}</div>
      {removeError && <p className="field-error" role="alert">{removeError}</p>}
      <div className="inspection-actions"><button type="button" className="button-primary" onClick={() => setOverlay({ kind: 'movement', type: selectedMovement.type, movement: selectedMovement })} disabled={removing}>Editar</button><button type="button" className="button-danger-outline" onClick={() => { if (window.confirm('¿Eliminar movimiento? Esto cambiará el saldo y no se puede deshacer.')) void remove(selectedMovement); }} disabled={removing}>{removing ? 'Eliminando…' : 'Eliminar movimiento'}</button></div>
    </Modal>}
  </div>;
}
