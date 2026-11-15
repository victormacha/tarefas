import { addDays, addMonths, fromISO, now, todayISO, ymOf } from './dates';
import { getState, mutate } from './store';
import type { AppState, AttrKey, DayStat, ISODate } from './types';
import { emptyXP } from './xp';

// Dados de exemplo — opcionais, escolhidos pelo usuário no onboarding ou nos Ajustes.
// Todos os ids começam com "demo-" para que possam ser removidos sem tocar nos dados reais.
// Nomes de clientes, disciplinas e valores são fictícios.

const at = (iso: ISODate, hour = 10) => {
  const d = fromISO(iso);
  d.setHours(hour);
  return d.getTime();
};

function demoData(today: ISODate): Omit<AppState, 'profile' | 'copilot'> {
  const d = (n: number) => addDays(today, n);
  const ym = ymOf(today);

  const days: Record<ISODate, DayStat> = {};
  const pattern: Partial<Record<AttrKey, number>>[] = [
    { ofi: 48, int: 20, vig: 5 }, { int: 55, vig: 10 }, { ofi: 30, inf: 16, eng: 25 }, {}, { eng: 40, vig: 5 },
    { ofi: 60, inf: 8 }, { int: 35, ofi: 20, vig: 10 }, { inf: 23, for: 28 }, {}, { int: 60, vig: 5 },
    { ofi: 45, eng: 30 }, { ofi: 25, int: 25, vig: 10 }, { inf: 15, eng: 20 }, { ofi: 50, for: 26, vig: 5 },
    {}, { int: 40, ofi: 33 }, { ofi: 58, inf: 8, vig: 10 }, { int: 45, eng: 12, vig: 5 }, { ofi: 40, inf: 16 },
    { int: 30, ofi: 28, vig: 10 }, { ofi: 36, int: 25, vig: 5 },
  ];
  pattern.forEach((xp, i) => {
    const iso = d(i - pattern.length);
    const total = Object.values(xp).reduce((a, b) => a + (b || 0), 0);
    if (!total) return;
    days[iso] = {
      xp,
      min: { estudio: (xp.ofi || 0) * 2, faculdade: Math.round((xp.int || 0) * 1.5), lab: (xp.eng || 0) * 2 },
      done: Math.max(1, Math.round(total / 30)),
    };
  });
  days[today] = { xp: { int: 25, vig: 5 }, min: { faculdade: 30 }, done: 1 };

  return {
    missions: {
      items: [
        { id: 'demo-m1', title: 'Estudar para P2 — Cálculo II', front: 'faculdade', attr: 'int', effort: 3, due: d(2), done: false, createdAt: at(d(-2)), ref: { kind: 'assessment', id: 'demo-a2' } },
        { id: 'demo-m2', title: 'Finalizar Pack 8 Reels — Academia Pulso', front: 'estudio', attr: 'ofi', effort: 3, due: d(2), done: false, createdAt: at(d(-3)), ref: { kind: 'job', id: 'demo-j1' } },
        { id: 'demo-m3', title: 'Responder Loja Brisa sobre o pacote mensal', front: 'estudio', attr: 'inf', effort: 1, due: today, done: false, createdAt: at(d(-1)), ref: { kind: 'lead', id: 'demo-l1' } },
        { id: 'demo-m4', title: 'Subir a landing page com lista de espera', front: 'lab', attr: 'eng', effort: 3, done: false, createdAt: at(d(-6)), ref: { kind: 'project', id: 'demo-p1' } },
        { id: 'demo-m5', title: 'Resolver lista 3 de Banco de Dados', front: 'faculdade', attr: 'int', effort: 2, due: d(4), done: false, createdAt: at(d(-1)) },
        { id: 'demo-m6', title: 'Pagar boleto da faculdade', front: 'cofre', attr: 'for', effort: 1, due: d(1), done: false, createdAt: at(d(-1)) },
        { id: 'demo-m7', title: 'Selecionar os 6 melhores cortes para o portfólio', front: 'estudio', attr: 'ofi', effort: 2, done: false, createdAt: at(d(-8)), ref: { kind: 'project', id: 'demo-p3' } },
        { id: 'demo-m8', title: 'Revisar slides do seminário', front: 'faculdade', attr: 'int', effort: 2, done: true, doneAt: now(), createdAt: at(d(-2)) },
      ],
      rituals: [
        { id: 'demo-r1', title: 'Treino', attr: 'vig', log: [d(-1), d(-3), d(-4), d(-6)], createdAt: at(d(-20)) },
        { id: 'demo-r2', title: 'Leitura 20 min', attr: 'vig', log: [today, d(-1), d(-2), d(-5)], createdAt: at(d(-20)) },
        { id: 'demo-r3', title: 'Dormir antes da meia-noite', attr: 'vig', log: [d(-2), d(-3)], createdAt: at(d(-20)) },
      ],
    },
    academy: {
      courses: [
        { id: 'demo-c1', name: 'Cálculo II', professor: 'Prof. Almeida', passGrade: 6, maxAbsences: 7, absences: 5, slots: [{ weekday: 1, start: '19:00' }, { weekday: 3, start: '19:00' }] },
        { id: 'demo-c2', name: 'Banco de Dados', professor: 'Profa. Nogueira', passGrade: 6, maxAbsences: 7, absences: 1, slots: [{ weekday: 2, start: '19:00' }, { weekday: 4, start: '20:50' }] },
        { id: 'demo-c3', name: 'Engenharia de Software', passGrade: 6, maxAbsences: 7, absences: 2, slots: [{ weekday: 3, start: '20:50' }] },
        { id: 'demo-c4', name: 'Estatística Aplicada', passGrade: 6, maxAbsences: 7, absences: 0, slots: [{ weekday: 5, start: '19:00' }] },
      ],
      assessments: [
        { id: 'demo-a1', courseId: 'demo-c1', title: 'P1', kind: 'prova', date: d(-30), weight: 4, grade: 3.5, rewarded: true },
        { id: 'demo-a2', courseId: 'demo-c1', title: 'P2', kind: 'prova', date: d(3), weight: 4 },
        { id: 'demo-a3', courseId: 'demo-c1', title: 'Lista final', kind: 'lista', date: d(10), weight: 2 },
        { id: 'demo-a4', courseId: 'demo-c2', title: 'Prova 1', kind: 'prova', date: d(-20), weight: 5, grade: 8, rewarded: true },
        { id: 'demo-a5', courseId: 'demo-c2', title: 'Projeto final', kind: 'projeto', date: d(12), weight: 5 },
        { id: 'demo-a6', courseId: 'demo-c3', title: 'Trabalho de requisitos', kind: 'trabalho', date: d(-12), weight: 3, grade: 7.5, rewarded: true },
        { id: 'demo-a7', courseId: 'demo-c3', title: 'Seminário', kind: 'seminario', date: d(6), weight: 3 },
        { id: 'demo-a8', courseId: 'demo-c3', title: 'Prova final', kind: 'prova', date: d(20), weight: 4 },
        { id: 'demo-a9', courseId: 'demo-c4', title: 'P1', kind: 'prova', date: d(-15), weight: 5, grade: 6.5, rewarded: true },
        { id: 'demo-a10', courseId: 'demo-c4', title: 'P2', kind: 'prova', date: d(17), weight: 5 },
      ],
    },
    studio: {
      leads: [
        { id: 'demo-l1', name: 'Loja Brisa Surfwear', channel: 'Instagram', niche: 'Moda praia', stage: 'negociacao', value: 1200, lastTouch: d(-1), nextTouch: d(1), createdAt: at(d(-12)), rewarded: ['proposta'], note: 'Quer pacote mensal de 12 Reels. Pediu desconto no trimestre.', log: [{ at: at(d(-1)), text: 'Enviei proposta ajustada' }, { at: at(d(-5)), text: 'Primeira conversa por DM' }] },
        { id: 'demo-l2', name: 'Dra. Helena Prado', channel: 'Indicação', niche: 'Odontologia', stage: 'proposta', value: 800, lastTouch: d(-5), createdAt: at(d(-9)), rewarded: ['proposta'], log: [{ at: at(d(-5)), text: 'Proposta enviada por WhatsApp' }] },
        { id: 'demo-l3', name: 'Canal Téo Jogos', channel: 'YouTube', niche: 'Games', stage: 'contato', value: 600, lastTouch: d(-2), nextTouch: today, createdAt: at(d(-6)), rewarded: [], log: [{ at: at(d(-2)), text: 'Respondeu pedindo exemplos de cortes' }] },
        { id: 'demo-l4', name: 'Podcast Fora do Roteiro', channel: 'Instagram', niche: 'Podcast', stage: 'novo', createdAt: at(d(-4)), rewarded: [], log: [] },
        { id: 'demo-l5', name: 'Academia Pulso', channel: 'WhatsApp', niche: 'Fitness', stage: 'ganho', value: 900, lastTouch: d(-10), createdAt: at(d(-25)), rewarded: ['proposta', 'ganho'], log: [] },
        { id: 'demo-l6', name: 'Estúdio Norte Tattoo', channel: 'Instagram', niche: 'Tatuagem', stage: 'perdido', createdAt: at(d(-30)), rewarded: [], log: [] },
      ],
      jobs: [
        { id: 'demo-j1', client: 'Academia Pulso', leadId: 'demo-l5', title: 'Pack 8 Reels de novembro', kind: 'Reels / Shorts', price: 900, stage: 'edicao', deadline: d(2), minutes: 190, createdAt: at(d(-8)), rewarded: [] },
        { id: 'demo-j2', client: 'Clínica Vida Leve', title: 'Vídeo institucional de 90s', kind: 'Institucional', price: 650, stage: 'entregue', deadline: d(-7), minutes: 260, createdAt: at(d(-18)), deliveredAt: at(d(-6)), rewarded: ['entregue'] },
        { id: 'demo-j3', client: 'Podcast Sem Pauta', title: 'Cortes do episódio 12', kind: 'Cortes de podcast', price: 350, stage: 'pago', minutes: 210, createdAt: at(d(-16)), deliveredAt: at(d(-11)), paidAt: at(d(-9)), rewarded: ['entregue', 'pago'], portfolio: true },
        { id: 'demo-j4', client: 'Canal Téo Jogos', title: 'Review de 12 minutos', kind: 'Vídeo para YouTube', price: 400, stage: 'pago', minutes: 330, createdAt: at(d(-28)), deliveredAt: at(d(-22)), paidAt: at(d(-20)), rewarded: ['entregue', 'pago'] },
      ],
      services: [
        { id: 'demo-s1', name: 'Reels / Shorts (até 60s)', price: 120, hours: 1.5 },
        { id: 'demo-s2', name: 'Vídeo para YouTube (até 12 min)', price: 400, hours: 6 },
        { id: 'demo-s3', name: 'Cortes de podcast (pacote com 5)', price: 350, hours: 4 },
        { id: 'demo-s4', name: 'VSL / anúncio', price: 600, hours: 8 },
      ],
    },
    vault: {
      txs: [
        { id: 'demo-t1', date: d(-9), amount: 350, kind: 'in', category: 'Edição', note: 'Cortes do episódio 12 — Podcast Sem Pauta', jobId: 'demo-j3' },
        { id: 'demo-t2', date: d(-4), amount: 180, kind: 'in', category: 'Edição', note: 'Reels avulso — indicação' },
        { id: 'demo-t3', date: d(-20), amount: 400, kind: 'in', category: 'Edição', note: 'Review de 12 minutos — Canal Téo Jogos', jobId: 'demo-j4' },
        { id: 'demo-t4', date: d(-2), amount: 310, kind: 'out', category: 'Alimentação', note: 'Mercado do mês' },
        { id: 'demo-t5', date: d(-6), amount: 96, kind: 'out', category: 'Transporte', note: 'Passe + apps' },
        { id: 'demo-t6', date: d(-3), amount: 62, kind: 'out', category: 'Ferramentas', note: 'Assinatura do editor' },
        { id: 'demo-t7', date: d(-8), amount: 79, kind: 'out', category: 'Lazer', note: 'Jogo na promoção' },
        { id: 'demo-t8', date: d(-10), amount: 45, kind: 'out', category: 'Faculdade', note: 'Apostila' },
        ...[1, 2, 3, 4, 5].flatMap((i) => {
          const month = addMonths(ym, -i);
          return [
            { id: `demo-th${i}a`, date: `${month}-12`, amount: 1500 - i * 190, kind: 'in' as const, category: 'Edição', note: 'Trabalhos do mês' },
            { id: `demo-th${i}b`, date: `${month}-15`, amount: 820 + ((i * 53) % 140), kind: 'out' as const, category: 'Outros', note: 'Gastos do mês' },
          ];
        }),
      ],
      goals: [
        { id: 'demo-g1', title: 'Reserva de emergência', target: 3000, saved: 850 },
        { id: 'demo-g2', title: 'Upgrade do PC de edição', target: 4500, saved: 1200, deadline: d(120) },
      ],
    },
    projects: {
      items: [
        {
          id: 'demo-p1', name: 'Legendas automáticas para Reels', front: 'lab', kind: 'SaaS', stage: 'construindo',
          pitch: 'Micro-SaaS que gera legendas estilizadas a partir do áudio. Nasce de uma dor da minha própria rotina de edição.',
          next: 'Subir a landing page com lista de espera',
          milestones: [
            { id: 'demo-k1', title: 'Conversar com 5 editores sobre o problema', done: true, rewarded: true },
            { id: 'demo-k2', title: 'Protótipo de transcrição funcionando', done: true, rewarded: true },
            { id: 'demo-k3', title: 'Landing page com lista de espera', done: false },
            { id: 'demo-k4', title: 'Exportar .srt e preset de estilo', done: false },
            { id: 'demo-k5', title: '10 usuários de teste', done: false },
          ],
          log: [{ at: at(d(-9)), text: 'Transcrição com 94% de acerto nos meus próprios cortes' }],
          createdAt: at(d(-40)), touchedAt: at(d(-9)),
        },
        {
          id: 'demo-p2', name: 'Agente de propostas com IA', front: 'lab', kind: 'IA', stage: 'validando',
          pitch: 'Recebe o perfil do lead e devolve uma proposta de edição pronta para enviar.',
          next: 'Testar com 3 leads reais',
          milestones: [
            { id: 'demo-k6', title: 'Prompt base com meus serviços e preços', done: true, rewarded: true },
            { id: 'demo-k7', title: 'Testar com 3 leads reais', done: false },
            { id: 'demo-k8', title: 'Medir taxa de resposta', done: false },
          ],
          log: [], createdAt: at(d(-14)), touchedAt: at(d(-2)),
        },
        {
          id: 'demo-p3', name: 'Portfólio novo', front: 'estudio', kind: 'Portfólio', stage: 'construindo',
          pitch: 'Uma página só, com os seis melhores cortes e um caso de antes/depois.',
          next: 'Selecionar os 6 melhores cortes',
          milestones: [
            { id: 'demo-k9', title: 'Selecionar os 6 melhores cortes', done: false },
            { id: 'demo-k10', title: 'Gravar o caso de antes/depois', done: false },
            { id: 'demo-k11', title: 'Publicar e colocar na bio', done: false },
          ],
          log: [], createdAt: at(d(-10)), touchedAt: at(d(-4)),
        },
        { id: 'demo-p4', name: 'Canal de bastidores de edição', front: 'estudio', kind: 'Conteúdo', stage: 'ideia', pitch: 'Mostrar o processo de um corte do bruto ao final para atrair clientes.', milestones: [], log: [], createdAt: at(d(-5)), touchedAt: at(d(-5)) },
      ],
    },
    progress: {
      xp: { int: 265, ofi: 430, inf: 150, eng: 135, for: 190, vig: 95 },
      days,
      feed: [
        { at: now(), attr: 'int', xp: 25, text: 'Revisar slides do seminário' },
        { at: at(d(-1), 21), attr: 'ofi', xp: 36, text: 'Foco: Pack 8 Reels de novembro' },
        { at: at(d(-1), 18), attr: 'int', xp: 25, text: 'Resolver lista 2 de Banco de Dados' },
        { at: at(d(-2), 20), attr: 'inf', xp: 8, text: 'Contato: Canal Téo Jogos' },
        { at: at(d(-2), 16), attr: 'ofi', xp: 40, text: 'Entregue: Vídeo institucional de 90s' },
      ],
      unlocked: { 'primeiro-passo': at(d(-21)), 'primeiro-contrato': at(d(-20)) },
      sessions: [],
      focus: null,
    },
  };
}

