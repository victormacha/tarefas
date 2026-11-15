import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Send, Square, Trash2 } from 'lucide-react';
import { applyAction, clearChat, patchMessage } from '../lib/actions';
import { fmtDay, fmtMoney } from '../lib/dates';
import { EFFORTS, FRONTS } from '../lib/meta';
import { getState, useSlice } from '../lib/store';
import type { Action, ChatMsg } from '../lib/types';
import { closeCopilot, consumeCopilotPrompt, toast, useUI } from '../lib/ui';
import { ask, PRESETS, stop, useLive } from '../ai/copilot';
import { useAI } from '../ai/provider';
import { Markdown, Sheet } from '../ui/kit';

function describe(a: Action): { kind: string; title: string } {
  const s = getState();
  switch (a.type) {
    case 'mission':
      return { kind: `Missão · ${FRONTS[a.front].label} · ${EFFORTS[a.effort ?? 2].label}${a.due ? ` · ${fmtDay(a.due)}` : ''}`, title: a.title };
    case 'milestone':
      return { kind: `Marco em ${s.projects.items.find((p) => p.id === a.projectId)?.name ?? 'projeto'}`, title: a.title };
    case 'project':
      return { kind: `Novo projeto${a.milestones?.length ? ` · ${a.milestones.length} marcos` : ''}`, title: a.name };
    case 'lead':
      return { kind: 'Novo lead', title: a.name };
    case 'followup':
      return { kind: 'Follow-up', title: `${s.studio.leads.find((l) => l.id === a.leadId)?.name ?? 'Lead'} em ${fmtDay(a.date)}` };
    case 'tx':
      return { kind: a.kind === 'in' ? 'Entrada' : 'Saída', title: `${fmtMoney(a.amount, true)}${a.note ? ` · ${a.note}` : ''}` };
    case 'build':
      return { kind: 'Build da semana', title: `Faculdade ${a.faculdade} · Estúdio ${a.estudio} · Projetos ${a.lab} · Pessoal ${a.pessoal}` };
    case 'assessment':
      return { kind: `Avaliação em ${s.academy.courses.find((c) => c.id === a.courseId)?.name ?? 'disciplina'}`, title: `${a.title}${a.date ? ` · ${fmtDay(a.date)}` : ''}` };
  }
}

function Actions({ msg }: { msg: ChatMsg }) {
  const applied = msg.applied ?? [];
  const run = (indexes: number[]) => {
    for (const i of indexes) applyAction(msg.actions![i]);
    patchMessage(msg.id, { applied: [...applied, ...indexes] });
    toast({ text: indexes.length === 1 ? 'Ação aplicada' : `${indexes.length} ações aplicadas` });
  };
  const pending = msg.actions!.map((_, i) => i).filter((i) => !applied.includes(i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {msg.actions!.map((a, i) => {
        const d = describe(a);
        const done = applied.includes(i);
        return (
          <div key={i} className="action-card" data-applied={done ? '' : undefined}>
            <span className="row-main">
              <span className="row-meta">{d.kind}</span>
              <span className="row-title">{d.title}</span>
            </span>
            {done ? <Check size={16} aria-label="Aplicada" /> : <button className="btn btn--sm" onClick={() => run([i])}>Aplicar</button>}
          </div>
        );
      })}
      {pending.length > 1 && (
        <button className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => run(pending)}>
          Aplicar todas ({pending.length})
        </button>
      )}
    </div>
  );
}

export function CopilotPanel() {
  const { messages } = useSlice('copilot');
  const ui = useUI();
  const live = useLive();
  const ai = useAI();
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);

  const send = (prompt: string) => {
    const preset = PRESETS.find((p) => p.prompt === prompt);
    void ask(prompt, preset?.label, preset?.id);
  };

  useEffect(() => {
    if (ui.copilot.prompt) {
      const p = ui.copilot.prompt;
      consumeCopilotPrompt();
      send(p);
    }
  }, [ui.copilot.nonce]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, live?.text]);

  const copy = (t: string) => {
    navigator.clipboard?.writeText(t).then(() => toast({ text: 'Copiado' }), () => toast({ text: 'Selecione o texto para copiar' }));
  };

  const status = ai.state === 'ready' ? ai.provider.label : ai.state === 'checking' ? 'Verificando…' : 'Modo local · sem IA';

  return (
    <Sheet
      title="Copiloto"
      variant="side"
      onClose={closeCopilot}
      head={
        messages.length > 0 ? (
          <button className="icon-btn" onClick={clearChat} aria-label="Limpar conversa">
            <Trash2 size={17} />
          </button>
        ) : undefined
      }
    >
      <div className="chat">
        <span className="msg-src">{status}</span>
        {!messages.length && (
          <>
            <p className="soft">
              Eu leio seus dados do Hexa — missões, notas, clientes, finanças, projetos — e respondo com base neles. Quando sugiro mudanças, elas
              aparecem como cartões e só valem depois do seu toque.
            </p>
            {ai.state === 'none' && (
              <div className="note">
                Sem IA conectada. O briefing e a revisão funcionam por regras; para conversar, quebrar objetivos e escrever propostas, conecte um modelo nos Ajustes.
              </div>
            )}
          </>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="msg msg--user">{m.text}</div>
          ) : (
            <div key={m.id} className="msg msg--ai">
              {m.source === 'local' && <span className="msg-src">Análise local, por regras</span>}
              {live?.id === m.id ? (
                live.text ? <Markdown text={live.text} /> : <span className="thinking"><i /><i /><i /> Pensando</span>
              ) : (
                <>
                  {m.text && <Markdown text={m.text} />}
                  {m.error && <div className="note">{m.error}</div>}
                  {m.actions && <Actions msg={m} />}
                  {m.text && (
                    <button className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => copy(m.text)}>
                      <Copy size={13} /> Copiar
                    </button>
                  )}
                </>
              )}
            </div>
          ),
        )}
        {!live && (
          <div className="row-flex wrap" style={{ gap: 6 }}>
            {PRESETS.filter((p) => ai.state === 'ready' || p.local).map((p) => (
              <button key={p.id} className="chip chip--lg" onClick={() => send(p.prompt)}>{p.label}</button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (live || !text.trim()) return;
          send(text.trim());
          setText('');
        }}
      >
        <textarea
          id="copilot-input"
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pergunte sobre a sua semana, um cliente, um projeto…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {live ? (
          <button type="button" className="btn" onClick={stop} aria-label="Parar"><Square size={15} /></button>
        ) : (
          <button type="submit" className="btn btn--primary" disabled={!text.trim()} aria-label="Enviar"><Send size={15} /></button>
        )}
      </form>
    </Sheet>
  );
}
