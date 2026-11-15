import { newlyUnlocked } from './achievements';
import { addDays, now, todayISO, toISO, uid } from './dates';
import type { MissionDraft } from './engine';
import { ATTRS, EFFORTS, FRONTS, JOB_STAGES } from './meta';
import { getState, mutate, resetState } from './store';
import type {
  Action, ActiveFocus, Assessment, AttrKey, BuildFront, ChatMsg, Course, Effort, FrontKey, Goal, ID,
  ISODate, Job, JobStage, Lead, LeadStage, Mission, Profile, Project, ProjectStage, Service, Tx,
} from './types';
import { showLevelUp, toast } from './ui';
import { levelOf, rankOf, totalXP } from './xp';

// Todas as alterações de estado passam por aqui. Cada ação cuida do efeito
// colateral que a acompanha (XP, lançamentos financeiros, histórico).

const MAX_DAYS = 420;

interface AwardOpts {
  silent?: boolean;
  /** +1 ao concluir missão, -1 ao reabrir. */
  done?: number;
  undo?: () => void;
}

/** Concede (ou retira) XP de um atributo e dispara os avisos de progressão. */
export function award(attr: AttrKey, amount: number, text: string, opts: AwardOpts = {}) {
  const before = getState().progress.xp;
  const levelBefore = levelOf(totalXP(before)).level;
  const rankBefore = rankOf(before[attr]).index;
  const today = todayISO();

  mutate('progress', (p) => {
    p.xp[attr] = Math.max(0, (p.xp[attr] || 0) + amount);
    const day = (p.days[today] ??= { xp: {}, min: {}, done: 0 });
    day.xp[attr] = Math.max(0, (day.xp[attr] || 0) + amount);
    if (opts.done) day.done = Math.max(0, day.done + opts.done);
    if (amount > 0) {
      p.feed.unshift({ at: now(), attr, xp: amount, text });
      p.feed.length = Math.min(p.feed.length, 40);
    }
    const keys = Object.keys(p.days);
    if (keys.length > MAX_DAYS) for (const k of keys.sort().slice(0, keys.length - MAX_DAYS)) delete p.days[k];
  });

  const after = getState().progress.xp;
  if (amount > 0 && !opts.silent) toast({ tone: 'xp', attr, xp: amount, text, undo: opts.undo });
  if (amount > 0) {
    const rankAfter = rankOf(after[attr]);
    if (rankAfter.index > rankBefore) toast({ tone: 'ok', text: `${ATTRS[attr].label} subiu para o rank ${rankAfter.rank}` });
    const levelAfter = levelOf(totalXP(after)).level;
    if (levelAfter > levelBefore) showLevelUp(levelAfter);
  }
  checkAchievements();
}

export function checkAchievements() {
  const fresh = newlyUnlocked(getState());
  if (!fresh.length) return;
  mutate('progress', (p) => {
    for (const a of fresh) p.unlocked[a.id] = now();
  });
  for (const a of fresh) toast({ tone: 'ok', text: `Conquista: ${a.title}` });
}

// ---------- Missões ----------

export function addMission(draft: MissionDraft & { pin?: ISODate; note?: string }): ID {
  const id = uid('m');
  const mission: Mission = {
    id,
    title: draft.title.trim(),
    front: draft.front,
    attr: draft.attr ?? FRONTS[draft.front].attr,
    effort: draft.effort,
    due: draft.due,
    pin: draft.pin,
    note: draft.note,
    ref: draft.ref,
    done: false,
    createdAt: now(),
  };
  mutate('missions', (s) => {
    s.items.push(mission);
  });
  return id;
}

export function updateMission(id: ID, patch: Partial<Mission>) {
  mutate('missions', (s) => {
    const m = s.items.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
  });
}

export function deleteMission(id: ID) {
  mutate('missions', (s) => {
    s.items = s.items.filter((x) => x.id !== id);
  });
}