const isDemo = (x: { id: string }) => x.id.startsWith('demo-');

/** Acrescenta os dados de exemplo ao que já existe. */
export function loadDemo() {
  const demo = demoData(todayISO());
  const hadProgress = Object.values(getState().progress.xp).some((v) => v > 0);
  mutate('missions', (s) => {
    s.items = [...s.items.filter((x) => !isDemo(x)), ...demo.missions.items];
    s.rituals = [...s.rituals.filter((x) => !isDemo(x)), ...demo.missions.rituals];
  });
  mutate('academy', (s) => {
    s.courses = [...s.courses.filter((x) => !isDemo(x)), ...demo.academy.courses];
    s.assessments = [...s.assessments.filter((x) => !isDemo(x)), ...demo.academy.assessments];
  });
  mutate('studio', (s) => {
    s.leads = [...s.leads.filter((x) => !isDemo(x)), ...demo.studio.leads];
    s.jobs = [...s.jobs.filter((x) => !isDemo(x)), ...demo.studio.jobs];
    s.services = [...s.services.filter((x) => !isDemo(x)), ...demo.studio.services];
  });
  mutate('vault', (s) => {
    s.txs = [...s.txs.filter((x) => !isDemo(x)), ...demo.vault.txs];
    s.goals = [...s.goals.filter((x) => !isDemo(x)), ...demo.vault.goals];
  });
  mutate('projects', (s) => {
    s.items = [...s.items.filter((x) => !isDemo(x)), ...demo.projects.items];
  });
  if (!hadProgress) mutate('progress', (p) => Object.assign(p, demo.progress));
  mutate('profile', (p) => {
    p.demo = true;
    if (!p.incomeGoal) p.incomeGoal = 2500;
    if (!p.hourGoal) p.hourGoal = 50;
  });
}

