import { useState } from 'react';
import { Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  addMilestone, addMission, addProject, deleteMilestone, deleteProject, isoOf, setProjectStage, toggleMilestone, touchProject,
  updateProject,
} from '../lib/actions';
import { diffDays, fmtDay } from '../lib/dates';
import { FRONT_KEYS, FRONTS, PROJECT_KINDS, PROJECT_STAGES } from '../lib/meta';
import { useSlice } from '../lib/store';
import type { FrontKey, ID, Project, ProjectStage } from '../lib/types';
import { openCopilot, toast } from '../lib/ui';
import { prompts } from '../ai/copilot';
import { useToday } from '../ui/hooks';
import { ConfirmButton, Empty, Field, FrontTag, Meter, Sheet } from '../ui/kit';

export function ProjectsView() {
  const { items } = useSlice('projects');
  const today = useToday();
  const [open, setOpen] = useState<ID | null>(null);
  const [idea, setIdea] = useState('');
  const current = items.find((p) => p.id === open);

  const capture = () => {
    if (!idea.trim()) return;
    addProject({ name: idea, stage: 'ideia' });
    setIdea('');
    toast({ text: 'Ideia guardada' });
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="label">Engenho</span>
          <h1 className="display">Projetos</h1>
        </div>
        <div className="head-actions">
          <button className="btn btn--primary" onClick={() => setOpen(addProject({ name: 'Novo projeto', stage: 'construindo' }))}>
            <Plus size={16} /> Projeto
          </button>
        </div>
      </header>

      <form
        className="row-flex"
        onSubmit={(e) => {
          e.preventDefault();
          capture();
        }}
      >
        <input id="idea-input" className="input" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Teve uma ideia? Guarde em uma linha antes que ela escape" />
        <button className="btn" type="submit" disabled={!idea.trim()}>Guardar</button>
      </form>

      {!items.length ? (
        <Empty title="Do rascunho ao lançamento">
          SaaS, automações, experimentos com IA, o portfólio novo: cada projeto tem uma próxima ação, marcos e um diário. O Copiloto quebra o projeto em
          missões que cabem na sua semana, e o radar avisa quando um deles ficar parado.
        </Empty>
      ) : (
        PROJECT_STAGES.map((stage) => {
          const list = items.filter((p) => p.stage === stage.key);
          if (!list.length) return null;
          return (
            <section key={stage.key} className="section">
              <div className="section-head">
                <h2 className="label">{stage.label}</h2>
                <span className="small muted">{list.length}</span>
              </div>
              <div className="list">
                {list.map((p) => {
                  const done = p.milestones.filter((k) => k.done).length;
                  const idle = diffDays(isoOf(p.touchedAt), today);
                  const live = p.stage === 'construindo' || p.stage === 'validando';
                  return (
                    <button key={p.id} className="row" onClick={() => setOpen(p.id)}>
                      <span className="row-main">
                        <span className="row-title">{p.name}</span>
                        <span className="row-meta">
                          <FrontTag front={p.front} label={p.kind} />
                          {p.next && <span>Próxima: {p.next}</span>}
                        </span>
                      </span>
                      <span className="row-end" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 92 }}>
                        {live && idle >= 7 ? <span className="pill pill--warn">parado há {idle}d</span> : null}
                        {p.milestones.length > 0 && (
                          <>
                            <span className="small muted">{done}/{p.milestones.length} marcos</span>
                            <span style={{ width: 92 }}>
                              <Meter thin value={done / p.milestones.length} color={FRONTS[p.front].color} label="Marcos concluídos" />
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {current && <ProjectSheet project={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ProjectSheet({ project: p, onClose }: { project: Project; onClose: () => void }) {
  const [milestone, setMilestone] = useState('');
  const [entry, setEntry] = useState('');
  const patch = (data: Partial<Project>) => updateProject(p.id, data);

  return (
    <Sheet title="Projeto" onClose={onClose}>
      <div className="sheet-body">
        <Field label="Nome">
          <input id="proj-name" className="input" defaultValue={p.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== p.name && patch({ name: e.target.value.trim() })} />
        </Field>
        <div className="form-row">
          <Field label="Estágio">
            <select id="proj-stage" className="select" value={p.stage} onChange={(e) => setProjectStage(p.id, e.target.value as ProjectStage)}>
              {PROJECT_STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipo">
            <select id="proj-kind" className="select" value={p.kind} onChange={(e) => patch({ kind: e.target.value })}>
              {PROJECT_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Frente">
            <select id="proj-front" className="select" value={p.front} onChange={(e) => patch({ front: e.target.value as FrontKey })}>
              {FRONT_KEYS.map((f) => (
                <option key={f} value={f}>{FRONTS[f].label}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Em uma frase: o que é e para quem">
          <textarea id="proj-pitch" className="textarea" defaultValue={p.pitch ?? ''} onBlur={(e) => e.target.value.trim() !== (p.pitch ?? '') && patch({ pitch: e.target.value.trim() || undefined })} placeholder="Qual problema resolve, de quem, e por que você" />
        </Field>

        <section className="section">
          <h3 className="label">Próxima ação</h3>
          <div className="row-flex">
            <input
              id="proj-next" className="input" defaultValue={p.next ?? ''} key={p.next ?? ''}
              onBlur={(e) => e.target.value.trim() !== (p.next ?? '') && patch({ next: e.target.value.trim() || undefined })}
              placeholder="O menor passo que destrava o projeto"
            />
            <button
              className="btn"
              disabled={!p.next}
              onClick={() => {
                addMission({ title: p.next!, front: p.front, effort: 2, ref: { kind: 'project', id: p.id } });
                toast({ text: 'Missão criada a partir da próxima ação' });
              }}
            >
              Virar missão
            </button>
          </div>
          <button
            className="btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              const q = prompts.breakdown(p.id, p.name);
              onClose();
              openCopilot(q.prompt);
            }}
          >
            <Sparkles size={15} /> Quebrar em missões com o Copiloto
          </button>
        </section>

        <section className="section">
          <h3 className="label">Marcos</h3>
          <div className="list">
            {p.milestones.map((k) => (
              <div key={k.id} className={`row${k.done ? ' mission-done' : ''}`}>
                <button className="check" role="checkbox" aria-checked={k.done} aria-label={k.title} onClick={() => toggleMilestone(p.id, k.id)}>
                  <Check size={13} strokeWidth={3} />
                </button>
                <span className="row-main">
                  <span className="row-title">{k.title}</span>
                </span>
                <button className="icon-btn icon-btn--sm" aria-label={`Remover marco ${k.title}`} onClick={() => deleteMilestone(p.id, k.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="row-flex"
            onSubmit={(e) => {
              e.preventDefault();
              addMilestone(p.id, milestone);
              setMilestone('');
            }}
          >
            <input id="proj-milestone" className="input" value={milestone} onChange={(e) => setMilestone(e.target.value)} placeholder="Novo marco — um resultado, não uma tarefa" />
            <button className="btn" type="submit" disabled={!milestone.trim()}>
              <Plus size={15} />
            </button>
          </form>
        </section>

        <section className="section">
          <h3 className="label">Diário</h3>
          <form
            className="row-flex"
            onSubmit={(e) => {
              e.preventDefault();
              if (!entry.trim()) return;
              touchProject(p.id, entry.trim());
              setEntry('');
            }}
          >
            <input id="proj-log" className="input" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="O que você aprendeu ou decidiu hoje" />
            <button className="btn" type="submit" disabled={!entry.trim()}>Anotar</button>
          </form>
          {p.log.length > 0 && (
            <div className="list">
              {p.log.slice(0, 8).map((l, i) => (
                <div key={i} className="row" style={{ padding: '8px 2px', alignItems: 'baseline' }}>
                  <span className="mono muted nowrap">{fmtDay(isoOf(l.at))}</span>
                  <span className="small soft">{l.text}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <Field label="Link (repositório, protótipo, página)">
          <input id="proj-link" className="input" defaultValue={p.link ?? ''} onBlur={(e) => e.target.value.trim() !== (p.link ?? '') && patch({ link: e.target.value.trim() || undefined })} placeholder="https://" />
        </Field>

        <div className="sheet-foot">
          <ConfirmButton
            label="Excluir projeto"
            onConfirm={() => {
              deleteProject(p.id);
              onClose();
            }}
          />
          <span className="spacer" />
          <button className="btn btn--primary" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </Sheet>
  );
}