export function completeMission(id: ID) {
  const m = getState().missions.items.find((x) => x.id === id);
  if (!m || m.done) return;
  mutate('missions', (s) => {
    const x = s.items.find((y) => y.id === id);
    if (x) {
      x.done = true;
      x.doneAt = now();
    }
  });
  // Concluir a missão também move a entidade ligada a ela.
  if (m.ref?.kind === 'lead') touchLead(m.ref.id, 'Follow-up feito', 0, true);
  if (m.ref?.kind === 'project') touchProject(m.ref.id, `Missão concluída: ${m.title}`);
  if (getState().progress.focus?.missionId === id) stopFocus(true);
  award(m.attr, EFFORTS[m.effort].xp, m.title, { done: 1, undo: () => reopenMission(id) });
}

export function reopenMission(id: ID) {
  const m = getState().missions.items.find((x) => x.id === id);
  if (!m || !m.done) return;
  mutate('missions', (s) => {
    const x = s.items.find((y) => y.id === id);
    if (x) {
      x.done = false;
      x.doneAt = undefined;
    }
  });
  award(m.attr, -EFFORTS[m.effort].xp, '', { silent: true, done: -1 });
}

/** Tira a missão da fila de hoje: prazo e fixação vão para amanhã. */
export function snoozeMission(id: ID) {
  const tomorrow = addDays(todayISO(), 1);
  mutate('missions', (s) => {
    const m = s.items.find((x) => x.id === id);
    if (!m) return;
    if (m.due && m.due <= todayISO()) m.due = tomorrow;
    m.pin = tomorrow;
  });
}

export function togglePin(id: ID) {
  const today = todayISO();
  mutate('missions', (s) => {
    const m = s.items.find((x) => x.id === id);
    if (m) m.pin = m.pin === today ? undefined : today;
  });
}

// ---------- Rituais ----------

export function addRitual(title: string, attr: AttrKey = 'vig') {
  mutate('missions', (s) => {
    s.rituals.push({ id: uid('r'), title: title.trim(), attr, log: [], createdAt: now() });
  });
}

export function deleteRitual(id: ID) {
  mutate('missions', (s) => {
    s.rituals = s.rituals.filter((r) => r.id !== id);
  });
}

export function toggleRitual(id: ID, date: ISODate = todayISO()) {
  const r = getState().missions.rituals.find((x) => x.id === id);
  if (!r) return;
  const was = r.log.includes(date);
  mutate('missions', (s) => {
    const x = s.rituals.find((y) => y.id === id);
    if (!x) return;
    x.log = was ? x.log.filter((d) => d !== date) : [...x.log, date].sort().slice(-120);
  });
  award(r.attr, was ? -5 : 5, r.title, { silent: was });
}

// ---------- Foco ----------

export function startFocus(focus: Omit<ActiveFocus, 'startedAt'>) {
  mutate('progress', (p) => {
    p.focus = { ...focus, startedAt: now() };
  });
}

/** Encerra o foco. Com `save`, registra a sessão, o tempo no trabalho e o XP. */
export function stopFocus(save: boolean): number {
  const f = getState().progress.focus;
  if (!f) return 0;
  const minutes = Math.min(240, Math.round((now() - f.startedAt) / 60000));
  const keep = save && minutes >= 1;
  const today = todayISO();
  mutate('progress', (p) => {
    p.focus = null;
    if (!keep) return;
    p.sessions.unshift({
      id: uid('s'), at: f.startedAt, minutes, front: f.front, attr: f.attr, title: f.title,
      missionId: f.missionId, jobId: f.jobId,
    });
    p.sessions.length = Math.min(p.sessions.length, 150);
    const day = (p.days[today] ??= { xp: {}, min: {}, done: 0 });
    day.min[f.front] = (day.min[f.front] || 0) + minutes;
  });
  if (!keep) return 0;
  if (f.jobId) {
    mutate('studio', (s) => {
      const j = s.jobs.find((x) => x.id === f.jobId);
      if (j) j.minutes += minutes;
    });
  }
  award(f.attr, Math.max(1, Math.round(minutes / 3)), `Foco: ${f.title}`);
  return minutes;
}

