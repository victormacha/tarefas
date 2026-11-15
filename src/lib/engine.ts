import { absenceLevel, standing } from './academics';
import { addDays, diffDays, fmtGrade, fmtMoney, inDays, startOfWeek, toISO, weekdayOf, ymOf } from './dates';
import { monthProgress, monthSummary, receivables } from './finance';
import { ASSESSMENT_KINDS, FRONTS, LEAD_OPEN } from './meta';
import type { AppState, AttrKey, Effort, FrontKey, ISODate, Mission, Ref } from './types';
import { weekBuild } from './xp';

// O "motor": lê todas as frentes e responde três perguntas sem depender de IA —
// o que está escorregando (sinais), o que fazer agora (ranking) e o que vem aí (linha do tempo).

export type Severity = 'critical' | 'warn' | 'info';

export interface MissionDraft {
  title: string;
  front: FrontKey;
  attr?: AttrKey;
  effort: Effort;
  due?: ISODate;
  ref?: Ref;
}

export interface Signal {
  id: string;
  front: FrontKey;
  severity: Severity;
  title: string;
  detail?: string;
  route: string;
  /** Missão que resolve o sinal — criada com um toque. */
  suggest?: MissionDraft;
}

const SEV_ORDER: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };

const kindLabel = (k: string) => ASSESSMENT_KINDS.find((x) => x.key === k)?.label ?? 'Avaliação';

