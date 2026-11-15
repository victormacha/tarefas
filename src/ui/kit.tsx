import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ATTRS, EFFORTS, FRONTS } from '../lib/meta';
import type { Effort, FrontKey } from '../lib/types';
import { clearLevelUp, dismissToast, useUI } from '../lib/ui';

// Peças de interface reutilizadas por todas as telas.

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1.8 20.8 6.9v10.2L12 22.2 3.2 17.1V6.9L12 1.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
      <path d="M12 6.2 16.6 9.4 15.4 15.2 12 17.4 7.6 14.2 8.4 8.6 12 6.2Z" fill="currentColor" />
    </svg>
  );
}

export const frontStyle = (front: FrontKey) => ({ '--c': FRONTS[front].color }) as CSSProperties;

export function FrontTag({ front, label }: { front: FrontKey; label?: string }) {
  return (
    <span className="tag">
      <i className="dot" style={frontStyle(front)} />
      {label ?? FRONTS[front].label}
    </span>
  );
}

export function Pips({ effort }: { effort: Effort }) {
  return (
    <span className="pips" role="img" aria-label={`Esforço: ${EFFORTS[effort].label}`} title={`${EFFORTS[effort].label} · +${EFFORTS[effort].xp} XP`}>
      {[1, 2, 3, 4].map((n) => (
        <i key={n} className={n <= effort ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Meter({ value, color, thin, label }: { value: number; color?: string; thin?: boolean; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`meter${thin ? ' meter--thin' : ''}`}
      style={color ? ({ '--c': color } as CSSProperties) : undefined}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 36, stroke = 3, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="ring-wrap" style={{ width: size, height: size }}>
      <svg className="ring" width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fg)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: 'stroke-dashoffset .6s var(--ease)' }}
        />
      </svg>
      {children !== undefined && <span>{children}</span>}
    </span>
  );
}

let locks = 0;
function useScrollLock() {
  useEffect(() => {
    locks++;
    document.body.style.overflow = 'hidden';
    return () => {
      locks--;
      if (!locks) document.body.style.overflow = '';
    };
  }, []);
}

export function Sheet({
  title, onClose, children, variant, head,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'side' | 'top';
  /** Conteúdo extra no cabeçalho, à direita do título. */
  head?: ReactNode;
}) {
  useScrollLock();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // Leva o foco para dentro da folha, sem roubar de um campo com autoFocus.
    if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className={`scrim${variant ? ` scrim--${variant}` : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2 className="title">{title}</h2>
          <div className="row-flex">
            {head}
            <button className="icon-btn" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <em className="field-hint" style={{ fontStyle: 'normal' }}>{hint}</em>}
    </label>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, wide, label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  wide?: boolean;
  label: string;
}) {
  return (
    <div className={`seg${wide ? ' seg--wide' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-title">{title}</span>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Botão destrutivo em dois toques — o Artifact não exibe confirm(). */
export function ConfirmButton({ label, confirm = 'Confirmar exclusão', onConfirm, small }: { label: string; confirm?: string; onConfirm: () => void; small?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`btn btn--danger${small ? ' btn--sm' : ''}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirm : label}
    </button>
  );
}

// ---- dica flutuante (hover e foco) ----

interface Tip {
  x: number;
  y: number;
  title: string;
  detail?: string;
}
let tip: Tip | null = null;
const tipListeners = new Set<() => void>();
const setTip = (t: Tip | null) => {
  tip = t;
  tipListeners.forEach((l) => l());
};

/** Props para qualquer marca de gráfico mostrar a mesma informação no hover e no foco. */
export function tipProps(title: string, detail?: string) {
  const show = (el: Element) => {
    const r = el.getBoundingClientRect();
    setTip({ x: Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130), y: r.top, title, detail });
  };
  return {
    onPointerEnter: (e: { currentTarget: Element }) => show(e.currentTarget),
    onPointerLeave: () => setTip(null),
    onFocus: (e: { currentTarget: Element }) => show(e.currentTarget),
    onBlur: () => setTip(null),
    'aria-label': detail ? `${title}: ${detail}` : title,
  };
}

export function TipHost() {
  const t = useSyncExternalStore(
    (l) => {
      tipListeners.add(l);
      return () => tipListeners.delete(l);
    },
    () => tip,
  );
  if (!t) return null;
  return createPortal(
    <div className="tip" style={{ left: t.x, top: t.y }} role="tooltip">
      <b>{t.title}</b>
      {t.detail}
    </div>,
    document.body,
  );
}

// ---- avisos ----

export function Toasts() {
  const { toasts, levelUp } = useUI();
  useEffect(() => {
    if (levelUp === null) return;
    const t = setTimeout(clearLevelUp, 2600);
    return () => clearTimeout(t);
  }, [levelUp]);
  return createPortal(
    <>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.tone === 'xp' && t.attr && <span className="toast-xp">+{t.xp} {ATTRS[t.attr].short}</span>}
            <span className="truncate">{t.text}</span>
            {t.undo && (
              <button
                onClick={() => {
                  t.undo?.();
                  dismissToast(t.id);
                }}
              >
                Desfazer
              </button>
            )}
          </div>
        ))}
      </div>
      {levelUp !== null && (
        <div className="levelup" onClick={clearLevelUp} role="status">
          <div className="levelup-card">
            <span className="label">Nível alcançado</span>
            <span className="levelup-num">{levelUp}</span>
            <span className="soft small">Você subiu de nível. Siga a build.</span>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

// ---- Markdown mínimo (sem innerHTML) ----

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const rx = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = rx.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++}>{buf.join('\n')}</pre>);
      continue;
    }
    const bullet = /^\s*[-*•]\s+/;
    const ordered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || ordered.test(line)) {
      const isOrdered = ordered.test(line);
      const rx = isOrdered ? ordered : bullet;
      const items: string[] = [];
      while (i < lines.length && rx.test(lines[i])) items.push(lines[i++].replace(rx, ''));
      const children = items.map((it, j) => <li key={j}>{inline(it, `l${k}-${j}`)}</li>);
      blocks.push(isOrdered ? <ol key={k++}>{children}</ol> : <ul key={k++}>{children}</ul>);
      continue;
    }
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(<p key={k} className="strong">{inline(heading[1], `h${k}`)}</p>);
      k++;
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('```') && !bullet.test(lines[i]) && !ordered.test(lines[i])) {
      buf.push(lines[i++]);
    }
    blocks.push(
      <p key={k}>
        {buf.flatMap((b, j) => (j ? [<br key={`b${j}`} />, ...inline(b, `p${k}-${j}`)] : inline(b, `p${k}-${j}`)))}
      </p>,
    );
    k++;
  }
  return <div className="md">{blocks}</div>;
}

/** "7,5" → 7.5 · "1.200,50" → 1200.5 · vazio → undefined */
export function parseNum(text: string): number | undefined {
  const t = text.trim().replace(/[^\d.,-]/g, '');
  if (!t) return undefined;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}
