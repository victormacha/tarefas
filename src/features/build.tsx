import { Award, Flame, Lock, Minus, Plus, Settings, Trash2 } from 'lucide-react';
import { ACHIEVEMENTS } from '../lib/achievements';
import { addRitual, deleteRitual, isoOf, setBuild } from '../lib/actions';
import { fmtDay, fmtLong, relDay } from '../lib/dates';
import { ATTR_KEYS, ATTRS, BUILD_FRONTS, BUILD_PRESETS, FRONTS } from '../lib/meta';
import { useApp } from '../lib/store';
import type { AttrKey, BuildFront, Progress } from '../lib/types';
import { go } from '../lib/ui';
import { heatmap, levelOf, radarValue, rankOf, streakOf, titleOf, totalXP, weekBuild } from '../lib/xp';
import { useToday } from '../ui/hooks';
import { FrontTag, Meter, frontStyle, tipProps } from '../ui/kit';
import { useState } from 'react';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function BuildView() {
  const state = useApp();
  const today = useToday();
  const { progress, profile } = state;
  const total = totalXP(progress.xp);
  const level = levelOf(total);
  const streak = streakOf(progress, today);
  const unlocked = ACHIEVEMENTS.filter((a) => progress.unlocked[a.id]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="label">Nível {level.level}</span>
          <h1 className="display">{profile.name || 'Sua build'}</h1>
          <span className="soft small">{titleOf(progress.xp)}</span>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => go('ajustes')}>
            <Settings size={16} /> Ajustes
          </button>
        </div>
      </header>

      <section className="section">
        <div className="row-flex small">
          <span className="soft">
            {level.into} de {level.span} XP para o nível {level.level + 1}
          </span>
          <span className="grow" />
          {streak > 0 && (
            <span className="row-flex soft" style={{ gap: 5 }}>
              <Flame size={14} /> {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}
            </span>
          )}
        </div>
        <Meter value={level.progress} label="Progresso até o próximo nível" />
      </section>

      <div className="cols cols--even">
        <section className="section">
          <h2 className="label">Atributos</h2>
          <Radar xp={progress.xp} />
          {total === 0 && (
            <p className="small muted">
              O hexágono cresce com o que você faz: cada missão, sessão de foco, entrega, nota e pagamento alimenta um dos seis atributos.
            </p>
          )}
        </section>

        <section className="section">
          <h2 className="label">Do rank E ao S</h2>
          <div className="list">
            {ATTR_KEYS.map((k) => {
              const xp = progress.xp[k];
              const r = rankOf(xp);
              return (
                <div key={k} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="mono strong" style={{ width: 20, fontSize: 15, paddingTop: 1 }}>{r.rank}</span>
                  <span className="row-main" style={{ gap: 6 }}>
                    <span className="row-flex">
                      <span className="row-title grow">{ATTRS[k].label}</span>
                      <span className="small muted nowrap">{r.next ? `${r.toNext} XP para ${r.next}` : `${xp} XP`}</span>
                    </span>
                    <Meter thin value={r.progress} color={FRONTS[ATTRS[k].front].color} label={`${ATTRS[k].label}: progresso no rank ${r.rank}`} />
                    <span className="row-meta">{ATTRS[k].feeds}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="cols cols--even">
        <WeekBuild progress={progress} plan={profile.build} today={today} />
        <div className="stack">
          <Consistency progress={progress} today={today} />
          <RitualsEditor />
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="label">Conquistas</h2>
          <span className="small muted">{unlocked.length} de {ACHIEVEMENTS.length}</span>
        </div>
        <div className="ach">
          {ACHIEVEMENTS.map((a) => {
            const at = progress.unlocked[a.id];
            return (
              <div key={a.id} className="ach-item" data-locked={at ? undefined : ''}>
                {at ? <Award size={18} style={{ flex: 'none', marginTop: 1 }} /> : <Lock size={16} style={{ flex: 'none', marginTop: 2 }} />}
                <div style={{ minWidth: 0 }}>
                  <b>{a.title}</b>
                  <span>{at ? `Conquistada em ${fmtDay(isoOf(at))}` : a.how}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {progress.feed.length > 0 && (
        <section className="section">
          <h2 className="label">Histórico recente</h2>
          <div className="list">
            {progress.feed.slice(0, 10).map((f, i) => (
              <div key={`${f.at}-${i}`} className="row" style={{ padding: '9px 2px' }}>
                <span className="mono soft nowrap" style={{ width: 70 }}>+{f.xp} {ATTRS[f.attr].short}</span>
                <span className="row-main">
                  <span className="small">{f.text}</span>
                </span>
                <span className="small muted nowrap">{relDay(isoOf(f.at), today)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Hexágono de atributos: um vértice por atributo, um anel por rank. */
function Radar({ xp }: { xp: Record<AttrKey, number> }) {
  const R = 100;
  const point = (i: number, r: number): [number, number] => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const ring = (f: number) => ATTR_KEYS.map((_, i) => point(i, R * f).join(',')).join(' ');
  const values = ATTR_KEYS.map((k) => Math.max(0.035, radarValue(xp[k])));
  const shape = values.map((v, i) => point(i, R * v).join(',')).join(' ');

  return (
    <svg className="radar" viewBox="-160 -142 320 284" role="group" aria-label="Hexágono de atributos">
      {[0.2, 0.4, 0.6, 0.8, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke={f === 1 ? 'var(--line-2)' : 'var(--line)'} strokeWidth="1" />
      ))}
      {ATTR_KEYS.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />;
      })}
      <polygon points={shape} fill="var(--fg)" fillOpacity="0.1" stroke="var(--fg)" strokeWidth="2" strokeLinejoin="round" />
      {ATTR_KEYS.map((k, i) => {
        const [x, y] = point(i, R * values[i]);
        const [lx, ly] = point(i, R + 27);
        const r = rankOf(xp[k]);
        return (
          <g key={k}>
            <circle
              cx={x} cy={y} r="5" fill="var(--fg)" stroke="var(--bg)" strokeWidth="2" tabIndex={0}
              {...tipProps(`${ATTRS[k].label} · rank ${r.rank}`, r.next ? `${xp[k]} XP · faltam ${r.toNext} para ${r.next}` : `${xp[k]} XP · rank máximo`)}
            />
            <circle cx={x} cy={y} r="13" fill="transparent" {...tipProps(`${ATTRS[k].label} · rank ${r.rank}`, `${xp[k]} XP`)} aria-hidden="true" />
            <text x={lx} y={ly - 3} textAnchor="middle">{ATTRS[k].short}</text>
            <text className="rank" x={lx} y={ly + 12} textAnchor="middle">{r.rank}</text>
          </g>
        );
      })}
    </svg>
  );
}

function WeekBuild({ progress, plan, today }: { progress: Progress; plan: Record<BuildFront, number>; today: string }) {
  const wb = weekBuild(progress, plan, today);
  const sum = BUILD_FRONTS.reduce((s, f) => s + (plan[f] || 0), 0);
  const bump = (front: BuildFront, delta: number) => {
    const next = Math.max(0, Math.min(10, (plan[front] || 0) + delta));
    if (delta > 0 && sum >= 10) return;
    setBuild({ ...plan, [front]: next });
  };
  const activePreset = BUILD_PRESETS.find((p) => BUILD_FRONTS.every((f) => p.build[f] === plan[f]));

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="label">Build da semana</h2>
        <span className="small muted">{sum}/10 pontos</span>
      </div>
      <p className="small soft">
        Distribua 10 pontos de foco. O Hexa compara o plano com o XP que você realmente conquistou em cada frente e puxa para cima da fila o que está ficando para trás.
      </p>
      <div className="row-flex wrap" style={{ gap: 6 }}>
        {BUILD_PRESETS.map((p) => (
          <button key={p.id} className="chip" aria-pressed={activePreset?.id === p.id} onClick={() => setBuild(p.build)} title={p.hint}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="bars" style={{ gap: 16 }}>
        {wb.rows.map((r) => (
          <div key={r.front} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="row-flex">
              <FrontTag front={r.front} />
              <span className="grow" />
              <span className="small muted nowrap">{wb.totalXP ? `${pct(r.actual)} real` : 'sem atividade'}</span>
              <span className="stepper">
                <button className="icon-btn icon-btn--sm" onClick={() => bump(r.front, -1)} aria-label={`Menos foco em ${FRONTS[r.front].label}`} disabled={!plan[r.front]}>
                  <Minus size={14} />
                </button>
                <b>{plan[r.front] || 0}</b>
                <button className="icon-btn icon-btn--sm" onClick={() => bump(r.front, 1)} aria-label={`Mais foco em ${FRONTS[r.front].label}`} disabled={sum >= 10}>
                  <Plus size={14} />
                </button>
              </span>
            </div>
            <div className="build-track" style={frontStyle(r.front)} tabIndex={0} {...tipProps(FRONTS[r.front].label, `${r.xp} XP nesta semana · ${pct(r.actual)} real contra ${pct(r.planned)} planejado`)}>
              <div className="build-fill" style={{ width: pct(r.actual) }} />
              <div className="build-mark" style={{ left: `calc(${pct(r.planned)} - 1px)` }} />
            </div>
          </div>
        ))}
      </div>
      <span className="small muted">Barra: esforço real. Traço: plano. Fortuna fica de fora porque é resultado, não esforço.</span>
    </section>
  );
}

const LEVELS = [1, 30, 70, 120];

function Consistency({ progress, today }: { progress: Progress; today: string }) {
  const weeks = heatmap(progress, today, 16);
  const level = (xp: number) => LEVELS.filter((t) => xp >= t).length;
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="label">Consistência · 16 semanas</h2>
      </div>
      <div className="heat" role="group" aria-label="XP por dia nas últimas 16 semanas">
        {weeks.map((col, i) => (
          <div key={i} className="heat-col">
            {col.map((d) =>
              d.future ? (
                <span key={d.iso} className="heat-cell" data-future="" />
              ) : (
                <span key={d.iso} className="heat-cell" data-l={level(d.xp)} tabIndex={0} {...tipProps(fmtLong(d.iso), d.xp ? `${d.xp} XP` : 'sem atividade')} />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="heat-legend">
        menos
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="heat-cell" data-l={l} />
        ))}
        mais
      </div>
    </section>
  );
}

function RitualsEditor() {
  const { missions } = useApp();
  const [text, setText] = useState('');
  return (
    <section className="section">
      <h2 className="label">Rituais</h2>
      <div className="list">
        {missions.rituals.map((r) => (
          <div key={r.id} className="row" style={{ padding: '8px 2px' }}>
            <span className="row-main">
              <span className="row-title">{r.title}</span>
              <span className="row-meta">{r.log.length} {r.log.length === 1 ? 'vez' : 'vezes'} · +5 {ATTRS[r.attr].short} por dia</span>
            </span>
            <button className="icon-btn icon-btn--sm" aria-label={`Remover ritual ${r.title}`} onClick={() => deleteRitual(r.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <form
        className="row-flex"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) addRitual(text);
          setText('');
        }}
      >
        <input id="ritual-add" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Novo ritual diário" />
        <button className="btn" type="submit" disabled={!text.trim()}>Adicionar</button>
      </form>
    </section>
  );
}
