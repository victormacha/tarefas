import { isISODate } from '../lib/dates';
import type { Action, AppState, AssessmentKind, Effort, FrontKey, Ref } from '../lib/types';
import { buildContext } from './context';

// Contrato entre o Copiloto e o app: as instruções que o modelo recebe e o formato
// em que ele propõe mudanças. As ações vêm num bloco ```hexa (JSON) no fim da
// resposta — o mesmo formato serve para qualquer provedor que devolva texto.

export function instructions(state: AppState): string {
  const name = state.profile.name || 'o usuário';
  return `Você é o Copiloto do Hexa, o aplicativo pessoal de ${name}. O Hexa reúne num lugar só a faculdade, o trabalho como editor de vídeo freelancer, os projetos (SaaS, IA, automação), as finanças e a progressão pessoal dele. No fim desta mensagem está o estado atual dos dados do app. Essa é a sua única fonte sobre a vida dele: não invente clientes, notas, prazos ou valores que não estejam ali, e diga quando faltar um dado para responder bem.

Como responder
- Em português do Brasil, direto e prático, como um parceiro de estratégia que conhece a rotina dele. Comece pela conclusão e depois dê o porquê. Respostas curtas por padrão; alongue só quando ele pedir um texto (proposta, mensagem, plano).
- Apoie cada recomendação nos dados: cite o prazo, o valor, a nota, os dias sem contato.
- Quando as frentes competirem pelo mesmo tempo, escolha e justifique. Ele quer uma decisão, não um cardápio.
- Markdown simples: negrito e listas curtas. Sem tabelas e sem títulos.
- Ao escrever mensagens para clientes (abordagem, follow-up, proposta), entregue o texto pronto para copiar, no tom de um freelancer profissional e humano, sem floreio.

Ações
Quando a resposta implicar mudanças concretas no app, termine com um bloco de código marcado como hexa contendo um array JSON de ações. Ele vê cada ação como um cartão e decide se aplica; nada muda sem o toque dele. Proponha só o que ele pediu ou o que decorre diretamente da conversa, e não repita missões que já existem.

\`\`\`hexa
[{"type":"mission","title":"Enviar 3 exemplos de cortes para o lead","front":"estudio","effort":1,"due":"2026-01-15"}]
\`\`\`

Formatos aceitos (campos opcionais podem ser omitidos):
{"type":"mission","title":"…","front":"faculdade|estudio|lab|cofre|pessoal","effort":1,"due":"AAAA-MM-DD","ref":{"kind":"assessment|job|lead|project","id":"…"}}
{"type":"milestone","projectId":"…","title":"…"}
{"type":"project","name":"…","front":"lab","kind":"SaaS|IA|Automação|Conteúdo|Portfólio|Estudo|Outro","pitch":"…","next":"…","milestones":["…"]}
{"type":"lead","name":"…","channel":"…","niche":"…","value":0,"nextTouch":"AAAA-MM-DD","note":"…"}
{"type":"followup","leadId":"…","date":"AAAA-MM-DD"}
{"type":"tx","kind":"in|out","amount":0,"category":"…","note":"…","date":"AAAA-MM-DD"}
{"type":"build","faculdade":0,"estudio":0,"lab":0,"pessoal":0}  — os quatro somam 10
{"type":"assessment","courseId":"…","title":"…","kind":"prova|trabalho|seminario|lista|projeto","date":"AAAA-MM-DD","weight":1}

Esforço da missão: 1 = até 20 min, 2 = cerca de 1 h, 3 = meio período, 4 = o dia gira em torno dela. Uma missão é algo que se termina em uma sentada; objetivos grandes viram várias missões assim, na ordem em que devem ser feitas. A frente "lab" é a de projetos. Use os ids exatamente como aparecem nos dados.

# Dados do Hexa

${buildContext(state)}`;
}

const BLOCK = /```hexa\s*([\s\S]*?)```/g;