/** Remove só o que veio do exemplo; o progresso volta ao zero porque foi construído sobre ele. */
export function clearDemo() {
  mutate('missions', (s) => {
    s.items = s.items.filter((x) => !isDemo(x));
    s.rituals = s.rituals.filter((x) => !isDemo(x));
  });
  mutate('academy', (s) => {
    s.courses = s.courses.filter((x) => !isDemo(x));
    s.assessments = s.assessments.filter((x) => !isDemo(x));
  });
  mutate('studio', (s) => {
    s.leads = s.leads.filter((x) => !isDemo(x));
    s.jobs = s.jobs.filter((x) => !isDemo(x));
    s.services = s.services.filter((x) => !isDemo(x));
  });
  mutate('vault', (s) => {
    s.txs = s.txs.filter((x) => !isDemo(x));
    s.goals = s.goals.filter((x) => !isDemo(x));
  });
  mutate('projects', (s) => {
    s.items = s.items.filter((x) => !isDemo(x));
  });
  mutate('progress', (p) => {
    p.xp = emptyXP();
    p.days = {};
    p.feed = [];
    p.unlocked = {};
    p.sessions = [];
    p.focus = null;
  });
  mutate('copilot', (c) => {
    c.messages = [];
  });
  mutate('profile', (p) => {
    p.demo = false;
  });
}
