import { addDays, toISO, fromISO, weekdayOf } from './dates';
import type { AssessmentKind, AttrKey, Course, Effort, FrontKey, ID, ISODate } from './types';

// Captura rápida: uma linha de texto livre vira o registro certo.
// "prova de cálculo dia 28" → avaliação · "gastei 32 no uber" → despesa ·
// "editar reels do João até sexta" → missão do Estúdio com prazo.
// Tudo por regras locais: funciona offline e sem IA.

export type Capture =
  | { type: 'mission'; title: string; front: FrontKey; attr: AttrKey; effort: Effort; due?: ISODate }
  | { type: 'assessment'; title: string; kind: AssessmentKind; courseId: ID; courseName: string; date?: ISODate }
  | { type: 'tx'; kind: 'in' | 'out'; amount: number; category: string; note: string; date: ISODate }
  | { type: 'lead'; name: string; channel: string }
  | { type: 'idea'; name: string };

/** Minúsculas e sem acentos, preservando o comprimento (para reaproveitar índices). */
export function norm(text: string): string {
  return text.normalize('NFC').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const MONTH_RX = 'janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez';
const MONTH_INDEX: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};
const WEEKDAY_INDEX: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const LEAD_IN = '(?:(?:ate|para|pra|em|no|na|nesta|neste|essa|esse)\\s+(?:o\\s+|a\\s+)?)?';

function nextDayOfMonth(day: number, today: ISODate): ISODate | null {
  if (day < 1 || day > 31) return null;
  const t = fromISO(today);
  let d = new Date(t.getFullYear(), t.getMonth(), day);
  if (d.getDate() !== day || toISO(d) < today) d = new Date(t.getFullYear(), t.getMonth() + 1, day);
  return d.getDate() === day ? toISO(d) : null;
}

function resolveDMY(day: number, month: number, year: number | undefined, today: ISODate): ISODate | null {
  const t = fromISO(today);
  let y = year === undefined ? t.getFullYear() : year < 100 ? 2000 + year : year;
  let d = new Date(y, month, day);
  if (d.getDate() !== day || d.getMonth() !== month) return null;
  // Sem ano explícito, uma data que já passou há mais de 2 meses é do ano que vem.
  if (year === undefined && d.getTime() < t.getTime() - 60 * 86400000) {
    y += 1;
    d = new Date(y, month, day);
  }
  return toISO(d);
}

interface DateHit {
  date: ISODate;
  start: number;
  end: number;
}

