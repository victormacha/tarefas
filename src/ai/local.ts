import { addDays, fmtDay, fmtMin, fmtMoney, startOfWeek, todayISO, ymOf } from '../lib/dates';
import { buildSignals, rankMissions, timeline } from '../lib/engine';
import { monthProgress, monthSummary, receivables } from '../lib/finance';
import { EFFORTS, FRONTS } from '../lib/meta';
import type { AppState } from '../lib/types';
import { streakOf, weekBuild } from '../lib/xp';

// Análises por regras, sem modelo de linguagem. São o que o Copiloto entrega quando
// não há IA conectada — e a interface as rotula como "análise local".

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function localBriefing(state: AppState, today = todayISO()): string {
  const ranked = rankMissions(state, today);
  const signals = buildSignals(state, today);
  const out: string[] = [];

  if (!ranked.length) {
    out.push('**Fila vazia.** Capture o que está na sua cabeça ou crie missões a partir dos sinais abaixo.');
  } else {
    const [first, ...rest] = ranked;
    out.push(
      `**Comece por:** ${first.mission.title} (${FRONTS[first.mission.front].label}, ${EFFORTS[first.mission.effort].label.toLowerCase()})${first.why ? ` — ${first.why}` : ''}.`,
    );
    const next = rest.slice(0, 3);
    if (next.length) {
      out.push('', 'Depois, nesta ordem:');
      next.forEach((r, i) => out.push(`${i + 1}. ${r.mission.title}${r.why ? ` — ${r.why}` : ''}`));
    }
  }

  const urgent = signals.filter((s) => s.severity !== 'info').slice(0, 4);
  if (urgent.length) {
    out.push('', '**No radar**');
    for (const s of urgent) out.push(`- ${s.title}${s.detail ? ` (${s.detail})` : ''}`);
  }

  const wb = weekBuild(state.progress, state.profile.build, today);
  if (wb.totalXP >= 40) {
    const low = wb.rows.filter((r) => r.planned >= 0.2 && r.actual < r.planned * 0.5);
    if (low.length) {
      out.push('', `**Build da semana:** ${low.map((r) => `${FRONTS[r.front].label} está em ${pct(r.actual)} (plano ${pct(r.planned)})`).join('; ')}.`);
    }
  }
  return out.join('\n');
}

export function localReview(state: AppState, today = todayISO()): string {
  const start = startOfWeek(today);
  const out: string[] = [];
  let done = 0;
  let minutes = 0;
  let active = 0;
  for (let i = 0; i < 7; i++) {
    const d = state.progress.days[addDays(start, i)];
    if (!d) continue;
    done += d.done || 0;
    minutes += Object.values(d.min).reduce((a, b) => a + (b || 0), 0);
    if (Object.values(d.xp).some((v) => (v || 0) > 0)) active++;
  }
  const wb = weekBuild(state.progress, state.profile.build, today);

  out.push(`**Semana desde ${fmtDay(start)}:** ${done} ${done === 1 ? 'missão concluída' : 'missões concluídas'}, ${fmtMin(minutes)} de foco, ${wb.totalXP} XP em ${active} ${active === 1 ? 'dia ativo' : 'dias ativos'}. Sequência atual: ${streakOf(state.progress, today)} dias.`);

  if (wb.totalXP > 0) {
    out.push('', '**Para onde foi o esforço**');
    for (const r of wb.rows) {
      const gap = r.actual - r.planned;
      const verdict = Math.abs(gap) < 0.1 ? 'no plano' : gap > 0 ? 'acima do plano' : 'abaixo do plano';
      out.push(`- ${FRONTS[r.front].label}: ${pct(r.actual)} do XP (plano ${pct(r.planned)}) — ${verdict}`);
    }
  } else {
    out.push('', 'Ainda não há atividade registrada nesta semana.');
  }

  const goal = state.profile.incomeGoal;
  const month = monthSummary(state.vault.txs, ymOf(today));
  const rec = receivables(state.studio.jobs);
  if (goal > 0) {
    out.push(
      '',
      `**Cofre:** ${fmtMoney(month.income)} de ${fmtMoney(goal)} (${pct(month.income / goal)}) com ${pct(monthProgress(today))} do mês corrido` +
        `${rec.due ? `; ${fmtMoney(rec.due)} a receber` : ''}.`,
    );
  }

  const ahead = timeline(state, addDays(today, 1), 7).slice(0, 5);
  if (ahead.length) {
    out.push('', '**Próximos 7 dias**');
    for (const e of ahead) out.push(`- ${fmtDay(e.date)} · ${e.label}: ${e.title}`);
  }

  const signals = buildSignals(state, today).filter((s) => s.severity !== 'info').slice(0, 3);
  if (signals.length) {
    out.push('', '**Não deixe escapar**');
    for (const s of signals) out.push(`- ${s.title}`);
  }
  return out.join('\n');
}