// ---------- Faculdade ----------

export function addCourse(c: Pick<Course, 'name'> & Partial<Course>): ID {
  const id = uid('c');
  mutate('academy', (s) => {
    s.courses.push({ passGrade: 6, maxAbsences: 15, absences: 0, slots: [], ...c, id, name: c.name.trim() });
  });
  return id;
}

export function updateCourse(id: ID, patch: Partial<Course>) {
  mutate('academy', (s) => {
    const c = s.courses.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
  });
}

export function deleteCourse(id: ID) {
  mutate('academy', (s) => {
    s.courses = s.courses.filter((c) => c.id !== id);
    s.assessments = s.assessments.filter((a) => a.courseId !== id);
  });
}

export function bumpAbsence(id: ID, delta: number) {
  mutate('academy', (s) => {
    const c = s.courses.find((x) => x.id === id);
    if (c) c.absences = Math.max(0, c.absences + delta);
  });
}

export function addAssessment(a: Omit<Assessment, 'id'>): ID {
  const id = uid('a');
  mutate('academy', (s) => {
    s.assessments.push({ ...a, id, title: a.title.trim() });
  });
  return id;
}

export function updateAssessment(id: ID, patch: Partial<Assessment>) {
  mutate('academy', (s) => {
    const a = s.assessments.find((x) => x.id === id);
    if (a) Object.assign(a, patch);
  });
}

export function deleteAssessment(id: ID) {
  mutate('academy', (s) => {
    s.assessments = s.assessments.filter((a) => a.id !== id);
  });
}

/** Lança (ou limpa) a nota. A primeira nota de cada avaliação rende Intelecto. */
export function setGrade(id: ID, grade: number | undefined) {
  const a = getState().academy.assessments.find((x) => x.id === id);
  if (!a) return;
  const first = grade !== undefined && !a.rewarded;
  mutate('academy', (s) => {
    const x = s.assessments.find((y) => y.id === id);
    if (!x) return;
    x.grade = grade;
    if (first) x.rewarded = true;
  });
  if (first) {
    const course = getState().academy.courses.find((c) => c.id === a.courseId);
    const passed = course ? (grade as number) >= course.passGrade : false;
    award('int', passed ? 35 : 20, `Nota lançada: ${a.title}`);
  }
}

// ---------- Estúdio: clientes ----------

export function addLead(l: Pick<Lead, 'name'> & Partial<Lead>): ID {
  const id = uid('l');
  mutate('studio', (s) => {
    s.leads.push({ channel: 'Instagram', stage: 'novo', log: [], rewarded: [], createdAt: now(), ...l, id, name: l.name.trim() });
  });
  checkAchievements();
  return id;
}

export function updateLead(id: ID, patch: Partial<Lead>) {
  mutate('studio', (s) => {
    const l = s.leads.find((x) => x.id === id);
    if (l) Object.assign(l, patch);
  });
}

export function deleteLead(id: ID) {
  mutate('studio', (s) => {
    s.leads = s.leads.filter((l) => l.id !== id);
  });
}

/** Registra um contato feito hoje e agenda o próximo (0 = sem próximo). */
export function touchLead(id: ID, text: string, nextInDays: number, silent = false) {
  const lead = getState().studio.leads.find((x) => x.id === id);
  if (!lead) return;
  const today = todayISO();
  const firstToday = lead.lastTouch !== today;
  mutate('studio', (s) => {
    const l = s.leads.find((x) => x.id === id);
    if (!l) return;
    l.lastTouch = today;
    l.nextTouch = nextInDays > 0 ? addDays(today, nextInDays) : undefined;
    if (l.stage === 'novo') l.stage = 'contato';
    l.log.unshift({ at: now(), text });
    l.log.length = Math.min(l.log.length, 30);
  });
  if (firstToday) award('inf', 8, `Contato: ${lead.name}`, { silent });
}