/** Texto que o usuário vê: sem o bloco de ações, inclusive um bloco ainda chegando. */
export function visibleText(raw: string): string {
  let text = raw.replace(BLOCK, '');
  const open = text.indexOf('```hexa');
  if (open >= 0) text = text.slice(0, open);
  // Durante o streaming, o fim pode ser o começo da cerca ("`", "``", "```he"…).
  text = text.replace(/`{1,3}(?:h(?:e(?:x(?:a)?)?)?)?$/, '');
  return text.trim();
}

const FRONTS: FrontKey[] = ['faculdade', 'estudio', 'lab', 'cofre', 'pessoal'];
const KINDS: AssessmentKind[] = ['prova', 'trabalho', 'seminario', 'lista', 'projeto'];
const str = (v: unknown, max = 160): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const date = (v: unknown) => (isISODate(v) ? v : undefined);

function refOf(v: unknown, state: AppState): Ref | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const { kind, id } = v as { kind?: string; id?: string };
  if (typeof id !== 'string') return undefined;
  const exists =
    kind === 'assessment' ? state.academy.assessments.some((a) => a.id === id)
    : kind === 'job' ? state.studio.jobs.some((j) => j.id === id)
    : kind === 'lead' ? state.studio.leads.some((l) => l.id === id)
    : kind === 'project' ? state.projects.items.some((p) => p.id === id)
    : false;
  return exists ? ({ kind, id } as Ref) : undefined;
}

/** Valida uma ação vinda do modelo. Devolve null se ela não puder ser aplicada com segurança. */
export function sanitizeAction(raw: unknown, state: AppState): Action | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case 'mission': {
      const title = str(a.title);
      if (!title) return null;
      const front = FRONTS.includes(a.front as FrontKey) ? (a.front as FrontKey) : 'pessoal';
      const effort = ([1, 2, 3, 4].includes(a.effort as number) ? a.effort : 2) as Effort;
      return { type: 'mission', title, front, effort, due: date(a.due), ref: refOf(a.ref, state) };
    }
    case 'milestone': {
      const title = str(a.title);
      const projectId = str(a.projectId);
      return title && state.projects.items.some((p) => p.id === projectId) ? { type: 'milestone', projectId, title } : null;
    }
    case 'project': {
      const name = str(a.name, 80);
      if (!name) return null;
      return {
        type: 'project',
        name,
        front: FRONTS.includes(a.front as FrontKey) ? (a.front as FrontKey) : 'lab',
        kind: str(a.kind, 30) || 'Outro',
        pitch: str(a.pitch, 400) || undefined,
        next: str(a.next) || undefined,
        milestones: Array.isArray(a.milestones) ? a.milestones.map((m) => str(m)).filter(Boolean).slice(0, 12) : [],
      };
    }
    case 'lead': {
      const name = str(a.name, 80);
      if (!name) return null;
      return {
        type: 'lead', name, channel: str(a.channel, 30) || 'Outro', niche: str(a.niche, 60) || undefined,
        value: num(a.value) > 0 ? num(a.value) : undefined, nextTouch: date(a.nextTouch), note: str(a.note, 400) || undefined,
      };
    }
    case 'followup': {
      const leadId = str(a.leadId);
      const d = date(a.date);
      return d && state.studio.leads.some((l) => l.id === leadId) ? { type: 'followup', leadId, date: d } : null;
    }
    case 'tx': {
      const amount = Math.abs(num(a.amount));
      if (!amount || (a.kind !== 'in' && a.kind !== 'out')) return null;
      return { type: 'tx', kind: a.kind, amount, category: str(a.category, 40) || undefined, note: str(a.note) || undefined, date: date(a.date) };
    }
    case 'build': {
      const v = { faculdade: num(a.faculdade), estudio: num(a.estudio), lab: num(a.lab), pessoal: num(a.pessoal) };
      const sum = v.faculdade + v.estudio + v.lab + v.pessoal;
      return sum > 0 && Object.values(v).every((n) => n >= 0) ? { type: 'build', ...v } : null;
    }
    case 'assessment': {
      const title = str(a.title, 80);
      const courseId = str(a.courseId);
      if (!title || !state.academy.courses.some((c) => c.id === courseId)) return null;
      return {
        type: 'assessment', courseId, title,
        kind: KINDS.includes(a.kind as AssessmentKind) ? (a.kind as AssessmentKind) : 'prova',
        date: date(a.date), weight: num(a.weight) > 0 ? num(a.weight) : 1,
      };
    }
    default:
      return null;
  }
}

/** Separa a resposta do modelo em texto visível e ações validadas. */
export function parseReply(raw: string, state: AppState): { text: string; actions: Action[] } {
  const actions: Action[] = [];
  for (const match of raw.matchAll(BLOCK)) {
    try {
      const parsed = JSON.parse(match[1]);
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        const action = sanitizeAction(item, state);
        if (action) actions.push(action);
      }
    } catch {
      /* bloco malformado: fica só o texto */
    }
  }
  return { text: visibleText(raw), actions: actions.slice(0, 16) };
}
