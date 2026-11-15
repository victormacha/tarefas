import { useState } from 'react';
import { ArrowRight, Check, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  addJob, addLead, deleteJob, deleteLead, isoOf, jobFromLead, moveJob, moveLead, setProfile, setServices, startFocus, touchLead,
  updateJob, updateLead,
} from '../lib/actions';
import { diffDays, fmtDay, fmtMin, fmtMoney, relDay, uid } from '../lib/dates';
import { hourlyRate } from '../lib/finance';
import { CHANNELS, JOB_KINDS, JOB_STAGES, LEAD_OPEN, LEAD_STAGES } from '../lib/meta';
import { useSlice } from '../lib/store';
import type { ID, ISODate, Job, JobStage, Lead, LeadStage, Service } from '../lib/types';
import { go, openCopilot, toast } from '../lib/ui';
import { prompts } from '../ai/copilot';
import { useToday } from '../ui/hooks';
import { ConfirmButton, Empty, Field, Segmented, Sheet, parseNum } from '../ui/kit';

type Tab = 'clientes' | 'trabalhos' | 'precos';

export function StudioView() {
  const [tab, setTab] = useState<Tab>('clientes');
  const [lead, setLead] = useState<ID | 'new' | null>(null);
  const [job, setJob] = useState<ID | 'new' | null>(null);
  const studio = useSlice('studio');
  const today = useToday();

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="label">Ofício e Influência</span>
          <h1 className="display">Estúdio</h1>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setLead('new')}>
            <Plus size={16} /> Lead
          </button>
          <button className="btn btn--primary" onClick={() => setJob('new')}>
            <Plus size={16} /> Trabalho
          </button>
        </div>
      </header>

      <Segmented
        label="Seção do Estúdio"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'clientes', label: 'Clientes' },
          { value: 'trabalhos', label: 'Trabalhos' },
          { value: 'precos', label: 'Preços' },
        ]}
      />

      {tab === 'clientes' && <Pipeline leads={studio.leads} today={today} onOpen={setLead} />}
      {tab === 'trabalhos' && <Jobs jobs={studio.jobs} today={today} onOpen={setJob} />}
      {tab === 'precos' && <Pricing jobs={studio.jobs} services={studio.services} />}

      {lead && (
        <LeadSheet
          lead={lead === 'new' ? undefined : studio.leads.find((l) => l.id === lead)}
          onClose={() => setLead(null)}
          onJob={(id) => {
            setLead(null);
            setTab('trabalhos');
            setJob(id);
          }}
        />
      )}
      {job && <JobSheet job={job === 'new' ? undefined : studio.jobs.find((j) => j.id === job)} onClose={() => setJob(null)} />}
    </div>
  );
}

// ---------- Clientes ----------

function touchInfo(l: Lead, today: ISODate): { text: string; tone: string } {
  if (l.nextTouch) {
    const d = diffDays(today, l.nextTouch);
    if (d < 0) return { text: `follow-up atrasado ${-d}d`, tone: ' pill--crit' };
    if (d === 0) return { text: 'follow-up hoje', tone: ' pill--warn' };
    return { text: `follow-up ${relDay(l.nextTouch, today)}`, tone: '' };
  }
  if (l.lastTouch) {
    const d = diffDays(l.lastTouch, today);
    return { text: d === 0 ? 'contato hoje' : `sem contato há ${d}d`, tone: d >= 4 ? ' pill--warn' : '' };
  }
  return { text: 'nunca abordado', tone: '' };
}