export function moveLead(id: ID, stage: LeadStage) {
  const lead = getState().studio.leads.find((x) => x.id === id);
  if (!lead || lead.stage === stage) return;
  const reward = stage === 'proposta' ? 15 : stage === 'ganho' ? 50 : 0;
  const fresh = reward > 0 && !lead.rewarded.includes(stage);
  mutate('studio', (s) => {
    const l = s.leads.find((x) => x.id === id);
    if (!l) return;
    l.stage = stage;
    if (fresh) l.rewarded.push(stage);
    if (stage === 'ganho' || stage === 'perdido') l.nextTouch = undefined;
  });
  if (fresh) award('inf', reward, stage === 'ganho' ? `Cliente fechado: ${lead.name}` : `Proposta enviada: ${lead.name}`);
  else checkAchievements();
}

// ---------- Estúdio: trabalhos ----------

export function addJob(j: Pick<Job, 'client' | 'title'> & Partial<Job>): ID {
  const id = uid('j');
  mutate('studio', (s) => {
    s.jobs.push({
      kind: 'Reels / Shorts', price: 0, stage: 'briefing', minutes: 0, rewarded: [], createdAt: now(),
      ...j, id, client: j.client.trim(), title: j.title.trim(),
    });
  });
  return id;
}

export function updateJob(id: ID, patch: Partial<Job>) {
  mutate('studio', (s) => {
    const j = s.jobs.find((x) => x.id === id);
    if (j) Object.assign(j, patch);
  });
}

export function deleteJob(id: ID) {
  mutate('studio', (s) => {
    s.jobs = s.jobs.filter((j) => j.id !== id);
  });
}

/** Muda a etapa. Entregar rende Ofício; receber cria o lançamento no Cofre e rende Fortuna. */
export function moveJob(id: ID, stage: JobStage) {
  const job = getState().studio.jobs.find((x) => x.id === id);
  if (!job || job.stage === stage) return;
  const order = JOB_STAGES.map((s) => s.key);
  const reached = (target: JobStage) => order.indexOf(stage) >= order.indexOf(target);
  const deliver = reached('entregue') && !job.rewarded.includes('entregue');
  const pay = stage === 'pago' && !job.rewarded.includes('pago');

  mutate('studio', (s) => {
    const j = s.jobs.find((x) => x.id === id);
    if (!j) return;
    j.stage = stage;
    if (reached('entregue') && !j.deliveredAt) j.deliveredAt = now();
    if (stage === 'pago') j.paidAt = now();
    if (deliver) j.rewarded.push('entregue');
    if (pay) j.rewarded.push('pago');
  });

  if (deliver) award('ofi', 40, `Entregue: ${job.title}`);
  if (pay) {
    if (job.price > 0) {
      mutate('vault', (v) => {
        v.txs.push({
          id: uid('t'), date: todayISO(), amount: job.price, kind: 'in', category: 'Edição',
          note: `${job.title} — ${job.client}`, jobId: job.id,
        });
      });
    }
    award('for', 20 + Math.min(60, Math.round(job.price / 50)), `Pagamento recebido: ${job.client}`);
  }
}

/** Cliente fechado vira trabalho em briefing. */
export function jobFromLead(leadId: ID): ID | null {
  const lead = getState().studio.leads.find((x) => x.id === leadId);
  if (!lead) return null;
  return addJob({ client: lead.name, leadId, title: 'Novo trabalho', price: lead.value ?? 0 });
}

export function setServices(services: Service[]) {
  mutate('studio', (s) => {
    s.services = services;
  });
}

// ---------- Cofre ----------

export function addTx(t: Omit<Tx, 'id'>): ID {
  const id = uid('t');
  mutate('vault', (v) => {
    v.txs.push({ ...t, id });
  });
  award('for', 2, 'Lançamento registrado', { silent: true });
  return id;
}

export function updateTx(id: ID, patch: Partial<Tx>) {
  mutate('vault', (v) => {
    const t = v.txs.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  });
}

