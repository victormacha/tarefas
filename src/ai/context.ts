import { standing } from '../lib/academics';
import { diffDays, fmtMoney, todayISO, WEEKDAYS, weekdayOf, ymOf } from '../lib/dates';
import { buildSignals, rankMissions } from '../lib/engine';
import { hourlyRate, monthSummary, receivables } from '../lib/finance';
import { ATTR_KEYS, ATTRS, EFFORTS, FRONTS, JOB_STAGES, LEAD_STAGES, PROJECT_STAGES } from '../lib/meta';
import type { AppState } from '../lib/types';
import { levelOf, rankOf, streakOf, totalXP, weekBuild } from '../lib/xp';

// Retrato compacto do estado do app, em texto, para o modelo raciocinar.
// Inclui os ids para que as ações propostas apontem para registros reais.

const pct = (n: number) => `${Math.round(n * 100)}%`;
const label = <T extends { key: string; label: string }>(list: T[], key: string) => list.find((x) => x.key === key)?.label ?? key;

export function buildContext(state: AppState, today = todayISO()): string {
  const lines: string[] = [];
  const { profile, progress } = state;
  const lvl = levelOf(totalXP(progress.xp));

  lines.push(`HOJE: ${today} (${WEEKDAYS[weekdayOf(today)]})`);
  lines.push(`USUÁRIO: ${profile.name || 'sem nome'} · nível ${lvl.level} · ${streakOf(progress, today)} dias seguidos de atividade`);
  if (profile.about.trim()) lines.push(`SOBRE ELE (escrito por ele): ${profile.about.trim()}`);
  lines.push(`ATRIBUTOS: ${ATTR_KEYS.map((k) => `${ATTRS[k].label} ${rankOf(progress.xp[k]).rank} (${progress.xp[k]} XP)`).join(' · ')}`);

  const wb = weekBuild(progress, profile.build, today);
  lines.push(
    `BUILD DA SEMANA (plano → real, por XP): ${wb.rows
      .map((r) => `${FRONTS[r.front].label} ${pct(r.planned)} → ${wb.totalXP ? pct(r.actual) : 'sem dados'}`)
      .join(' · ')}`,
  );

  const ranked = rankMissions(state, today).slice(0, 20);
  lines.push('', `MISSÕES ABERTAS (${ranked.length}, em ordem de prioridade):`);
  if (!ranked.length) lines.push('- nenhuma');
  for (const { mission: m, why } of ranked) {
    lines.push(
      `- [${m.id}] ${m.title} · ${FRONTS[m.front].label} · ${EFFORTS[m.effort].label}${m.due ? ` · prazo ${m.due}` : ''}${why ? ` · ${why}` : ''}`,
    );
  }
  lines.push(`CONCLUÍDAS HOJE: ${progress.days[today]?.done ?? 0}`);

  const courses = state.academy.courses.filter((c) => !c.archived);
  if (courses.length) {
    lines.push('', 'FACULDADE:');
    for (const c of courses) {
      const st = standing(c, state.academy.assessments);
      const pend = state.academy.assessments
        .filter((a) => a.courseId === c.id && typeof a.grade !== 'number')
        .map((a) => `${a.title} [${a.id}]${a.date ? ` em ${a.date}` : ''} peso ${a.weight}`);
      lines.push(
        `- [${c.id}] ${c.name} · média ${st.average === null ? 'sem notas' : st.average.toFixed(1)} (mínimo ${c.passGrade})` +
          `${st.needed !== null ? ` · precisa de ${st.needed.toFixed(1)} no que falta` : ''} · faltas ${c.absences}/${c.maxAbsences}` +
          `${pend.length ? ` · pendentes: ${pend.join('; ')}` : ''}`,
      );
    }
  }

  const leads = state.studio.leads.filter((l) => l.stage !== 'perdido').slice(0, 30);
  if (leads.length) {
    lines.push('', 'ESTÚDIO — CLIENTES E LEADS:');
    for (const l of leads) {
      lines.push(
        `- [${l.id}] ${l.name} · ${label(LEAD_STAGES, l.stage)}${l.value ? ` · ${fmtMoney(l.value)}` : ''} · ${l.channel}${l.niche ? ` · ${l.niche}` : ''}` +
          `${l.lastTouch ? ` · último contato há ${diffDays(l.lastTouch, today)} dias` : ' · nunca contatado'}` +
          `${l.nextTouch ? ` · follow-up ${l.nextTouch}` : ''}${l.note ? ` · nota: ${l.note}` : ''}`,
      );
    }
  }

  const jobs = [...state.studio.jobs.filter((j) => j.stage !== 'pago'), ...state.studio.jobs.filter((j) => j.stage === 'pago').slice(-3)];
  if (jobs.length) {
    lines.push('', 'ESTÚDIO — TRABALHOS:');
    for (const j of jobs) {
      lines.push(
        `- [${j.id}] ${j.title} · ${j.client} · ${label(JOB_STAGES, j.stage)} · ${fmtMoney(j.price)}${j.deadline ? ` · prazo ${j.deadline}` : ''}` +
          `${j.minutes ? ` · ${Math.round(j.minutes / 6) / 10} h registradas` : ''}`,
      );
    }
  }
  if (state.studio.services.length) {
    lines.push(`TABELA DE SERVIÇOS: ${state.studio.services.map((s) => `${s.name} ${fmtMoney(s.price)} (~${s.hours} h)`).join(' · ')}`);
  }
  const rate = hourlyRate(state.studio.jobs);
  if (rate) lines.push(`VALOR/HORA REAL: ${fmtMoney(rate.rate)} em ${rate.jobs} trabalhos pagos${profile.hourGoal ? ` · alvo ${fmtMoney(profile.hourGoal)}` : ''}`);

  const month = monthSummary(state.vault.txs, ymOf(today));
  const rec = receivables(state.studio.jobs);
  lines.push(
    '',
    `COFRE (mês atual): receita ${fmtMoney(month.income)}${profile.incomeGoal ? ` de meta ${fmtMoney(profile.incomeGoal)}` : ' (sem meta definida)'} · ` +
      `despesas ${fmtMoney(month.expense)} · a receber ${fmtMoney(rec.due)} · em produção ${fmtMoney(rec.inProgress)}`,
  );
  if (month.sources.length) lines.push(`FONTES DE RECEITA: ${month.sources.map((b) => `${b.name} ${fmtMoney(b.amount)}`).join(' · ')}`);
  if (month.categories.length) lines.push(`MAIORES DESPESAS: ${month.categories.slice(0, 5).map((b) => `${b.name} ${fmtMoney(b.amount)}`).join(' · ')}`);
  if (state.vault.goals.length) {
    lines.push(`METAS: ${state.vault.goals.map((g) => `${g.title} ${fmtMoney(g.saved)}/${fmtMoney(g.target)}${g.deadline ? ` até ${g.deadline}` : ''}`).join(' · ')}`);
  }

  const projects = state.projects.items.filter((p) => p.stage !== 'pausado').slice(0, 15);
  if (projects.length) {
    lines.push('', 'PROJETOS:');
    for (const p of projects) {
      const open = p.milestones.filter((k) => !k.done).map((k) => k.title);
      const done = p.milestones.length - open.length;
      lines.push(
        `- [${p.id}] ${p.name} · ${FRONTS[p.front].label} · ${p.kind} · ${label(PROJECT_STAGES, p.stage)}${p.pitch ? ` · ${p.pitch}` : ''}` +
          `${p.next ? ` · próxima ação: ${p.next}` : ''} · marcos ${done}/${p.milestones.length}${open.length ? ` · pendentes: ${open.join('; ')}` : ''}`,
      );
    }
  }

  const signals = buildSignals(state, today).slice(0, 12);
  if (signals.length) {
    lines.push('', 'SINAIS DETECTADOS PELO APP:');
    for (const s of signals) lines.push(`- (${s.severity}) ${s.title}${s.detail ? ` — ${s.detail}` : ''}`);
  }

  return lines.join('\n');
}
