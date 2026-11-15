import { standing } from './academics';
import { todayISO, ymOf } from './dates';
import { monthSummary } from './finance';
import { ATTR_KEYS } from './meta';
import type { AppState } from './types';
import { rankOf, streakOf } from './xp';

// Conquistas: marcos reais, não medalhas por abrir o app.

export interface Achievement {
  id: string;
  title: string;
  how: string;
  test: (s: AppState) => boolean;
}

const focusMinutes = (s: AppState) =>
  Object.values(s.progress.days).reduce((sum, d) => sum + Object.values(d.min).reduce((a, b) => a + (b || 0), 0), 0);
const doneCount = (s: AppState) => Object.values(s.progress.days).reduce((sum, d) => sum + (d.done || 0), 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'primeiro-passo', title: 'Primeiro passo', how: 'Conclua sua primeira missão', test: (s) => doneCount(s) >= 1 },
  { id: 'ritmo', title: 'Ritmo', how: '7 dias seguidos com atividade', test: (s) => streakOf(s.progress, todayISO()) >= 7 },
  { id: 'inabalavel', title: 'Inabalável', how: '30 dias seguidos com atividade', test: (s) => streakOf(s.progress, todayISO()) >= 30 },
  { id: 'foco-profundo', title: 'Foco profundo', how: '10 horas de foco registradas', test: (s) => focusMinutes(s) >= 600 },
  { id: 'primeiro-contrato', title: 'Primeiro contrato', how: 'Receba o pagamento de um trabalho', test: (s) => s.studio.jobs.some((j) => j.stage === 'pago') },
  { id: 'carteira', title: 'Carteira de clientes', how: '5 trabalhos pagos', test: (s) => s.studio.jobs.filter((j) => j.stage === 'pago').length >= 5 },
  { id: 'cacador', title: 'Caçador', how: 'Registre 10 leads', test: (s) => s.studio.leads.length >= 10 },
  { id: 'fechador', title: 'Fechador', how: 'Feche 3 clientes', test: (s) => s.studio.leads.filter((l) => l.stage === 'ganho').length >= 3 },
  {
    id: 'meta-batida',
    title: 'Meta batida',
    how: 'Bata a meta de receita do mês',
    test: (s) => s.profile.incomeGoal > 0 && monthSummary(s.vault.txs, ymOf(todayISO())).income >= s.profile.incomeGoal,
  },
  {
    id: 'aprovado',
    title: 'Aprovado',
    how: 'Feche uma disciplina acima da média',
    test: (s) => s.academy.courses.some((c) => {
      const st = standing(c, s.academy.assessments);
      return st.status === 'aprovado' && st.graded > 0 && st.pending === 0;
    }),
  },
  { id: 'construtor', title: 'No ar', how: 'Lance um projeto', test: (s) => s.projects.items.some((p) => p.stage === 'lancado') },
  { id: 'rank-a', title: 'Rank A', how: 'Leve um atributo ao rank A', test: (s) => ATTR_KEYS.some((k) => rankOf(s.progress.xp[k]).index >= 4) },
  { id: 'hexagono', title: 'Hexágono', how: 'Os seis atributos no rank C ou acima', test: (s) => ATTR_KEYS.every((k) => rankOf(s.progress.xp[k]).index >= 2) },
];

/** Conquistas que acabaram de ser cumpridas e ainda não estavam registradas. */
export function newlyUnlocked(state: AppState): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !state.progress.unlocked[a.id] && a.test(state));
}
