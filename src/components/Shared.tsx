import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatCOP } from '../savings/calculations';

export type IconName = 'plus' | 'settings' | 'back' | 'close' | 'left' | 'right' | 'download' | 'upload';
const paths: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.1 15.5a8 8 0 0 0 .1-7l-2.2.1-1.4-1.4.1-2.2a8 8 0 0 0-7 0l.1 2.2-1.4 1.4-2.2-.1a8 8 0 0 0 0 7l2.2-.1 1.4 1.4-.1 2.2a8 8 0 0 0 7 0l-.1-2.2 1.4-1.4 2.2.1Z" transform="translate(0 1)"/></>,
  back: <path d="m15 18-6-6 6-6M9 12h12" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />,
  upload: <path d="M12 17V5m0 0-4 4m4-4 4 4M5 17v3h14v-3" />
};
export function Icon({ name }: { name: IconName }) { return <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>; }
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduce;
}
export function AnimatedMoney({ value, className = '' }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const initialized = useRef(false);
  const visible = useRef(value);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!initialized.current) { initialized.current = true; visible.current = value; setShown(value); return; }
    const from = visible.current;
    if (from === value || reduced) { visible.current = value; setShown(value); return; }
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const p = Math.min(1, (now - start) / 360);
      const eased = 1 - Math.pow(1 - p, 3);
      visible.current = Math.round(from + (value - from) * eased);
      setShown(visible.current);
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    setShown(from);
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <span className={`animated-money ${className}`}><span aria-hidden="true">{formatCOP(shown)}</span><span className="sr-only">{formatCOP(value)} pesos colombianos</span></span>;
}

export function Modal({ title, children, onClose, dirty = false, busy = false, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; dirty?: boolean; busy?: boolean; wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();
  const leaving = useRef(false);
  const close = () => {
    if (busy || leaving.current) return;
    if (dirty && !window.confirm('¿Descartar los cambios sin guardar?')) return;
    if (reduced || !dialog.current?.animate) { onClose(); return; }
    leaving.current = true;
    const element = dialog.current;
    const animation = element.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(16px)', opacity: 0 }
    ], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    animation.onfinish = onClose;
  };
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
    const focus = el.querySelector<HTMLButtonElement>('.modal-close');
    focus?.focus({ preventScroll: true });
    return () => { if (el.open) el.close(); previousFocus?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className={`sheet ${wide ? 'sheet-wide' : ''}`} aria-label={title}
    onCancel={(e) => { e.preventDefault(); close(); }}>
    <div className="sheet-top"><h2>{title}</h2><button className="icon-button modal-close" type="button" disabled={busy} aria-label="Cerrar" onClick={close}><Icon name="close" /></button></div>
    <div className="sheet-content">{children}</div>
  </dialog>;
}