/** Encontra a primeira expressão de data em texto já normalizado. */
export function findDate(n: string, today: ISODate): DateHit | null {
  const tries: { rx: RegExp; to: (m: RegExpExecArray) => ISODate | null }[] = [
    { rx: new RegExp(`${LEAD_IN}\\bdepois de amanha\\b`), to: () => addDays(today, 2) },
    { rx: new RegExp(`${LEAD_IN}\\bamanha\\b`), to: () => addDays(today, 1) },
    { rx: new RegExp(`${LEAD_IN}\\bhoje\\b`), to: () => today },
    {
      rx: new RegExp(`${LEAD_IN}(?:\\bdia\\s+)?\\b(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2,4}))?\\b`),
      to: (m) => resolveDMY(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : undefined, today),
    },
    {
      rx: new RegExp(`${LEAD_IN}(?:\\bdia\\s+)?\\b(\\d{1,2})\\s+de\\s+(${MONTH_RX})\\b`),
      to: (m) => resolveDMY(Number(m[1]), MONTH_INDEX[m[2].slice(0, 3)], undefined, today),
    },
    { rx: new RegExp(`${LEAD_IN}\\bdia\\s+(\\d{1,2})\\b`), to: (m) => nextDayOfMonth(Number(m[1]), today) },
    { rx: /\b(?:em|daqui a|daqui)\s+(\d{1,2})\s+dias?\b/, to: (m) => addDays(today, Number(m[1])) },
    {
      rx: new RegExp(`${LEAD_IN}\\b(?:semana que vem|proxima semana)\\b`),
      to: () => {
        const wd = weekdayOf(today);
        return addDays(today, wd === 0 ? 1 : 8 - wd);
      },
    },
    {
      rx: new RegExp(
        `${LEAD_IN}(?:proxim[ao]\\s+)?\\b(domingo|segunda|terca|quarta|quinta|sexta|sabado|seg|qua|qui|sex|sab|dom)(?:-feira)?\\b(?!\\s+(?:prova|lista|parte|versao|edicao|aula|chamada|etapa|fase|temporada))`,
      ),
      to: (m) => {
        const target = WEEKDAY_INDEX[m[1].slice(0, 3)];
        const delta = (target - weekdayOf(today) + 7) % 7 || 7;
        return addDays(today, delta);
      },
    },
  ];
  for (const t of tries) {
    const m = t.rx.exec(n);
    if (!m) continue;
    const date = t.to(m);
    if (date) return { date, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

const cut = (text: string, start: number, end: number) => `${text.slice(0, start)} ${text.slice(end)}`;

function tidy(text: string): string {
  const t = text
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.\-–—]+|[\s,;:\-–—]+$/g, '')
    .replace(/\s+(até|ate|para|pra|em|no|na|de|do|da)$/i, '')
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

const has = (n: string, words: string) => new RegExp(`\\b(?:${words})\\b`).test(n);

const FRONT_WORDS: [FrontKey, string][] = [
  ['faculdade', 'estudar|estudo|prova|p1|p2|p3|trabalho|lista|aula|faculdade|materia|disciplina|seminario|tcc|resumo|revisar|artigo|professor|professora|monografia|fichamento|exercicios'],
  ['estudio', 'editar|edicao|corte|cortes|cortar|render|renderizar|exportar|thumb|thumbnail|legenda|legendar|cliente|proposta|orcamento|portfolio|reels|shorts|prospectar|prospeccao|follow|followup|briefing|motion|premiere|davinci|after|capcut|vsl|podcast|roteiro|entregar|entrega|abordar'],
  ['lab', 'codigo|codar|programar|deploy|bug|api|saas|mvp|landing|automacao|script|github|commit|feature|prototipo|agente|n8n|backend|frontend|refatorar|publicar|lancar|validar|app|site|bot'],
  ['cofre', 'pagar|boleto|fatura|imposto|das|mei|nota fiscal|investir|transferir|cobrar|orcamento do mes|planilha'],
  ['pessoal', 'treino|treinar|academia|medico|dentista|dormir|ler|leitura|mercado|limpar|lavar|cabelo|familia|amigo|descansar|caminhar|correr|meditar'],
];

function guessFront(n: string, courses: Course[]): FrontKey {
  if (matchCourse(n, courses)) return 'faculdade';
  for (const [front, words] of FRONT_WORDS) if (has(n, words)) return front;
  return 'pessoal';
}

function matchCourse(n: string, courses: Course[]): Course | null {
  let best: Course | null = null;
  let bestScore = 0;
  for (const c of courses) {
    if (c.archived) continue;
    const name = norm(c.name);
    let score = 0;
    if (n.includes(name)) score = 100 + name.length;
    else {
      for (const word of name.split(/[^a-z0-9]+/)) {
        if (word.length >= 4 && new RegExp(`\\b${word}`).test(n)) score += word.length;
      }
    }
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

const OUT_CATEGORIES: [string, string][] = [
  ['Alimentação', 'mercado|ifood|almoco|lanche|restaurante|comida|padaria|jantar|cafe|pizza|hamburguer'],
  ['Transporte', 'uber|onibus|gasolina|metro|passagem|combustivel|estacionamento|pedagio'],
  ['Moradia', 'aluguel|luz|internet|agua|condominio|gas|energia'],
  ['Ferramentas', 'adobe|capcut|software|assinatura|plugin|envato|chatgpt|claude|hospedagem|dominio|servidor|notion|figma|licenca|ssd|hd|mouse|teclado|fone'],
  ['Faculdade', 'mensalidade|xerox|livro|apostila|matricula|faculdade'],
  ['Lazer', 'jogo|steam|cinema|bar|role|anime|manga|show|skin|netflix|spotify|crunchyroll'],
];
const IN_CATEGORIES: [string, string][] = [
  ['SaaS', 'saas|assinante|assinantes|mrr|plano'],
  ['IA e automação', 'automacao|ia|bot|agente|chatbot'],
  ['Edição', 'edicao|video|videos|reels|shorts|cliente|freela|corte|cortes|podcast|vsl'],
];

function pick(n: string, table: [string, string][], fallback: string): string {
  for (const [name, words] of table) if (has(n, words)) return name;
  return fallback;
}

const KIND_WORDS: [AssessmentKind, RegExp][] = [
  ['prova', /\b(prova|p[1-4]|av[1-4]|exame|teste)\b/],
  ['seminario', /\b(seminario|apresentacao)\b/],
  ['lista', /\b(lista)\b/],
  ['projeto', /\b(projeto)\b/],
  ['trabalho', /\b(trabalho|relatorio|artigo|resenha)\b/],
];

export function parseCapture(input: string, courses: Course[], today: ISODate): Capture | null {
  let text = input.normalize('NFC').trim();
  if (!text) return null;
  let n = norm(text);

  // Lead e ideia têm prefixo explícito — sem ambiguidade.
  const lead = /^(?:lead|prospect|novo cliente|cliente novo)\s*[:\-–]?\s+(.+)$/.exec(n);
  if (lead) {
    const name = tidy(text.slice(text.length - lead[1].length));
    const channel = has(n, 'instagram|insta|ig') || n.includes('@')
      ? 'Instagram'
      : has(n, 'whatsapp|zap|wpp')
        ? 'WhatsApp'
        : has(n, 'email|e-mail')
          ? 'E-mail'
          : has(n, 'indicacao|indicou')
            ? 'Indicação'
            : has(n, 'youtube|canal')
              ? 'YouTube'
              : has(n, 'linkedin')
                ? 'LinkedIn'
                : 'Outro';
    return name ? { type: 'lead', name, channel } : null;
  }
  const idea = /^(?:ideia|idea)\s*[:\-–]?\s+(.+)$/.exec(n) || /^projeto\s*[:\-–]\s*(.+)$/.exec(n);
  if (idea) {
    const name = tidy(text.slice(text.length - idea[1].length));
    return name ? { type: 'idea', name } : null;
  }

  // Dinheiro: precisa de uma pista explícita (R$, "reais" ou um verbo de pagar/receber).
  const inCue = /\b(recebi|ganhei|entrou|recebido|caiu|pix de|pagamento de|me pagou|me pagaram)\b/.exec(n);
  const outCue = /\b(gastei|paguei|comprei|gasto|torrei|assinei|pagar)\b/.exec(n);
  const money = /(r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(\s*(?:reais|real|conto|contos|pila|pilas)\b)?/.exec(n);
  if (money && (money[1] || money[4] || inCue || (outCue && outCue[1] !== 'pagar'))) {
    const amount = Number(money[2].replace(/\./g, '')) + (money[3] ? Number(money[3].padEnd(2, '0')) / 100 : 0);
    if (amount > 0) {
      const kind: 'in' | 'out' = inCue ? 'in' : 'out';
      let rest = cut(text, money.index, money.index + money[0].length);
      let restN = cut(n, money.index, money.index + money[0].length);
      const hit = findDate(restN, today);
      if (hit) {
        rest = cut(rest, hit.start, hit.end);
        restN = cut(restN, hit.start, hit.end);
      }
      const cue = inCue || outCue;
      if (cue) {
        const at = restN.indexOf(cue[0]);
        if (at >= 0) rest = cut(rest, at, at + cue[0].length);
      }
      const note = tidy(rest.replace(/^\s*(?:de|do|da|no|na|em|com|pelo|pela|por)\s+/i, ' '));
      return {
        type: 'tx',
        kind,
        amount,
        category: kind === 'in' ? pick(n, IN_CATEGORIES, 'Edição') : pick(n, OUT_CATEGORIES, 'Outros'),
        note,
        date: hit?.date ?? today,
      };
    }
  }

  const hit = findDate(n, today);
  if (hit) {
    text = cut(text, hit.start, hit.end);
    n = cut(n, hit.start, hit.end);
  }

  // Avaliação: palavra de avaliação + uma disciplina cadastrada.
  const course = matchCourse(n, courses);
  if (course && !has(n, 'estudar|revisar|fazer|terminar|comecar|ler|resolver')) {
    for (const [kind, rx] of KIND_WORDS) {
      const m = rx.exec(n);
      if (!m) continue;
      // O título é o trecho da avaliação: "P2", "Lista 3", "Prova"…
      const after = /^\s+(\d{1,2})\b/.exec(n.slice(m.index + m[0].length));
      const title = tidy(text.slice(m.index, m.index + m[0].length + (after ? after[0].length : 0)));
      return { type: 'assessment', kind, title, courseId: course.id, courseName: course.name, date: hit?.date };
    }
  }

  const title = tidy(text);
  if (!title) return null;
  const front = guessFront(n, courses);
  const attr: AttrKey =
    front === 'faculdade' ? 'int'
    : front === 'lab' ? 'eng'
    : front === 'cofre' ? 'for'
    : front === 'pessoal' ? 'vig'
    : has(n, 'cliente|proposta|orcamento|prospectar|prospeccao|follow|followup|abordar|cobrar') ? 'inf' : 'ofi';
  const effort: Effort = has(n, 'rapido|rapidinho|rapida|ligar|responder|mandar|enviar|cobrar|agendar|pagar') ? 1 : 2;
  return { type: 'mission', title, front, attr, effort, due: hit?.date };
}