export function deleteTx(id: ID) {
  mutate('vault', (v) => {
    v.txs = v.txs.filter((t) => t.id !== id);
  });
}

export function addGoal(g: Omit<Goal, 'id' | 'saved'> & { saved?: number }): ID {
  const id = uid('g');
  mutate('vault', (v) => {
    v.goals.push({ saved: 0, ...g, id });
  });
  return id;
}

export function updateGoal(id: ID, patch: Partial<Goal>) {
  mutate('vault', (v) => {
    const g = v.goals.find((x) => x.id === id);
    if (g) Object.assign(g, patch);
  });
}

export function deleteGoal(id: ID) {
  mutate('vault', (v) => {
    v.goals = v.goals.filter((g) => g.id !== id);
  });
}

export function contributeGoal(id: ID, amount: number) {
  const goal = getState().vault.goals.find((x) => x.id === id);
  if (!goal || !amount) return;
  mutate('vault', (v) => {
    const g = v.goals.find((x) => x.id === id);
    if (g) g.saved = Math.max(0, g.saved + amount);
  });
  if (amount > 0) award('for', 10, `Aporte: ${goal.title}`);
}

// ---------- Projetos ----------

export function addProject(p: Pick<Project, 'name'> & Partial<Project>): ID {
  const id = uid('p');
  mutate('projects', (s) => {
    s.items.push({
      front: 'lab', kind: 'SaaS', stage: 'ideia', milestones: [], log: [], createdAt: now(), touchedAt: now(),
      ...p, id, name: p.name.trim(),
    });
  });
  return id;
}

export function updateProject(id: ID, patch: Partial<Project>) {
  mutate('projects', (s) => {
    const p = s.items.find((x) => x.id === id);
    if (p) Object.assign(p, patch, { touchedAt: now() });
  });
}

export function deleteProject(id: ID) {
  mutate('projects', (s) => {
    s.items = s.items.filter((p) => p.id !== id);
  });
}

export function touchProject(id: ID, text?: string) {
  mutate('projects', (s) => {
    const p = s.items.find((x) => x.id === id);
    if (!p) return;
    p.touchedAt = now();
    if (text) {
      p.log.unshift({ at: now(), text });
      p.log.length = Math.min(p.log.length, 40);
    }
  });
}

export function setProjectStage(id: ID, stage: ProjectStage) {
  const project = getState().projects.items.find((x) => x.id === id);
  if (!project || project.stage === stage) return;
  const launch = stage === 'lancado' && !project.launched;
  mutate('projects', (s) => {
    const p = s.items.find((x) => x.id === id);
    if (!p) return;
    p.stage = stage;
    p.touchedAt = now();
    if (launch) p.launched = true;
  });
  if (launch) award(FRONTS[project.front].attr, 100, `Lançado: ${project.name}`);
}

export function addMilestone(projectId: ID, title: string) {
  mutate('projects', (s) => {
    const p = s.items.find((x) => x.id === projectId);
    if (!p || !title.trim()) return;
    p.milestones.push({ id: uid('k'), title: title.trim(), done: false });
    p.touchedAt = now();
  });
}

export function deleteMilestone(projectId: ID, milestoneId: ID) {
  mutate('projects', (s) => {
    const p = s.items.find((x) => x.id === projectId);
    if (p) p.milestones = p.milestones.filter((k) => k.id !== milestoneId);
  });
}

export function toggleMilestone(projectId: ID, milestoneId: ID) {
  const project = getState().projects.items.find((x) => x.id === projectId);
  const ms = project?.milestones.find((k) => k.id === milestoneId);
  if (!project || !ms) return;
  const fresh = !ms.done && !ms.rewarded;
  mutate('projects', (s) => {
    const k = s.items.find((x) => x.id === projectId)?.milestones.find((y) => y.id === milestoneId);
    if (!k) return;
    k.done = !k.done;
    if (fresh) k.rewarded = true;
    const p = s.items.find((x) => x.id === projectId);
    if (p) p.touchedAt = now();
  });
  if (fresh) award(FRONTS[project.front].attr, 30, `Marco: ${ms.title}`);
}

