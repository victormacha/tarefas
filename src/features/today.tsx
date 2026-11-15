import { useMemo, useState, type CSSProperties } from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, Check, Clock3, Info, Play, Plus, Square, Sparkles } from 'lucide-react';
import {
  addMission, addRitual, completeMission, snoozeMission, startFocus, stopFocus, toggleRitual,
} from '../lib/actions';
import { addDays, diffDays, fmtClock, fmtDay, fmtLong, greeting, WEEKDAYS_SHORT, weekdayOf } from '../lib/dates';
import { buildSignals, classesOn, rankMissions, timeline, type Signal, type TimelineEvent } from '../lib/engine';
import { ATTRS, EFFORTS, FRONT_KEYS, FRONTS } from '../lib/meta';
import { clearDemo } from '../lib/seed';
import { useApp } from '../lib/store';
import type { AppState, ISODate, Mission } from '../lib/types';
import { go, openCapture, openCopilot, toast, type Route } from '../lib/ui';
import { weekBuild } from '../lib/xp';
import { PRESETS } from '../ai/copilot';
import { useNow, useToday } from '../ui/hooks';
import { Empty, FrontTag, Pips, frontStyle, tipProps } from '../ui/kit';
import { DueChip, MissionRow, MissionSheet } from './mission';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function TodayView() {
  const state = useApp();
  const today = useToday();
  const [editing, setEditing] = useState<Mission | null>(null);
  const [showAll, setShowAll] = useState(false);

  const ranked = useMemo(() => rankMissions(state, today), [state, today]);
  const signals = useMemo(() => buildSignals(state, today), [state, today]);
  const doneToday = useMemo(
    () => state.missions.items.filter((m) => m.done && m.doneAt && new Date(m.doneAt).toDateString() === new Date().toDateString()),
    [state.missions.items, today],
  );
  const classes = useMemo(() => classesOn(state, today), [state, today]);

  const focus = state.progress.focus;
  // A missão em foco sai da fila; sem foco ativo, a primeira do ranking é o destaque.
  const top = focus ? null : ranked[0];
  const queue = ranked.filter((r) => r.mission.id !== top?.mission.id && r.mission.id !== focus?.missionId);
  const visible = showAll ? queue : queue.slice(0, 5);
  const xpToday = Object.values(state.progress.days[today]?.xp ?? {}).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="label">{fmtLong(today)}</span>
          <h1 className="display">
            {greeting()}
            {state.profile.name ? `, ${state.profile.name}` : ''}.
          </h1>
          {classes.length > 0 && (
            <span className="soft small">
              Aulas hoje: {classes.map((c) => `${c.name} às ${c.start}`).join(' · ')}
            </span>
          )}
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => openCopilot(PRESETS[0].prompt)}>
            <Sparkles size={16} /> Briefing do dia
          </button>
        </div>
      </header>

      {state.profile.demo && (
        <div className="banner">
          <Info size={15} />
          <span className="grow">Você está vendo dados de exemplo: clientes, notas e valores fictícios.</span>
          <button className="btn btn--sm" onClick={clearDemo}>Remover exemplos</button>
        </div>
      )}

      <div className="cols">
        <div className="stack">
          <FocusCard state={state} top={top ?? null} today={today} onEdit={setEditing} />

          <section className="section">
            <div className="section-head">
              <h2 className="label">A seguir</h2>
              {doneToday.length > 0 && (
                <span className="small muted">
                  {doneToday.length} {doneToday.length === 1 ? 'concluída' : 'concluídas'} hoje · +{xpToday} XP
                </span>
              )}
            </div>
            {visible.length > 0 && (
              <div className="list">
                {visible.map((r) => (
                  <MissionRow key={r.mission.id} mission={r.mission} why={r.why} today={today} onOpen={setEditing} />
                ))}
              </div>
            )}
            {queue.length > 5 && (
              <button className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Mostrar menos' : `Ver as ${queue.length} missões`}
              </button>
            )}
            <button className="capture-bar" onClick={() => openCapture()}>
              <Plus size={16} />
              Capturar: missão, prova, gasto, lead, ideia…
              <kbd>Ctrl K</kbd>
            </button>
            {doneToday.length > 0 && (
              <details>
                <summary className="small muted" style={{ cursor: 'pointer', padding: '4px 0' }}>Concluídas hoje</summary>
                <div className="list">
                  {doneToday.map((m) => (
                    <MissionRow key={m.id} mission={m} today={today} onOpen={setEditing} />
                  ))}
                </div>
              </details>
            )}
          </section>

          <Timeline state={state} today={today} />
        </div>

        <div className="stack">
          <Radar signals={signals} />
          <Rituals state={state} today={today} />
          <BuildMini state={state} today={today} />
        </div>
      </div>

      {editing && <MissionSheet mission={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FocusCard({
  state, top, today, onEdit,
}: {
  state: AppState;
  top: { mission: Mission; why: string } | null;
  today: ISODate;
  onEdit: (m: Mission) => void;
}) {
  const focus = state.progress.focus;
  const t = useNow(!!focus);

  if (focus) {
    const mission = focus.missionId ? state.missions.items.find((m) => m.id === focus.missionId) : undefined;
    const elapsed = t - focus.startedAt;
    return (
      <section className="focus" aria-label="Sessão de foco">
        <div className="row-flex">
          <i className="rec" aria-hidden="true" />
          <span className="label">Em foco</span>
          <span className="grow" />
          <FrontTag front={focus.front} />
        </div>
        <h2 className="focus-title">{focus.title}</h2>
        <div className="clock" aria-label="Tempo decorrido">{fmtClock(elapsed)}</div>
        <div className="focus-meta">
          <span>Meta de {focus.plannedMin} min · rende {ATTRS[focus.attr].label}</span>
        </div>
        <div className="focus-actions">
          <button
            className="btn btn--primary"
            onClick={() => {
              const min = stopFocus(true);
              if (!min) toast({ text: 'Sessão curta demais para registrar' });
            }}
          >
            <Square size={14} /> Encerrar e registrar
          </button>
          {mission && !mission.done && (
            <button className="btn" onClick={() => completeMission(mission.id)}>
              <Check size={16} /> Concluir missão
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => stopFocus(false)}>Descartar</button>
        </div>
      </section>
    );
  }

  if (!top) {
    return (
      <Empty
        title="Fila limpa"
        action={
          <button className="btn btn--primary" onClick={() => openCapture()}>
            <Plus size={16} /> Capturar
          </button>
        }
      >
        Nenhuma missão aberta. Capture o que está na cabeça — o Hexa organiza por frente, prazo e peso e te diz por onde começar.
      </Empty>
    );
  }

  const m = top.mission;
  const planned = m.effort === 1 ? 15 : m.effort === 2 ? 25 : 50;
  return (
    <section className="focus" aria-label="Foco agora">
      <div className="row-flex">
        <span className="label">Foco agora</span>
        <span className="grow" />
        <FrontTag front={m.front} />
      </div>
      <button style={{ textAlign: 'left' }} onClick={() => onEdit(m)} aria-label={`Editar: ${m.title}`}>
        <h2 className="focus-title">{m.title}</h2>
      </button>
      <div className="focus-meta">
        {m.due && <DueChip due={m.due} today={today} />}
        {top.why && <span>{top.why}</span>}
        <span className="row-flex" style={{ gap: 6 }}>
          <Pips effort={m.effort} /> {EFFORTS[m.effort].label} · +{EFFORTS[m.effort].xp} XP
        </span>
      </div>
      <div className="focus-actions">
        <button
          className="btn btn--primary"
          onClick={() => startFocus({ missionId: m.id, title: m.title, front: m.front, attr: m.attr, plannedMin: planned, jobId: m.ref?.kind === 'job' ? m.ref.id : undefined })}
        >
          <Play size={15} /> Iniciar foco
        </button>
        <button className="btn" onClick={() => completeMission(m.id)}>
          <Check size={16} /> Concluir
        </button>
        <button className="btn btn--ghost" onClick={() => snoozeMission(m.id)}>
          <Clock3 size={15} /> Amanhã
        </button>
      </div>
    </section>
  );
}

const SIGNAL_ICON = { critical: AlertTriangle, warn: AlertCircle, info: Info };
const SIGNAL_LABEL = { critical: 'Crítico', warn: 'Atenção', info: 'Aviso' };

function Radar({ signals }: { signals: Signal[] }) {
  const [all, setAll] = useState(false);
  const list = all ? signals : signals.slice(0, 4);
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="label">Radar</h2>
        {signals.length > 4 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setAll((v) => !v)}>
            {all ? 'Menos' : `Todos (${signals.length})`}
          </button>
        )}
      </div>
      {!signals.length ? (
        <p className="small muted">Nada escorregando. O radar avisa quando uma prova, um cliente, uma entrega ou a meta do mês pedir atenção.</p>
      ) : (
        <div className="list">
          {list.map((s) => {
            const Icon = SIGNAL_ICON[s.severity];
            return (
              <div key={s.id} className="row" style={{ alignItems: 'flex-start' }}>
                <span className={`signal-ico signal-ico--${s.severity}`} title={SIGNAL_LABEL[s.severity]}>
                  <Icon size={15} aria-label={SIGNAL_LABEL[s.severity]} />
                </span>
                <button className="row-main" style={{ textAlign: 'left' }} onClick={() => go(s.route as Route)}>
                  <span className="row-title">{s.title}</span>
                  {s.detail && <span className="row-meta">{s.detail}</span>}
                </button>
                {s.suggest && (
                  <button
                    className="btn btn--sm"
                    title={`Criar missão: ${s.suggest.title}`}
                    onClick={() => {
                      addMission(s.suggest!);
                      toast({ text: `Missão criada: ${s.suggest!.title}` });
                    }}
                  >
                    <Plus size={14} /> Missão
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Rituals({ state, today }: { state: AppState; today: ISODate }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const rituals = state.missions.rituals;
  const submit = () => {
    if (text.trim()) addRitual(text);
    setText('');
    setAdding(false);
  };
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="label">Rituais</h2>
        <button className="icon-btn icon-btn--sm" onClick={() => setAdding(true)} aria-label="Novo ritual">
          <Plus size={16} />
        </button>
      </div>
      {!rituals.length && !adding && (
        <p className="small muted">Hábitos diários que sustentam o resto: treino, leitura, hora de dormir. Cada um rende Vigor.</p>
      )}
      <div className="row-flex wrap" style={{ gap: 8 }}>
        {rituals.map((r) => {
          const done = r.log.includes(today);
          return (
            <button key={r.id} className="chip chip--lg" aria-pressed={done} onClick={() => toggleRitual(r.id, today)}>
              {done && <Check size={14} strokeWidth={2.6} />}
              {r.title}
            </button>
          );
        })}
      </div>
      {adding && (
        <form
          className="row-flex"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input id="ritual-new" className="input" autoFocus placeholder="Ex.: Treino" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => !text.trim() && setAdding(false)} />
          <button className="btn btn--primary" type="submit">Adicionar</button>
        </form>
      )}
    </section>
  );
}

function BuildMini({ state, today }: { state: AppState; today: ISODate }) {
  const wb = weekBuild(state.progress, state.profile.build, today);
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="label">Build da semana</h2>
        <button className="btn btn--ghost btn--sm" onClick={() => go('build')}>
          Ajustar <ArrowRight size={14} />
        </button>
      </div>
      <div className="bars" style={{ gap: 13 }}>
        {wb.rows.map((r) => (
          <div key={r.front} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="row-flex small">
              <FrontTag front={r.front} />
              <span className="grow" />
              <span className="muted">
                {wb.totalXP ? pct(r.actual) : '—'} real · {pct(r.planned)} plano
              </span>
            </div>
            <div className="build-track" style={frontStyle(r.front)} {...tipProps(FRONTS[r.front].label, `${r.xp} XP nesta semana · plano de ${pct(r.planned)}`)} tabIndex={0}>
              <div className="build-fill" style={{ width: pct(r.actual) }} />
              <div className="build-mark" style={{ left: `calc(${pct(r.planned)} - 1px)` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">A barra é o seu esforço real; o traço, o que você planejou.</p>
    </section>
  );
}

const DAYS = 14;

function Timeline({ state, today }: { state: AppState; today: ISODate }) {
  const events = useMemo(() => timeline(state, today, DAYS), [state, today]);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  const tracks = FRONT_KEYS.filter((f) => events.some((e) => e.front === f));
  const byCell = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const key = `${e.front}:${e.date}`;
    byCell.set(key, [...(byCell.get(key) ?? []), e]);
  }
  const when = (e: TimelineEvent) => {
    const n = diffDays(today, e.date);
    return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `${WEEKDAYS_SHORT[weekdayOf(e.date)]}, ${fmtDay(e.date)}`;
  };

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="label">Próximos 14 dias</h2>
      </div>
      {!events.length ? (
        <p className="small muted">
          Sem marcos datados. Provas, entregas, follow-ups e metas com data aparecem aqui, uma trilha por frente — como numa linha do tempo de edição.
        </p>
      ) : (
        <>
          <div className="tl-scroll">
            <div className="tl" style={{ '--days': DAYS } as CSSProperties} role="group" aria-label={`Linha do tempo com ${events.length} marcos nos próximos 14 dias`}>
              <span />
              {days.map((d, i) => {
                const wd = weekdayOf(d);
                return (
                  <span key={d} className={`tl-head${i === 0 ? ' tl-head--today' : ''}${wd === 0 || wd === 6 ? ' tl-head--off' : ''}`}>
                    {WEEKDAYS_SHORT[wd]}
                    <b>{Number(d.slice(8))}</b>
                  </span>
                );
              })}
              {tracks.map((f) => (
                <TrackRow key={f} front={f} days={days} byCell={byCell} when={when} />
              ))}
            </div>
          </div>
          <div className="list">
            {events.slice(0, 5).map((e) => (
              <button key={e.id} className="row" onClick={() => go(e.route as Route)}>
                <i className="dot" style={frontStyle(e.front)} />
                <span className="row-main">
                  <span className="row-title">{e.title}</span>
                  <span className="row-meta">{e.label} · {FRONTS[e.front].label}</span>
                </span>
                <span className="small soft nowrap">{when(e)}</span>
              </button>
            ))}
          </div>
          {events.length > 5 && <span className="small muted">+ {events.length - 5} marcos na linha do tempo</span>}
        </>
      )}
    </section>
  );
}

function TrackRow({
  front, days, byCell, when,
}: {
  front: (typeof FRONT_KEYS)[number];
  days: ISODate[];
  byCell: Map<string, TimelineEvent[]>;
  when: (e: TimelineEvent) => string;
}) {
  return (
    <>
      <span className="tl-track">
        <i className="dot" style={frontStyle(front)} />
        {FRONTS[front].label}
      </span>
      {days.map((d, i) => (
        <span key={d} className={`tl-cell${i === 0 ? ' tl-cell--today' : ''}`}>
          {(byCell.get(`${front}:${d}`) ?? []).map((e) => (
            <button
              key={e.id}
              className="tl-clip"
              style={frontStyle(front)}
              onClick={() => go(e.route as Route)}
              {...tipProps(`${e.label} · ${when(e)}`, e.title)}
            />
          ))}
        </span>
      ))}
    </>
  );
}
