import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { addGoal, addTx, contributeGoal, deleteGoal, deleteTx, setProfile, updateGoal, updateTx } from '../lib/actions';
import { addMonths, fmtDay, fmtMoney, fmtMonth, MONTHS_SHORT, todayISO, ymOf } from '../lib/dates';
import { monthSeries, monthSummary, receivables, type Bucket } from '../lib/finance';
import { EXPENSE_CATEGORIES, FRONTS, INCOME_SOURCES } from '../lib/meta';
import { useApp } from '../lib/store';
import type { Goal, ID, Tx } from '../lib/types';
import { useToday } from '../ui/hooks';
import { ConfirmButton, Empty, Field, Meter, Segmented, Sheet, parseNum, tipProps } from '../ui/kit';

const COFRE = FRONTS.cofre.color;

export function VaultView() {
  const state = useApp();
  const today = useToday();
  const [ym, setYm] = useState(ymOf(today));
  const [tx, setTx] = useState<ID | 'new' | null>(null);
  const [goal, setGoal] = useState<ID | 'new' | null>(null);

  const { txs, goals } = state.vault;
  const month = useMemo(() => monthSummary(txs, ym), [txs, ym]);
  const series = useMemo(() => monthSeries(txs, ym, 6), [txs, ym]);
  const rec = useMemo(() => receivables(state.studio.jobs), [state.studio.jobs]);
  const target = state.profile.incomeGoal;
  const isCurrent = ym === ymOf(today);
  const empty = !txs.length && !goals.length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="label">Fortuna</span>
          <h1 className="display">Cofre</h1>
        </div>
        <div className="head-actions">
          <div className="row-flex" style={{ gap: 2 }}>
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, -1))} aria-label="Mês anterior">
              <ChevronLeft size={18} />
            </button>
            <span className="small strong nowrap" style={{ minWidth: 128, textAlign: 'center' }}>{fmtMonth(ym)}</span>
            <button className="icon-btn" onClick={() => setYm(addMonths(ym, 1))} aria-label="Próximo mês" disabled={isCurrent}>
              <ChevronRight size={18} />
            </button>
          </div>
          <button className="btn btn--primary" onClick={() => setTx('new')}>
            <Plus size={16} /> Lançamento
          </button>
        </div>
      </header>

      {empty && (
        <Empty
          title="Seu dinheiro, medido contra a sua meta"
          action={
            <button className="btn btn--primary" onClick={() => setTx('new')}>
              <Plus size={16} /> Primeiro lançamento
            </button>
          }
        >
          Registre entradas e saídas (ou escreva “gastei 32 no uber” na captura). Trabalhos marcados como pagos no Estúdio entram aqui sozinhos. Você
          vê de onde vem a receita, para onde ela vai e quanto falta para a meta do mês.
        </Empty>
      )}

      <div className="cols">
        <div className="stack">
          <section className="section">
            <h2 className="label">Receita de {MONTHS_SHORT[Number(ym.slice(5)) - 1]}</h2>
            <div className="row-flex wrap" style={{ alignItems: 'baseline', gap: '6px 14px' }}>
              <span className="hero-num">{fmtMoney(month.income)}</span>
              {target > 0 && <span className="soft">de {fmtMoney(target)}</span>}
            </div>
            {target > 0 ? (
              <>
                <Meter value={month.income / target} color={COFRE} label="Receita em relação à meta" />
                <span className="small soft">
                  {month.income >= target
                    ? 'Meta batida.'
                    : `Faltam ${fmtMoney(target - month.income)}${isCurrent && rec.due ? ` · ${fmtMoney(rec.due)} já entregues aguardando pagamento` : ''}`}
                </span>
              </>
            ) : (
              <GoalPrompt />
            )}
          </section>

          <div className="stats">
            <div className="stat">
              <span className="label">Despesas</span>
              <b>{fmtMoney(month.expense)}</b>
            </div>
            <div className="stat">
              <span className="label">Saldo do mês</span>
              <b>{fmtMoney(month.balance)}</b>
            </div>
            {isCurrent && (
              <>
                <div className="stat">
                  <span className="label">A receber</span>
                  <b>{fmtMoney(rec.due)}</b>
                </div>
                <div className="stat">
                  <span className="label">Em produção</span>
                  <b>{fmtMoney(rec.inProgress)}</b>
                </div>
              </>
            )}
          </div>

          {month.sources.length > 0 && <Ranked title="De onde veio" buckets={month.sources} color={COFRE} />}
          {month.categories.length > 0 && <Ranked title="Para onde foi" buckets={month.categories.slice(0, 6)} color="var(--fg-3)" />}

          <section className="section">
            <div className="section-head">
              <h2 className="label">Lançamentos</h2>
              <span className="small muted">{month.txs.length}</span>
            </div>
            {!month.txs.length ? (
              <p className="small muted">Nada lançado em {fmtMonth(ym)}.</p>
            ) : (
              <div className="list">
                {month.txs.map((t) => (
                  <button key={t.id} className="row" onClick={() => setTx(t.id)}>
                    <span className="mono muted nowrap" style={{ width: 48 }}>{fmtDay(t.date)}</span>
                    <span className="row-main">
                      <span className="row-title">{t.note || t.category}</span>
                      <span className="row-meta">{t.kind === 'in' ? 'Entrada' : 'Saída'} · {t.category}</span>
                    </span>
                    <span className={`nowrap ${t.kind === 'in' ? 'strong' : 'soft'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {t.kind === 'in' ? '+ ' : '− '}
                      {fmtMoney(t.amount, true)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="section">
            <h2 className="label">Últimos 6 meses</h2>
            <MonthsChart series={series} />
            <div className="legend">
              <span><i style={{ background: COFRE }} />Receita</span>
              <span><i style={{ background: 'var(--fg-3)' }} />Despesas</span>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="label">Metas</h2>
              <button className="btn btn--sm" onClick={() => setGoal('new')}>
                <Plus size={14} /> Meta
              </button>
            </div>
            {!goals.length && <p className="small muted">Reserva, equipamento novo, um curso: dê um valor e acompanhe os aportes.</p>}
            <div className="list">
              {goals.map((g) => (
                <button key={g.id} className="row" onClick={() => setGoal(g.id)} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                  <span className="row-flex">
                    <span className="row-title grow">{g.title}</span>
                    <span className="small soft nowrap">
                      {fmtMoney(g.saved)} de {fmtMoney(g.target)}
                    </span>
                  </span>
                  <Meter value={g.target ? g.saved / g.target : 0} color={COFRE} label={`Progresso de ${g.title}`} />
                  {g.deadline && <span className="small muted">até {fmtDay(g.deadline)}</span>}
                </button>
              ))}
            </div>
          </section>

          {isCurrent && rec.dueJobs.length > 0 && (
            <section className="section">
              <h2 className="label">Entregue, aguardando pagamento</h2>
              <div className="list">
                {rec.dueJobs.map((j) => (
                  <div key={j.id} className="row">
                    <span className="row-main">
                      <span className="row-title">{j.client}</span>
                      <span className="row-meta">{j.title}</span>
                    </span>
                    <span className="strong nowrap">{fmtMoney(j.price)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {tx && <TxSheet tx={tx === 'new' ? undefined : txs.find((t) => t.id === tx)} onClose={() => setTx(null)} />}
      {goal && <GoalSheet goal={goal === 'new' ? undefined : goals.find((g) => g.id === goal)} onClose={() => setGoal(null)} />}
    </div>
  );
}

function GoalPrompt() {
  const [v, setV] = useState('');
  return (
    <form
      className="row-flex"
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseNum(v);
        if (n && n > 0) setProfile({ incomeGoal: n });
      }}
    >
      <input id="income-goal-inline" className="input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="Defina sua meta de receita mensal (R$)" />
      <button className="btn" type="submit" disabled={!parseNum(v)}>Definir</button>
    </form>
  );
}

/** Barras ranqueadas em um só tom: comparar partes entre si. */
function Ranked({ title, buckets, color }: { title: string; buckets: Bucket[]; color: string }) {
  const max = Math.max(...buckets.map((b) => b.amount), 1);
  const total = buckets.reduce((s, b) => s + b.amount, 0) || 1;
  return (
    <section className="section">
      <h2 className="label">{title}</h2>
      <div className="bars">
        {buckets.map((b) => (
          <div key={b.name} className="bar-row" tabIndex={0} {...tipProps(b.name, `${fmtMoney(b.amount, true)} · ${Math.round((b.amount / total) * 100)}% do total`)}>
            <span className="truncate">{b.name}</span>
            <span className="bar-track">
              <i className="bar-fill" style={{ width: `${(b.amount / max) * 100}%`, '--c': color } as CSSProperties} />
            </span>
            <span className="bar-val">{fmtMoney(b.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(n)));

function niceMax(n: number): number {
  if (n <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 2.5, 5, 10]) if (n <= m * pow) return m * pow;
  return 10 * pow;
}

/** Colunas pareadas (receita × despesa) em um único eixo. */
function MonthsChart({ series }: { series: { ym: string; income: number; expense: number }[] }) {
  const W = 360;
  const H = 168;
  const pad = { l: 40, r: 6, t: 18, b: 22 };
  const max = niceMax(Math.max(...series.flatMap((s) => [s.income, s.expense])));
  const plotH = H - pad.t - pad.b;
  const band = (W - pad.l - pad.r) / series.length;
  const bw = Math.min(16, (band - 12) / 2);
  const y = (v: number) => pad.t + plotH * (1 - v / max);
  const col = (x: number, v: number) => {
    const top = y(v);
    const h = pad.t + plotH - top;
    if (h <= 0.5) return '';
    const r = Math.min(4, h);
    return `M${x},${pad.t + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + plotH} Z`;
  };
  const last = series.length - 1;

  return (
    <svg className="cols-chart" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Receita e despesas dos últimos seis meses">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke={f === 0 ? 'var(--line-2)' : 'var(--line)'} strokeWidth="1" />
          <text x={pad.l - 6} y={y(max * f) + 4} textAnchor="end">{compact(max * f)}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const x0 = pad.l + band * i + (band - (bw * 2 + 2)) / 2;
        const label = MONTHS_SHORT[Number(s.ym.slice(5)) - 1];
        return (
          <g key={s.ym}>
            <path d={col(x0, s.income)} fill={COFRE} tabIndex={0} {...tipProps(`Receita · ${label}`, fmtMoney(s.income, true))} />
            <path d={col(x0 + bw + 2, s.expense)} fill="var(--fg-3)" tabIndex={0} {...tipProps(`Despesas · ${label}`, fmtMoney(s.expense, true))} />
            {i === last && s.income > 0 && (
              <text className="val" x={x0 + bw / 2} y={y(s.income) - 5} textAnchor="middle">{compact(s.income)}</text>
            )}
            <text x={pad.l + band * i + band / 2} y={H - 6} textAnchor="middle">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function TxSheet({ tx, onClose }: { tx?: Tx; onClose: () => void }) {
  const [kind, setKind] = useState<'in' | 'out'>(tx?.kind ?? 'out');
  const [amount, setAmount] = useState(tx ? String(tx.amount).replace('.', ',') : '');
  const [category, setCategory] = useState(tx?.category ?? EXPENSE_CATEGORIES[1]);
  const [date, setDate] = useState(tx?.date ?? todayISO());
  const [note, setNote] = useState(tx?.note ?? '');
  const options = kind === 'in' ? INCOME_SOURCES : EXPENSE_CATEGORIES;
  const cat = options.includes(category) ? category : options[0];

  const save = () => {
    const n = parseNum(amount);
    if (!n || n <= 0) return;
    const data = { kind, amount: n, category: cat, date, note: note.trim() || undefined };
    if (tx) updateTx(tx.id, data);
    else addTx(data);
    onClose();
  };

  return (
    <Sheet title={tx ? 'Lançamento' : 'Novo lançamento'} onClose={onClose}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Segmented
          label="Tipo de lançamento"
          wide
          value={kind}
          onChange={setKind}
          options={[
            { value: 'out', label: 'Saída' },
            { value: 'in', label: 'Entrada' },
          ]}
        />
        <div className="form-row">
          <Field label="Valor (R$)">
            <input id="tx-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!tx} placeholder="0,00" />
          </Field>
          <Field label="Data">
            <input id="tx-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label={kind === 'in' ? 'Fonte' : 'Categoria'}>
          <select id="tx-category" className="select" value={cat} onChange={(e) => setCategory(e.target.value)}>
            {options.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Descrição">
          <input id="tx-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </Field>
        <div className="sheet-foot">
          {tx && (
            <ConfirmButton
              label="Excluir"
              onConfirm={() => {
                deleteTx(tx.id);
                onClose();
              }}
            />
          )}
          <span className="spacer" />
          <button className="btn btn--primary" type="submit" disabled={!parseNum(amount)}>
            {tx ? 'Salvar' : 'Lançar'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function GoalSheet({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [aporte, setAporte] = useState('');

  const save = () => {
    const n = parseNum(target);
    if (!title.trim() || !n || n <= 0) return;
    if (goal) updateGoal(goal.id, { title: title.trim(), target: n, deadline: deadline || undefined });
    else addGoal({ title: title.trim(), target: n, deadline: deadline || undefined });
    onClose();
  };

  return (
    <Sheet title={goal ? 'Meta' : 'Nova meta'} onClose={onClose}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {goal && (
          <section className="section">
            <div className="row-flex" style={{ alignItems: 'baseline' }}>
              <span className="hero-num" style={{ fontSize: 34 }}>{fmtMoney(goal.saved)}</span>
              <span className="soft">de {fmtMoney(goal.target)}</span>
            </div>
            <Meter value={goal.target ? goal.saved / goal.target : 0} color={COFRE} label="Progresso da meta" />
            <div className="row-flex">
              <input id="goal-aporte" className="input" inputMode="decimal" value={aporte} onChange={(e) => setAporte(e.target.value)} placeholder="Valor do aporte (R$)" />
              <button
                type="button"
                className="btn"
                disabled={!parseNum(aporte)}
                onClick={() => {
                  contributeGoal(goal.id, parseNum(aporte) ?? 0);
                  setAporte('');
                }}
              >
                Aportar
              </button>
            </div>
          </section>
        )}
        <Field label="Para quê">
          <input id="goal-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!goal} placeholder="Ex.: Reserva de emergência" />
        </Field>
        <div className="form-row">
          <Field label="Valor alvo (R$)">
            <input id="goal-target" className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field label="Prazo">
            <input id="goal-deadline" className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
        <div className="sheet-foot">
          {goal && (
            <ConfirmButton
              label="Excluir"
              onConfirm={() => {
                deleteGoal(goal.id);
                onClose();
              }}
            />
          )}
          <span className="spacer" />
          <button className="btn btn--primary" type="submit" disabled={!title.trim() || !parseNum(target)}>
            {goal ? 'Salvar' : 'Criar meta'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
