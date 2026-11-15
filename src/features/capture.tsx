import { useMemo, useState } from 'react';
import { CornerDownLeft, Sparkles } from 'lucide-react';
import { addAssessment, addLead, addMission, addProject, addTx } from '../lib/actions';
import { parseCapture, type Capture } from '../lib/capture';
import { fmtDay, fmtMoney, todayISO } from '../lib/dates';
import { ASSESSMENT_KINDS, EFFORTS, FRONT_KEYS, FRONTS } from '../lib/meta';
import { useSlice } from '../lib/store';
import type { FrontKey } from '../lib/types';
import { closeCapture, openCopilot, toast } from '../lib/ui';
import { prompts } from '../ai/copilot';
import { FrontTag, Sheet } from '../ui/kit';

const EXAMPLES = [
  'editar reels do cliente até sexta',
  'prova de cálculo dia 28',
  'gastei 32 no uber',
  'recebi 400 do vídeo do canal',
  'lead: loja de suplementos no instagram',
  'ideia: gerador de thumbnails com IA',
];

const TYPE_LABEL: Record<Capture['type'], string> = {
  mission: 'Missão',
  assessment: 'Avaliação',
  tx: 'Lançamento',
  lead: 'Lead',
  idea: 'Ideia de projeto',
};

function describe(c: Capture): string {
  switch (c.type) {
    case 'mission':
      return `${EFFORTS[c.effort].label}${c.due ? ` · prazo ${fmtDay(c.due)}` : ' · sem prazo'}`;
    case 'assessment':
      return `${ASSESSMENT_KINDS.find((k) => k.key === c.kind)?.label} de ${c.courseName}${c.date ? ` · ${fmtDay(c.date)}` : ' · sem data'}`;
    case 'tx':
      return `${c.kind === 'in' ? 'Entrada' : 'Saída'} de ${fmtMoney(c.amount, true)} · ${c.category} · ${fmtDay(c.date)}`;
    case 'lead':
      return `Novo lead via ${c.channel}`;
    case 'idea':
      return 'Entra em Projetos como ideia';
  }
}

function commit(c: Capture): string {
  switch (c.type) {
    case 'mission':
      addMission({ title: c.title, front: c.front, attr: c.attr, effort: c.effort, due: c.due });
      return 'Missão criada';
    case 'assessment':
      addAssessment({ courseId: c.courseId, title: c.title, kind: c.kind, date: c.date, weight: 1 });
      return `Avaliação adicionada em ${c.courseName}`;
    case 'tx':
      addTx({ kind: c.kind, amount: c.amount, category: c.category, note: c.note || undefined, date: c.date });
      return c.kind === 'in' ? 'Entrada registrada' : 'Saída registrada';
    case 'lead':
      addLead({ name: c.name, channel: c.channel });
      return 'Lead registrado';
    case 'idea':
      addProject({ name: c.name, stage: 'ideia' });
      return 'Ideia guardada em Projetos';
  }
}

export function CaptureSheet({ preset }: { preset?: string }) {
  const [text, setText] = useState(preset ?? '');
  const [front, setFront] = useState<FrontKey | null>(null);
  const { courses } = useSlice('academy');
  const today = todayISO();

  const parsed = useMemo(() => parseCapture(text, courses, today), [text, courses, today]);
  // Só missões têm frente ajustável; o resto já diz para onde vai.
  const result: Capture | null =
    parsed && parsed.type === 'mission' && front ? { ...parsed, front, attr: FRONTS[front].attr } : parsed;

  const submit = () => {
    if (!result) return;
    toast({ text: commit(result) });
    setText('');
    setFront(null);
  };

  return (
    <Sheet title="Capturar" onClose={closeCapture} variant="top">
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          id="capture-input"
          className="input"
          style={{ height: 48, fontSize: 16 }}
          autoFocus
          autoComplete="off"
          placeholder="Escreva do seu jeito…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFront(null);
          }}
        />

        {result ? (
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row-flex">
              <span className="label">{TYPE_LABEL[result.type]}</span>
              <span className="grow" />
              {result.type === 'mission' && <FrontTag front={result.front} />}
            </div>
            <span className="strong" style={{ overflowWrap: 'anywhere' }}>
              {result.type === 'tx' ? result.note || result.category : result.type === 'lead' || result.type === 'idea' ? result.name : result.title}
            </span>
            <span className="small soft">{describe(result)}</span>
            {result.type === 'mission' && (
              <div className="row-flex wrap" style={{ gap: 6 }}>
                {FRONT_KEYS.map((f) => (
                  <button key={f} type="button" className="chip" aria-pressed={result.front === f} onClick={() => setFront(f)}>
                    {FRONTS[f].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="small muted">Uma linha basta. O Hexa entende o tipo, a frente, a data e o valor:</span>
            <div className="row-flex wrap" style={{ gap: 6 }}>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sheet-foot">
          {text.trim().length > 12 && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                const p = prompts.goal(text.trim());
                closeCapture();
                openCopilot(p.prompt);
              }}
            >
              <Sparkles size={15} /> É um objetivo grande? Planejar com o Copiloto
            </button>
          )}
          <span className="spacer" />
          <button className="btn btn--primary" type="submit" disabled={!result}>
            Salvar <CornerDownLeft size={15} />
          </button>
        </div>
      </form>
    </Sheet>
  );
}