function Pipeline({ leads, today, onOpen }: { leads: Lead[]; today: ISODate; onOpen: (id: ID | 'new') => void }) {
  const open = leads.filter((l) => LEAD_OPEN.includes(l.stage));
  const closed = leads.filter((l) => !LEAD_OPEN.includes(l.stage));
  const value = open.filter((l) => l.stage === 'proposta' || l.stage === 'negociacao').reduce((s, l) => s + (l.value || 0), 0);
  const due = open.filter((l) => l.nextTouch && l.nextTouch <= today).length;

  if (!leads.length) {
    return (
      <Empty
        title="Seu funil começa aqui"
        action={
          <button className="btn btn--primary" onClick={() => onOpen('new')}>
            <Plus size={16} /> Registrar o primeiro lead
          </button>
        }
      >
        Registre cada pessoa ou marca que pode virar cliente. O Hexa lembra dos follow-ups, mostra quanto está em negociação e o Copiloto escreve
        a abordagem e a proposta a partir do que você anotou.
      </Empty>
    );
  }

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="label">Em aberto</span>
          <b>{open.length}</b>
        </div>
        <div className="stat">
          <span className="label">Em proposta</span>
          <b>{fmtMoney(value)}</b>
        </div>
        <div className="stat">
          <span className="label">Follow-ups pendentes</span>
          <b>{due}</b>
        </div>
      </div>

      <div className="kan">
        {LEAD_STAGES.filter((s) => LEAD_OPEN.includes(s.key)).map((stage) => {
          const list = open.filter((l) => l.stage === stage.key);
          return (
            <div key={stage.key} className="kan-col">
              <div className="kan-head">
                <h2 className="label">{stage.label}</h2>
                <span className="small muted">{list.length}</span>
              </div>
              {!list.length && <div className="kan-empty">Ninguém nesta etapa</div>}
              {list.map((l) => {
                const info = touchInfo(l, today);
                return (
                  <button key={l.id} className="kan-card" onClick={() => onOpen(l.id)}>
                    <span className="row-title">{l.name}</span>
                    <span className="row-meta">
                      {[l.niche, l.channel].filter(Boolean).join(' · ')}
                    </span>
                    <span className="row-flex wrap" style={{ gap: 6 }}>
                      {l.value ? <span className="small strong">{fmtMoney(l.value)}</span> : null}
                      <span className="grow" />
                      <span className={`pill${info.tone}`}>{info.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {closed.length > 0 && (
        <details>
          <summary className="label" style={{ cursor: 'pointer', padding: '6px 0' }}>Encerrados ({closed.length})</summary>
          <div className="list">
            {closed.map((l) => (
              <button key={l.id} className="row" onClick={() => onOpen(l.id)}>
                <span className="row-main">
                  <span className="row-title">{l.name}</span>
                  <span className="row-meta">{[l.niche, l.channel].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`pill${l.stage === 'ganho' ? ' pill--good' : ''}`}>{l.stage === 'ganho' ? 'Fechado' : 'Perdido'}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function LeadSheet({ lead, onClose, onJob }: { lead?: Lead; onClose: () => void; onJob: (id: ID) => void }) {
  const [name, setName] = useState(lead?.name ?? '');
  const [contact, setContact] = useState(lead?.contact ?? '');
  const [channel, setChannel] = useState(lead?.channel ?? 'Instagram');
  const [niche, setNiche] = useState(lead?.niche ?? '');
  const [value, setValue] = useState(lead?.value ? String(lead.value) : '');
  const [note, setNote] = useState(lead?.note ?? '');
  const [nextTouch, setNextTouch] = useState(lead?.nextTouch ?? '');

  const fields = () => ({
    name: name.trim(),
    contact: contact.trim() || undefined,
    channel,
    niche: niche.trim() || undefined,
    value: parseNum(value),
    note: note.trim() || undefined,
    nextTouch: nextTouch || undefined,
  });
  const save = () => {
    if (!name.trim()) return;
    if (lead) updateLead(lead.id, fields());
    else addLead(fields());
    onClose();
  };
  const ai = (kind: 'abordagem' | 'follow-up' | 'proposta') => {
    if (!lead) return;
    updateLead(lead.id, fields());
    const p = prompts.outreach(lead.id, name.trim() || lead.name, kind);
    onClose();
    openCopilot(p.prompt);
  };

  return (
    <Sheet title={lead ? lead.name : 'Novo lead'} onClose={onClose}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {lead && (
          <>
            <Field label="Etapa">
              <select id="lead-stage" className="select" value={lead.stage} onChange={(e) => moveLead(lead.id, e.target.value as LeadStage)}>
                {LEAD_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </Field>
            {lead.stage === 'ganho' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  const id = jobFromLead(lead.id);
                  if (id) onJob(id);
                }}
              >
                <Plus size={16} /> Criar trabalho para este cliente
              </button>
            ) : (
              lead.stage !== 'perdido' && (
                <section className="section">
                  <h3 className="label">Falei com ele hoje — próximo contato em</h3>
                  <div className="row-flex wrap" style={{ gap: 8 }}>
                    {[
                      { days: 2, label: '2 dias' },
                      { days: 4, label: '4 dias' },
                      { days: 7, label: '1 semana' },
                      { days: 0, label: 'Sem próximo' },
                    ].map((o) => (
                      <button
                        key={o.days}
                        type="button"
                        className="chip chip--lg"
                        onClick={() => {
                          touchLead(lead.id, 'Contato registrado', o.days);
                          onClose();
                        }}
                      >
                        <Check size={14} /> {o.label}
                      </button>
                    ))}
                  </div>
                </section>
              )
            )}
            <section className="section">
              <h3 className="label">Copiloto escreve para você</h3>
              <div className="row-flex wrap" style={{ gap: 8 }}>
                <button type="button" className="btn btn--sm" onClick={() => ai('abordagem')}>
                  <Sparkles size={14} /> Abordagem
                </button>
                <button type="button" className="btn btn--sm" onClick={() => ai('follow-up')}>
                  <Sparkles size={14} /> Follow-up
                </button>
                <button type="button" className="btn btn--sm" onClick={() => ai('proposta')}>
                  <Sparkles size={14} /> Proposta
                </button>
              </div>
            </section>
          </>
        )}

        <Field label="Nome ou marca">
          <input id="lead-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!lead} placeholder="Quem pode virar cliente" />
        </Field>
        <div className="form-row">
          <Field label="Canal">
            <select id="lead-channel" className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Nicho">
            <input id="lead-niche" className="input" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex.: fitness" />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Contato">
            <input id="lead-contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@perfil, telefone, e-mail" />
          </Field>
          <Field label="Valor estimado (R$)">
            <input id="lead-value" className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </div>
        <Field label="Próximo follow-up">
          <input id="lead-next" className="input" type="date" value={nextTouch} onChange={(e) => setNextTouch(e.target.value)} />
        </Field>
        <Field label="O que você sabe sobre ele" hint="Quanto mais contexto, melhor a mensagem que o Copiloto escreve.">
          <textarea id="lead-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que ele posta, o que pediu, objeções, orçamento…" />
        </Field>

        {lead && lead.log.length > 0 && (
          <section className="section">
            <h3 className="label">Histórico</h3>
            <div className="list">
              {lead.log.slice(0, 6).map((entry, i) => (
                <div key={i} className="row" style={{ padding: '8px 2px' }}>
                  <span className="mono muted nowrap">{fmtDay(isoOf(entry.at))}</span>
                  <span className="small soft">{entry.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="sheet-foot">
          {lead && (
            <ConfirmButton
              label="Excluir"
              onConfirm={() => {
                deleteLead(lead.id);
                onClose();
              }}
            />
          )}
          <span className="spacer" />
          <button className="btn btn--primary" type="submit" disabled={!name.trim()}>
            {lead ? 'Salvar' : 'Registrar lead'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// ---------- Trabalhos ----------

const stageIndex = (s: JobStage) => JOB_STAGES.findIndex((x) => x.key === s);

function StageDots({ stage }: { stage: JobStage }) {
  const idx = stageIndex(stage);
  return (
    <span className="stage-dots" role="img" aria-label={`Etapa ${idx + 1} de ${JOB_STAGES.length}: ${JOB_STAGES[idx].label}`}>
      {JOB_STAGES.map((s, i) => (
        <i key={s.key} className={i <= idx ? 'on' : ''} />
      ))}
    </span>
  );
}

function Jobs({ jobs, today, onOpen }: { jobs: Job[]; today: ISODate; onOpen: (id: ID | 'new') => void }) {
  const active = jobs
    .filter((j) => j.stage !== 'pago')
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  const paid = jobs.filter((j) => j.stage === 'pago').sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));

  if (!jobs.length) {
    return (
      <Empty
        title="Nenhum trabalho em andamento"
        action={
          <button className="btn btn--primary" onClick={() => onOpen('new')}>
            <Plus size={16} /> Novo trabalho
          </button>
        }
      >
        Cada edição passa por briefing, edição, revisão, entrega e pagamento. Ao marcar como pago, a entrada cai no Cofre sozinha — e o tempo de foco
        registrado revela quanto você ganhou por hora.
      </Empty>
    );
  }

  return (
    <>
      {!active.length && <p className="small muted">Tudo entregue e pago. Hora de prospectar o próximo.</p>}
      <div className="list">
        {active.map((j) => {
          const idx = stageIndex(j.stage);
          const next = JOB_STAGES[idx + 1];
          const late = j.deadline && j.deadline < today && idx < 3;
          return (
            <div key={j.id} className="row" style={{ flexWrap: 'wrap' }}>
              <button className="row-main" style={{ textAlign: 'left', minWidth: 180 }} onClick={() => onOpen(j.id)}>
                <span className="row-title">{j.title}</span>
                <span className="row-meta">
                  {j.client} · {fmtMoney(j.price)}
                  {j.minutes > 0 && ` · ${fmtMin(j.minutes)} de foco`}
                </span>
                <span className="row-flex small soft" style={{ gap: 8, marginTop: 4 }}>
                  <StageDots stage={j.stage} /> {JOB_STAGES[idx].label}
                </span>
              </button>
              <span className="row-end">
                {j.deadline && idx < 3 && <span className={`pill${late ? ' pill--crit' : diffDays(today, j.deadline) <= 2 ? ' pill--warn' : ''}`}>{relDay(j.deadline, today)}</span>}
                {next && (
                  <button className="btn btn--sm" onClick={() => moveJob(j.id, next.key)}>
                    {next.label} <ArrowRight size={14} />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {paid.length > 0 && (
        <details>
          <summary className="label" style={{ cursor: 'pointer', padding: '6px 0' }}>Pagos ({paid.length})</summary>
          <div className="list">
            {paid.map((j) => (
              <button key={j.id} className="row" onClick={() => onOpen(j.id)}>
                <span className="row-main">
                  <span className="row-title">{j.title}</span>
                  <span className="row-meta">
                    {j.client}
                    {j.minutes >= 10 && ` · ${fmtMoney(j.price / (j.minutes / 60))}/h`}
                  </span>
                </span>
                <span className="small strong">{fmtMoney(j.price)}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function JobSheet({ job, onClose }: { job?: Job; onClose: () => void }) {
  const [title, setTitle] = useState(job?.title ?? '');
  const [client, setClient] = useState(job?.client ?? '');
  const [kind, setKind] = useState(job?.kind ?? JOB_KINDS[0]);
  const [price, setPrice] = useState(job?.price ? String(job.price) : '');
  const [deadline, setDeadline] = useState(job?.deadline ?? '');
  const [link, setLink] = useState(job?.link ?? '');
  const [note, setNote] = useState(job?.note ?? '');
  const [portfolio, setPortfolio] = useState(job?.portfolio ?? false);

  const save = () => {
    if (!title.trim() || !client.trim()) return;
    const data = {
      title: title.trim(), client: client.trim(), kind, price: parseNum(price) ?? 0, deadline: deadline || undefined,
      link: link.trim() || undefined, note: note.trim() || undefined, portfolio,
    };
    if (job) updateJob(job.id, data);
    else addJob(data);
    onClose();
  };

  return (
    <Sheet title={job ? 'Trabalho' : 'Novo trabalho'} onClose={onClose}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {job && (
          <>
            <Field label="Etapa">
              <Segmented
                label="Etapa do trabalho"
                wide
                value={job.stage}
                onChange={(s) => moveJob(job.id, s)}
                options={JOB_STAGES.map((s) => ({ value: s.key, label: s.label }))}
              />
            </Field>
            {job.stage !== 'pago' && job.stage !== 'entregue' && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  startFocus({ jobId: job.id, title: job.title, front: 'estudio', attr: 'ofi', plannedMin: 50 });
                  onClose();
                  go('hoje');
                  toast({ text: 'Foco iniciado — o tempo entra neste trabalho' });
                }}
              >
                <Play size={15} /> Iniciar foco neste trabalho
              </button>
            )}
            {job.minutes > 0 && (
              <p className="small soft">
                {fmtMin(job.minutes)} de foco registrados
                {job.price > 0 && job.minutes >= 10 && ` · ${fmtMoney(job.price / (job.minutes / 60))} por hora até aqui`}
              </p>
            )}
          </>
        )}
        <Field label="Título">
          <input id="job-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!job} placeholder="Ex.: Pack de 8 Reels" />
        </Field>
        <div className="form-row">
          <Field label="Cliente">
            <input id="job-client" className="input" value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <select id="job-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              {JOB_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Valor (R$)">
            <input id="job-price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Prazo de entrega">
            <input id="job-deadline" className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
        <Field label="Link (pasta, vídeo final)">
          <input id="job-link" className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Briefing e observações">
          <textarea id="job-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <label className="row-flex small">
          <input id="job-portfolio" type="checkbox" checked={portfolio} onChange={(e) => setPortfolio(e.target.checked)} />
          Vale entrar no portfólio
        </label>
        <div className="sheet-foot">
          {job && (
            <ConfirmButton
              label="Excluir"
              onConfirm={() => {
                deleteJob(job.id);
                onClose();
              }}
            />
          )}
          <span className="spacer" />
          <button className="btn btn--primary" type="submit" disabled={!title.trim() || !client.trim()}>
            {job ? 'Salvar' : 'Criar trabalho'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// ---------- Preços ----------

function Pricing({ jobs, services }: { jobs: Job[]; services: Service[] }) {
  const profile = useSlice('profile');
  const rate = hourlyRate(jobs);
  const [hours, setHours] = useState('');
  const target = profile.hourGoal;
  const h = parseNum(hours);

  const patch = (id: ID, p: Partial<Service>) => setServices(services.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="cols cols--even">
      <section className="section">
        <div className="section-head">
          <h2 className="label">Tabela de serviços</h2>
          <button className="btn btn--sm" onClick={() => setServices([...services, { id: uid('v'), name: 'Novo serviço', price: 0, hours: 1 }])}>
            <Plus size={14} /> Serviço
          </button>
        </div>
        {!services.length && (
          <p className="small muted">
            Liste o que você vende, quanto cobra e quantas horas leva. O Copiloto usa esta tabela para montar propostas, e você enxerga o valor/hora de cada serviço.
          </p>
        )}
        <div className="list">
          {services.map((s) => {
            const perHour = s.hours > 0 ? s.price / s.hours : 0;
            return (
              <div key={s.id} className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <input
                  id={`svc-name-${s.id}`} aria-label="Nome do serviço" className="input grow" style={{ minWidth: 150, height: 36 }}
                  defaultValue={s.name} onBlur={(e) => e.target.value.trim() && patch(s.id, { name: e.target.value.trim() })}
                />
                <input
                  id={`svc-price-${s.id}`} aria-label="Preço em reais" className="input" style={{ width: 84, height: 36 }} inputMode="decimal"
                  defaultValue={String(s.price)} onBlur={(e) => patch(s.id, { price: parseNum(e.target.value) ?? 0 })}
                />
                <input
                  id={`svc-hours-${s.id}`} aria-label="Horas estimadas" className="input" style={{ width: 62, height: 36 }} inputMode="decimal"
                  defaultValue={String(s.hours)} onBlur={(e) => patch(s.id, { hours: parseNum(e.target.value) ?? 0 })}
                />
                <span className={`small nowrap${target && perHour < target ? '' : ' soft'}`} style={{ minWidth: 68, color: target && perHour > 0 && perHour < target ? 'var(--warn-ink)' : undefined }}>
                  {perHour ? `${fmtMoney(perHour)}/h` : '—'}
                </span>
                <button className="icon-btn icon-btn--sm" aria-label={`Remover ${s.name}`} onClick={() => setServices(services.filter((x) => x.id !== s.id))}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
        {services.length > 0 && <span className="small muted">Colunas: serviço · preço (R$) · horas · valor por hora</span>}
      </section>

      <div className="stack">
        <section className="section">
          <h2 className="label">Quanto vale a sua hora</h2>
          {rate ? (
            <>
              <div className="hero-num">{fmtMoney(rate.rate)}</div>
              <p className="small soft">
                por hora, medido em {rate.jobs} {rate.jobs === 1 ? 'trabalho pago' : 'trabalhos pagos'} e {fmtMin(rate.hours * 60)} de foco registrado.
                {target > 0 && (rate.rate >= target ? ' Você está acima do seu alvo.' : ` Seu alvo é ${fmtMoney(target)} — cobre mais ou edite mais rápido.`)}
              </p>
            </>
          ) : (
            <p className="small muted">
              Use o foco dentro de um trabalho e marque-o como pago. Com isso o Hexa calcula o valor real da sua hora — o número que deveria guiar seus preços.
            </p>
          )}
          <Field label="Alvo de valor por hora (R$)">
            <input
              id="hour-goal" className="input" inputMode="decimal" defaultValue={target ? String(target) : ''} placeholder="Ex.: 60"
              onBlur={(e) => setProfile({ hourGoal: parseNum(e.target.value) ?? 0 })}
            />
          </Field>
        </section>

        <section className="section">
          <h2 className="label">Calculadora de orçamento</h2>
          <Field label="Horas que este trabalho deve levar">
            <input id="calc-hours" className="input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Ex.: 5" />
          </Field>
          {h && h > 0 && target > 0 ? (
            <p className="soft">
              Cobre pelo menos <b style={{ color: 'var(--fg)' }}>{fmtMoney(h * target)}</b>. Com uma rodada de revisão na conta (+20%): <b style={{ color: 'var(--fg)' }}>{fmtMoney(h * target * 1.2)}</b>.
            </p>
          ) : (
            <p className="small muted">{target > 0 ? 'Informe as horas para ver o piso do orçamento.' : 'Defina o alvo de valor por hora para calcular.'}</p>
          )}
        </section>
      </div>
    </div>
  );
}
