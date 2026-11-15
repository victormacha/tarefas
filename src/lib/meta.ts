import type {
  AssessmentKind, AttrKey, BuildFront, Effort, FrontKey, JobStage, LeadStage, ProjectStage,
} from './types';

// Vocabulário do produto: frentes da vida, atributos da build e etapas dos fluxos.

export interface FrontMeta {
  label: string;
  attr: AttrKey;
  /** Variável CSS da cor da frente (a cor sempre vem acompanhada do nome). */
  color: string;
}

export const FRONTS: Record<FrontKey, FrontMeta> = {
  faculdade: { label: 'Faculdade', attr: 'int', color: 'var(--f-faculdade)' },
  estudio: { label: 'Estúdio', attr: 'ofi', color: 'var(--f-estudio)' },
  lab: { label: 'Projetos', attr: 'eng', color: 'var(--f-lab)' },
  cofre: { label: 'Cofre', attr: 'for', color: 'var(--f-cofre)' },
  pessoal: { label: 'Pessoal', attr: 'vig', color: 'var(--f-pessoal)' },
};

export const FRONT_KEYS: FrontKey[] = ['faculdade', 'estudio', 'lab', 'cofre', 'pessoal'];
export const BUILD_FRONTS: BuildFront[] = ['faculdade', 'estudio', 'lab', 'pessoal'];

export interface AttrMeta {
  label: string;
  short: string;
  front: FrontKey;
  feeds: string;
}

export const ATTRS: Record<AttrKey, AttrMeta> = {
  int: { label: 'Intelecto', short: 'INT', front: 'faculdade', feeds: 'Estudo, provas e trabalhos da faculdade' },
  ofi: { label: 'Ofício', short: 'OFI', front: 'estudio', feeds: 'Edições entregues e horas de corte' },
  inf: { label: 'Influência', short: 'INF', front: 'estudio', feeds: 'Prospecção, propostas e clientes fechados' },
  eng: { label: 'Engenho', short: 'ENG', front: 'lab', feeds: 'Código, marcos de projeto e lançamentos' },
  for: { label: 'Fortuna', short: 'FOR', front: 'cofre', feeds: 'Pagamentos recebidos e metas financeiras' },
  vig: { label: 'Vigor', short: 'VIG', front: 'pessoal', feeds: 'Rituais diários e missões pessoais' },
};

// Ordem dos vértices do hexágono (sentido horário a partir do topo).
export const ATTR_KEYS: AttrKey[] = ['int', 'ofi', 'inf', 'for', 'eng', 'vig'];

export const EFFORTS: Record<Effort, { label: string; hint: string; xp: number }> = {
  1: { label: 'Rápida', hint: 'até 20 min', xp: 10 },
  2: { label: 'Normal', hint: 'cerca de 1 h', xp: 25 },
  3: { label: 'Pesada', hint: 'meio período', xp: 50 },
  4: { label: 'Chefe', hint: 'o dia gira em torno dela', xp: 100 },
};

export const LEAD_STAGES: { key: LeadStage; label: string }[] = [
  { key: 'novo', label: 'A abordar' },
  { key: 'contato', label: 'Em conversa' },
  { key: 'proposta', label: 'Proposta enviada' },
  { key: 'negociacao', label: 'Negociando' },
  { key: 'ganho', label: 'Fechado' },
  { key: 'perdido', label: 'Perdido' },
];
export const LEAD_OPEN: LeadStage[] = ['novo', 'contato', 'proposta', 'negociacao'];

export const JOB_STAGES: { key: JobStage; label: string }[] = [
  { key: 'briefing', label: 'Briefing' },
  { key: 'edicao', label: 'Edição' },
  { key: 'revisao', label: 'Revisão' },
  { key: 'entregue', label: 'Entregue' },
  { key: 'pago', label: 'Pago' },
];

export const PROJECT_STAGES: { key: ProjectStage; label: string }[] = [
  { key: 'construindo', label: 'Construindo' },
  { key: 'validando', label: 'Validando' },
  { key: 'ideia', label: 'Ideias' },
  { key: 'lancado', label: 'Lançados' },
  { key: 'pausado', label: 'Pausados' },
];

export const PROJECT_KINDS = ['SaaS', 'IA', 'Automação', 'Conteúdo', 'Portfólio', 'Estudo', 'Outro'];

export const ASSESSMENT_KINDS: { key: AssessmentKind; label: string }[] = [
  { key: 'prova', label: 'Prova' },
  { key: 'trabalho', label: 'Trabalho' },
  { key: 'seminario', label: 'Seminário' },
  { key: 'lista', label: 'Lista' },
  { key: 'projeto', label: 'Projeto' },
];

export const CHANNELS = ['Instagram', 'WhatsApp', 'E-mail', 'Indicação', 'YouTube', 'LinkedIn', 'Plataforma freela', 'Outro'];
export const JOB_KINDS = ['Reels / Shorts', 'Vídeo para YouTube', 'Cortes de podcast', 'VSL / anúncio', 'Institucional', 'Motion', 'Outro'];

export const INCOME_SOURCES = ['Edição', 'SaaS', 'IA e automação', 'Outros'];
export const EXPENSE_CATEGORIES = ['Moradia', 'Alimentação', 'Transporte', 'Faculdade', 'Ferramentas', 'Lazer', 'Outros'];

export const frontOfAttr = (attr: AttrKey): FrontKey => ATTRS[attr].front;

/** Distribuições prontas de foco para a semana (somam 10). */
export const BUILD_PRESETS: { id: string; label: string; hint: string; build: Record<BuildFront, number> }[] = [
  { id: 'equilibrada', label: 'Equilibrada', hint: 'Um pouco de tudo', build: { faculdade: 3, estudio: 3, lab: 3, pessoal: 1 } },
  { id: 'provas', label: 'Semana de provas', hint: 'A faculdade manda', build: { faculdade: 6, estudio: 2, lab: 1, pessoal: 1 } },
  { id: 'clientes', label: 'Caça a clientes', hint: 'Prospecção e entregas', build: { faculdade: 2, estudio: 5, lab: 2, pessoal: 1 } },
  { id: 'construcao', label: 'Modo construção', hint: 'Projetos em primeiro lugar', build: { faculdade: 2, estudio: 2, lab: 5, pessoal: 1 } },
];