export function buildSignals(state: AppState, today: ISODate): Signal[] {
  const out: Signal[] = [];
  const openRefs = new Set(
    state.missions.items.filter((m) => !m.done && m.ref).map((m) => `${m.ref!.kind}:${m.ref!.id}`),
  );
  const offer = (draft: MissionDraft): MissionDraft | undefined =>
    draft.ref && openRefs.has(`${draft.ref.kind}:${draft.ref.id}`) ? undefined : draft;

  // Faculdade
  for (const course of state.academy.courses) {
    if (course.archived) continue;
    const st = standing(course, state.academy.assessments);

    for (const a of state.academy.assessments) {
      if (a.courseId !== course.id || typeof a.grade === 'number' || !a.date) continue;
      const d = diffDays(today, a.date);
      if (d >= 0 && d <= 7) {
        const study = a.kind === 'prova' || a.kind === 'seminario';
        out.push({
          id: `assess:${a.id}`,
          front: 'faculdade',
          severity: d <= 2 ? 'critical' : 'warn',
          title: `${kindLabel(a.kind)} de ${course.name} ${inDays(a.date, today)}`,
          detail:
            st.needed !== null && st.needed > 0
              ? `${a.title} · você precisa de média ${fmtGrade(st.needed)} no que falta`
              : a.title,
          route: 'faculdade',
          suggest: offer({
            title: study ? `Estudar para ${a.title} — ${course.name}` : `Avançar ${a.title} — ${course.name}`,
            front: 'faculdade',
            effort: 3,
            due: d === 0 ? a.date : addDays(a.date, -1),
            ref: { kind: 'assessment', id: a.id },
          }),
        });
      } else if (d < 0 && d >= -21) {
        out.push({
          id: `grade:${a.id}`,
          front: 'faculdade',
          severity: 'info',
          title: `Lançar a nota de ${a.title}`,
          detail: `${course.name} · aconteceu ${inDays(a.date, today)}`,
          route: 'faculdade',
        });
      }
    }

    const abs = absenceLevel(course);
    if (abs !== 'ok') {
      out.push({
        id: `abs:${course.id}`,
        front: 'faculdade',
        severity: abs === 'perto' ? 'warn' : 'critical',
        title:
          abs === 'estourou'
            ? `${course.name}: limite de faltas estourado`
            : abs === 'limite'
              ? `${course.name}: você está no limite de faltas`
              : `${course.name}: faltas perto do limite`,
        detail: `${course.absences} de ${course.maxAbsences} faltas permitidas`,
        route: 'faculdade',
      });
    }

    if (st.status === 'critico') {
      out.push({
        id: `risk:${course.id}`,
        front: 'faculdade',
        severity: 'critical',
        title: `${course.name}: a média não fecha só com o que falta`,
        detail: `Precisaria de ${fmtGrade(st.needed ?? 0)} — vale conversar com o professor`,
        route: 'faculdade',
      });
    } else if (st.status === 'atencao') {
      out.push({
        id: `risk:${course.id}`,
        front: 'faculdade',
        severity: 'warn',
        title: `${course.name}: precisa de ${fmtGrade(st.needed ?? 0)} de média no que falta`,
        detail: `Média atual ${fmtGrade(st.average ?? 0)} · mínimo ${fmtGrade(course.passGrade)}`,
        route: 'faculdade',
      });
    }
  }

  // Estúdio — clientes
  for (const lead of state.studio.leads) {
    if (!LEAD_OPEN.includes(lead.stage)) continue;
    const follow: MissionDraft = {
      title: `Follow-up: ${lead.name}`,
      front: 'estudio',
      attr: 'inf',
      effort: 1,
      due: today,
      ref: { kind: 'lead', id: lead.id },
    };
    if (lead.nextTouch && diffDays(today, lead.nextTouch) <= 0) {
      const late = -diffDays(today, lead.nextTouch);
      out.push({
        id: `lead:${lead.id}`,
        front: 'estudio',
        severity: late > 2 ? 'critical' : 'warn',
        title: late > 0 ? `Follow-up com ${lead.name} atrasado ${late} ${late === 1 ? 'dia' : 'dias'}` : `Follow-up com ${lead.name} é hoje`,
        detail: lead.value ? `${fmtMoney(lead.value)} em jogo` : undefined,
        route: 'estudio',
        suggest: offer(follow),
      });
    } else if (!lead.nextTouch && lead.stage !== 'novo' && lead.lastTouch && diffDays(lead.lastTouch, today) >= 4) {
      out.push({
        id: `lead:${lead.id}`,
        front: 'estudio',
        severity: 'warn',
        title: `${lead.name}: sem contato há ${diffDays(lead.lastTouch, today)} dias`,
        detail: 'Conversas esfriam rápido — vale um toque curto',
        route: 'estudio',
        suggest: offer(follow),
      });
    } else if (lead.stage === 'novo' && !lead.lastTouch && diffDays(toISO(new Date(lead.createdAt)), today) >= 3) {
      out.push({
        id: `lead:${lead.id}`,
        front: 'estudio',
        severity: 'info',
        title: `${lead.name} ainda não foi abordado`,
        route: 'estudio',
        suggest: offer({ ...follow, title: `Abordar ${lead.name}` }),
      });
    }
  }

  // Estúdio — trabalhos
  for (const job of state.studio.jobs) {
    if (job.stage === 'pago') continue;
    if (job.stage === 'entregue') {
      const days = job.deliveredAt ? diffDays(toISO(new Date(job.deliveredAt)), today) : 0;
      if (days >= 5) {
        out.push({
          id: `pay:${job.id}`,
          front: 'cofre',
          severity: 'warn',
          title: `Cobrar ${job.client}: ${fmtMoney(job.price)} em aberto há ${days} dias`,
          detail: job.title,
          route: 'estudio',
          suggest: offer({
            title: `Cobrar pagamento — ${job.client}`,
            front: 'estudio',
            attr: 'inf',
            effort: 1,
            due: today,
            ref: { kind: 'job', id: job.id },
          }),
        });
      }
      continue;
    }
    if (!job.deadline) continue;
    const d = diffDays(today, job.deadline);
    if (d <= 3) {
      out.push({
        id: `job:${job.id}`,
        front: 'estudio',
        severity: d <= 1 ? 'critical' : 'warn',
        title: d < 0 ? `Entrega atrasada: ${job.title}` : `Entrega ${inDays(job.deadline, today)}: ${job.title}`,
        detail: `${job.client} · ${fmtMoney(job.price)}`,
        route: 'estudio',
        suggest: offer({
          title: `Finalizar ${job.title} — ${job.client}`,
          front: 'estudio',
          attr: 'ofi',
          effort: 3,
          due: d < 0 ? today : job.deadline,
          ref: { kind: 'job', id: job.id },
        }),
      });
    }
  }

  // Projetos parados
  for (const p of state.projects.items) {
    if (p.stage !== 'construindo' && p.stage !== 'validando') continue;
    const idle = diffDays(toISO(new Date(p.touchedAt)), today);
    if (idle >= 7) {
      out.push({
        id: `proj:${p.id}`,
        front: p.front,
        severity: 'info',
        title: `${p.name} está parado há ${idle} dias`,
        detail: p.next ? `Próxima ação: ${p.next}` : 'Sem próxima ação definida',
        route: 'projetos',
        suggest: p.next
          ? offer({ title: p.next, front: p.front, effort: 2, ref: { kind: 'project', id: p.id } })
          : undefined,
      });
    }
  }

  // Cofre — ritmo da meta
  const goal = state.profile.incomeGoal;
  if (goal > 0) {
    const progress = monthProgress(today);
    const income = monthSummary(state.vault.txs, ymOf(today)).income;
    const pending = receivables(state.studio.jobs).due;
    if (progress >= 0.5 && income + pending < goal * (progress - 0.25)) {
      out.push({
        id: 'pace',
        front: 'cofre',
        severity: 'warn',
        title: `Receita em ${Math.round((income / goal) * 100)}% da meta com ${Math.round(progress * 100)}% do mês`,
        detail: `Faltam ${fmtMoney(goal - income)}${pending ? ` · ${fmtMoney(pending)} a receber` : ''}`,
        route: 'cofre',
      });
    }
  }

  // Build — frente planejada que não recebeu foco
  if (diffDays(startOfWeek(today), today) >= 2) {
    const wb = weekBuild(state.progress, state.profile.build, today);
    if (wb.totalXP >= 40) {
      for (const row of wb.rows) {
        if (row.planned >= 0.2 && row.actual <= row.planned * 0.3) {
          out.push({
            id: `drift:${row.front}`,
            front: row.front,
            severity: 'info',
            title: `${FRONTS[row.front].label} recebeu ${Math.round(row.actual * 100)}% do foco da semana`,
            detail: `O plano era ${Math.round(row.planned * 100)}%`,
            route: 'build',
          });
        }
      }
    }
  }

  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

export interface Ranked {
  mission: Mission;
  score: number;
  why: string;
}

/** Ordena as missões abertas pelo que mais importa hoje, com o motivo principal. */
export function rankMissions(state: AppState, today: ISODate): Ranked[] {
  const wb = weekBuild(state.progress, state.profile.build, today);
  const drift: Partial<Record<FrontKey, number>> = {};
  for (const row of wb.rows) drift[row.front] = Math.max(0, row.planned - row.actual);

  const ranked = state.missions.items
    .filter((m) => !m.done)
    .map((m) => {
      const parts: { score: number; why: string }[] = [];

      if (m.due) {
        const d = diffDays(today, m.due);
        if (d < 0) parts.push({ score: Math.min(160, 110 + -d * 6), why: `atrasada ${-d} ${d === -1 ? 'dia' : 'dias'}` });
        else if (d === 0) parts.push({ score: 95, why: 'vence hoje' });
        else if (d === 1) parts.push({ score: 72, why: 'vence amanhã' });
        else if (d <= 3) parts.push({ score: 50, why: `vence em ${d} dias` });
        else if (d <= 7) parts.push({ score: 24, why: `vence em ${d} dias` });
      }
      if (m.pin === today) parts.push({ score: 60, why: 'fixada para hoje' });

      if (m.ref?.kind === 'assessment') {
        const a = state.academy.assessments.find((x) => x.id === m.ref!.id);
        if (a) parts.push({ score: Math.min(28, 8 + a.weight * 0.4), why: 'vale nota' });
      } else if (m.ref?.kind === 'job') {
        const j = state.studio.jobs.find((x) => x.id === m.ref!.id);
        if (j) parts.push({ score: Math.min(26, 8 + Math.log10(Math.max(10, j.price)) * 5), why: 'cliente esperando' });
      } else if (m.ref?.kind === 'lead') {
        parts.push({ score: 14, why: 'oportunidade aberta' });
      }

      const gap = drift[m.front] || 0;
      if (gap >= 0.12 && wb.totalXP >= 40) {
        parts.push({ score: Math.min(26, gap * 70), why: `${FRONTS[m.front].label} abaixo do plano` });
      }

      const age = diffDays(toISO(new Date(m.createdAt)), today);
      if (age >= 5) parts.push({ score: Math.min(12, age * 0.6), why: `na fila há ${age} dias` });
      if (m.effort === 1) parts.push({ score: 5, why: 'rápida de resolver' });

      const score = parts.reduce((s, p) => s + p.score, 0);
      const top = parts.sort((a, b) => b.score - a.score)[0];
      return { mission: m, score, why: top?.why ?? '' };
    });

  return ranked.sort((a, b) => b.score - a.score || a.mission.createdAt - b.mission.createdAt);
}

export interface TimelineEvent {
  id: string;
  date: ISODate;
  front: FrontKey;
  label: string;
  title: string;
  route: string;
}

/** Marcos datados de todas as frentes dentro da janela [from, from + days). */
export function timeline(state: AppState, from: ISODate, days: number): TimelineEvent[] {
  const end = addDays(from, days - 1);
  const inside = (d?: ISODate): d is ISODate => !!d && d >= from && d <= end;
  const out: TimelineEvent[] = [];

  for (const a of state.academy.assessments) {
    if (typeof a.grade === 'number' || !inside(a.date)) continue;
    const course = state.academy.courses.find((c) => c.id === a.courseId);
    out.push({
      id: `a:${a.id}`,
      date: a.date,
      front: 'faculdade',
      label: kindLabel(a.kind),
      title: course ? `${a.title} — ${course.name}` : a.title,
      route: 'faculdade',
    });
  }
  for (const j of state.studio.jobs) {
    if (j.stage === 'entregue' || j.stage === 'pago' || !inside(j.deadline)) continue;
    out.push({ id: `j:${j.id}`, date: j.deadline, front: 'estudio', label: 'Entrega', title: `${j.title} — ${j.client}`, route: 'estudio' });
  }
  for (const l of state.studio.leads) {
    if (!LEAD_OPEN.includes(l.stage) || !inside(l.nextTouch)) continue;
    out.push({ id: `l:${l.id}`, date: l.nextTouch, front: 'estudio', label: 'Follow-up', title: l.name, route: 'estudio' });
  }
  for (const m of state.missions.items) {
    if (m.done || !inside(m.due)) continue;
    // Missões ligadas a prova, entrega ou cliente já aparecem pelo próprio marco.
    if (m.ref && m.ref.kind !== 'project') continue;
    out.push({ id: `m:${m.id}`, date: m.due, front: m.front, label: 'Missão', title: m.title, route: 'hoje' });
  }
  for (const g of state.vault.goals) {
    if (g.saved >= g.target || !inside(g.deadline)) continue;
    out.push({ id: `g:${g.id}`, date: g.deadline, front: 'cofre', label: 'Meta', title: g.title, route: 'cofre' });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Aulas do dia, em ordem de horário. */
export function classesOn(state: AppState, iso: ISODate): { name: string; start: string }[] {
  const wd = weekdayOf(iso);
  const out: { name: string; start: string }[] = [];
  for (const c of state.academy.courses) {
    if (c.archived) continue;
    for (const s of c.slots) if (s.weekday === wd) out.push({ name: c.name, start: s.start });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