// ---------- Perfil ----------

export function setProfile(patch: Partial<Profile>) {
  mutate('profile', (p) => {
    Object.assign(p, patch);
  });
}

export function setBuild(build: Record<BuildFront, number>) {
  mutate('profile', (p) => {
    p.build = build;
  });
}

// ---------- Copiloto ----------

export function pushMessage(msg: Omit<ChatMsg, 'id' | 'at'>): ID {
  const id = uid('x');
  mutate('copilot', (c) => {
    c.messages.push({ ...msg, id, at: now() });
    if (c.messages.length > 40) c.messages = c.messages.slice(-40);
  });
  return id;
}

export function patchMessage(id: ID, patch: Partial<ChatMsg>) {
  mutate('copilot', (c) => {
    const m = c.messages.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
  });
}

export function clearChat() {
  mutate('copilot', (c) => {
    c.messages = [];
  });
}

const FRONT_SET = new Set<FrontKey>(['faculdade', 'estudio', 'lab', 'cofre', 'pessoal']);
const clampEffort = (n: unknown): Effort => (n === 1 || n === 2 || n === 3 || n === 4 ? n : 2);

/** Aplica uma ação proposta pelo Copiloto (ou pela captura rápida). Devolve o que foi feito. */
export function applyAction(a: Action): string {
  switch (a.type) {
    case 'mission': {
      const front = FRONT_SET.has(a.front) ? a.front : 'pessoal';
      addMission({ title: a.title, front, effort: clampEffort(a.effort), due: a.due, ref: a.ref });
      return 'Missão criada';
    }
    case 'milestone':
      addMilestone(a.projectId, a.title);
      return 'Marco adicionado';
    case 'project': {
      const id = addProject({
        name: a.name,
        front: a.front && FRONT_SET.has(a.front) ? a.front : 'lab',
        kind: a.kind || 'SaaS',
        pitch: a.pitch,
        next: a.next,
      });
      for (const title of a.milestones ?? []) addMilestone(id, title);
      return 'Projeto criado';
    }
    case 'lead':
      addLead({ name: a.name, channel: a.channel || 'Outro', niche: a.niche, value: a.value, nextTouch: a.nextTouch, note: a.note });
      return 'Lead registrado';
    case 'tx':
      addTx({ kind: a.kind, amount: Math.abs(a.amount), category: a.category || (a.kind === 'in' ? 'Edição' : 'Outros'), note: a.note, date: a.date || todayISO() });
      return 'Lançamento registrado';
    case 'build': {
      const raw = { faculdade: a.faculdade, estudio: a.estudio, lab: a.lab, pessoal: a.pessoal };
      const build = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, Math.max(0, Math.min(10, Math.round(Number(v) || 0)))]),
      ) as Record<BuildFront, number>;
      setBuild(build);
      return 'Build da semana atualizada';
    }
    case 'followup':
      updateLead(a.leadId, { nextTouch: a.date });
      return 'Follow-up agendado';
    case 'assessment':
      addAssessment({ courseId: a.courseId, title: a.title, kind: a.kind ?? 'prova', date: a.date, weight: a.weight ?? 1 });
      return 'Avaliação adicionada';
  }
}

// ---------- Manutenção ----------

/** Remove missões concluídas há mais de 45 dias para o estado não crescer sem limite. */
export function housekeeping() {
  const limit = now() - 45 * 86400000;
  const stale = getState().missions.items.some((m) => m.done && (m.doneAt ?? 0) < limit);
  if (!stale) return;
  mutate('missions', (s) => {
    s.items = s.items.filter((m) => !(m.done && (m.doneAt ?? 0) < limit));
  });
}

export function resetAll() {
  resetState();
}

export const isoOf = (ms: number) => toISO(new Date(ms));
