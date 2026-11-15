// Modelo de dados do Hexa. Tudo aqui é JSON puro: o estado inteiro precisa
// sobreviver a localStorage, ao banco do Artifact e a um export/import.

export type ID = string;
/** Data local no formato YYYY-MM-DD. */
export type ISODate = string;

export type FrontKey = 'faculdade' | 'estudio' | 'lab' | 'cofre' | 'pessoal';
export type BuildFront = Exclude<FrontKey, 'cofre'>;
export type AttrKey = 'int' | 'ofi' | 'inf' | 'eng' | 'for' | 'vig';
export type Effort = 1 | 2 | 3 | 4;

export interface Ref {
  kind: 'assessment' | 'job' | 'lead' | 'project';
  id: ID;
}

export interface Mission {
  id: ID;
  title: string;
  front: FrontKey;
  attr: AttrKey;
  effort: Effort;
  due?: ISODate;
  /** Dia em que a missão foi fixada na fila de Hoje. */
  pin?: ISODate;
  done: boolean;
  doneAt?: number;
  createdAt: number;
  note?: string;
  ref?: Ref;
}

export interface Ritual {
  id: ID;
  title: string;
  attr: AttrKey;
  /** Datas em que foi cumprido (mantemos só as mais recentes). */
  log: ISODate[];
  createdAt: number;
}

export interface ClassSlot {
  weekday: number; // 0 = domingo
  start: string; // HH:MM
}

export interface Course {
  id: ID;
  name: string;
  professor?: string;
  passGrade: number;
  maxAbsences: number;
  absences: number;
  slots: ClassSlot[];
  archived?: boolean;
}

export type AssessmentKind = 'prova' | 'trabalho' | 'seminario' | 'lista' | 'projeto';

export interface Assessment {
  id: ID;
  courseId: ID;
  title: string;
  kind: AssessmentKind;
  date?: ISODate;
  weight: number;
  grade?: number;
  /** XP já concedido pela nota lançada. */
  rewarded?: boolean;
}

export type LeadStage = 'novo' | 'contato' | 'proposta' | 'negociacao' | 'ganho' | 'perdido';

export interface LogEntry {
  at: number;
  text: string;
}

export interface Lead {
  id: ID;
  name: string;
  contact?: string;
  channel: string;
  niche?: string;
  stage: LeadStage;
  value?: number;
  nextTouch?: ISODate;
  lastTouch?: ISODate;
  note?: string;
  createdAt: number;
  log: LogEntry[];
  /** Marcos que já renderam XP (evita farm ao mover de etapa). */
  rewarded: string[];
}

export type JobStage = 'briefing' | 'edicao' | 'revisao' | 'entregue' | 'pago';

export interface Job {
  id: ID;
  client: string;
  leadId?: ID;
  title: string;
  kind: string;
  price: number;
  stage: JobStage;
  deadline?: ISODate;
  /** Minutos de foco registrados neste trabalho. */
  minutes: number;
  createdAt: number;
  deliveredAt?: number;
  paidAt?: number;
  portfolio?: boolean;
  link?: string;
  note?: string;
  rewarded: string[];
}

export interface Service {
  id: ID;
  name: string;
  price: number;
  hours: number;
}

export interface Tx {
  id: ID;
  date: ISODate;
  amount: number;
  kind: 'in' | 'out';
  category: string;
  note?: string;
  jobId?: ID;
}

export interface Goal {
  id: ID;
  title: string;
  target: number;
  saved: number;
  deadline?: ISODate;
}

export type ProjectStage = 'ideia' | 'validando' | 'construindo' | 'lancado' | 'pausado';

export interface Milestone {
  id: ID;
  title: string;
  done: boolean;
  rewarded?: boolean;
}

export interface Project {
  id: ID;
  name: string;
  front: FrontKey;
  kind: string;
  stage: ProjectStage;
  pitch?: string;
  next?: string;
  milestones: Milestone[];
  log: LogEntry[];
  createdAt: number;
  touchedAt: number;
  link?: string;
  launched?: boolean;
}

export interface FocusSession {
  id: ID;
  at: number;
  minutes: number;
  front: FrontKey;
  attr: AttrKey;
  title: string;
  missionId?: ID;
  jobId?: ID;
}

export interface ActiveFocus {
  startedAt: number;
  plannedMin: number;
  front: FrontKey;
  attr: AttrKey;
  title: string;
  missionId?: ID;
  jobId?: ID;
}

export interface DayStat {
  xp: Partial<Record<AttrKey, number>>;
  min: Partial<Record<FrontKey, number>>;
  done: number;
}

export interface FeedEntry {
  at: number;
  attr: AttrKey;
  xp: number;
  text: string;
}

export interface Profile {
  name: string;
  onboarded: boolean;
  createdAt: number;
  /** Texto livre que o Copiloto recebe como contexto pessoal. */
  about: string;
  incomeGoal: number;
  hourGoal: number;
  /** Pontos de foco planejados para a semana (somam 10). */
  build: Record<BuildFront, number>;
  theme: 'system' | 'dark' | 'light';
  demo: boolean;
}

export interface Progress {
  xp: Record<AttrKey, number>;
  days: Record<ISODate, DayStat>;
  feed: FeedEntry[];
  unlocked: Record<string, number>;
  sessions: FocusSession[];
  focus: ActiveFocus | null;
}

export type Action =
  | { type: 'mission'; title: string; front: FrontKey; effort?: Effort; due?: ISODate; ref?: Ref }
  | { type: 'milestone'; projectId: ID; title: string }
  | { type: 'project'; name: string; front?: FrontKey; kind?: string; pitch?: string; next?: string; milestones?: string[] }
  | { type: 'lead'; name: string; channel?: string; niche?: string; value?: number; nextTouch?: ISODate; note?: string }
  | { type: 'tx'; kind: 'in' | 'out'; amount: number; category?: string; note?: string; date?: ISODate }
  | { type: 'build'; faculdade: number; estudio: number; lab: number; pessoal: number }
  | { type: 'followup'; leadId: ID; date: ISODate }
  | { type: 'assessment'; courseId: ID; title: string; kind?: AssessmentKind; date?: ISODate; weight?: number };

export interface ChatMsg {
  id: ID;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  /** 'local' = gerado por regras, sem modelo de linguagem. */
  source?: 'ai' | 'local';
  actions?: Action[];
  applied?: number[];
  error?: string;
}

export interface AppState {
  profile: Profile;
  missions: { items: Mission[]; rituals: Ritual[] };
  academy: { courses: Course[]; assessments: Assessment[] };
  studio: { leads: Lead[]; jobs: Job[]; services: Service[] };
  vault: { txs: Tx[]; goals: Goal[] };
  projects: { items: Project[] };
  progress: Progress;
  copilot: { messages: ChatMsg[] };
}

export type SliceKey = keyof AppState;

export const SLICES: SliceKey[] = [
  'profile',
  'missions',
  'academy',
  'studio',
  'vault',
  'projects',
  'progress',
  'copilot',
];
