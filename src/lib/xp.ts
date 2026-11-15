import { addDays, diffDays, startOfWeek } from './dates';
import { ATTR_KEYS, ATTRS, BUILD_FRONTS } from './meta';
import type { AttrKey, BuildFront, ISODate, Progress } from './types';

// Progressão: XP por atributo, nível geral e ranks E→S.

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof RANKS)[number];
const RANK_AT = [0, 120, 350, 800, 1600, 3000];

export interface RankInfo {
  rank: Rank;
  index: number;
  /** Progresso até o próximo rank (0..1); 1 quando já é S. */
  progress: number;
  next?: Rank;
  toNext: number;
}

export function rankOf(xp: number): RankInfo {
  let index = 0;
  for (let i = 0; i < RANK_AT.length; i++) if (xp >= RANK_AT[i]) index = i;
  const top = index === RANK_AT.length - 1;
  const lo = RANK_AT[index];
  const hi = top ? lo : RANK_AT[index + 1];
  return {
    rank: RANKS[index],
    index,
    progress: top ? 1 : (xp - lo) / (hi - lo),
    next: top ? undefined : RANKS[index + 1],
    toNext: top ? 0 : hi - xp,
  };
}

/** Raio do vértice no hexágono (0..1): cada rank ocupa uma faixa igual. */
export function radarValue(xp: number): number {
  const r = rankOf(xp);
  return Math.min(1, (r.index + r.progress) / (RANKS.length - 1));
}

export const totalXP = (xp: Record<AttrKey, number>) => ATTR_KEYS.reduce((sum, k) => sum + (xp[k] || 0), 0);

/** XP acumulado necessário para chegar ao nível `level`. */
export const xpForLevel = (level: number) => Math.round(60 * Math.pow(Math.max(0, level - 1), 1.6));

export interface LevelInfo {
  level: number;
  /** XP dentro do nível atual e tamanho do nível. */
  into: number;
  span: number;
  progress: number;
}

export function levelOf(total: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= total) level++;
  const lo = xpForLevel(level);
  const span = xpForLevel(level + 1) - lo;
  return { level, into: total - lo, span, progress: (total - lo) / span };
}

/** Atributo dominante — define o título exibido no perfil. */
export function topAttr(xp: Record<AttrKey, number>): AttrKey | null {
  let best: AttrKey | null = null;
  for (const k of ATTR_KEYS) if ((xp[k] || 0) > 0 && (best === null || xp[k] > xp[best])) best = k;
  return best;
}

const TITLES: Record<AttrKey, string> = {
  int: 'Estudioso',
  ofi: 'Editor',
  inf: 'Negociador',
  eng: 'Construtor',
  for: 'Tesoureiro',
  vig: 'Disciplinado',
};

export function titleOf(xp: Record<AttrKey, number>): string {
  const top = topAttr(xp);
  if (!top) return 'Recém-chegado';
  return `${TITLES[top]} · rank ${rankOf(xp[top]).rank}`;
}

const dayXP = (p: Progress, iso: ISODate) => {
  const d = p.days[iso];
  if (!d) return 0;
  return ATTR_KEYS.reduce((s, k) => s + (d.xp[k] || 0), 0);
};

export const isActiveDay = (p: Progress, iso: ISODate) => dayXP(p, iso) > 0;

/** Dias seguidos com atividade. Hoje ainda vazio não quebra a sequência. */
export function streakOf(p: Progress, today: ISODate): number {
  let cursor = isActiveDay(p, today) ? today : addDays(today, -1);
  let n = 0;
  while (isActiveDay(p, cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** XP por dia nas últimas `weeks` semanas, alinhado em colunas de segunda a domingo. */
export function heatmap(p: Progress, today: ISODate, weeks: number): { iso: ISODate; xp: number; future: boolean }[][] {
  const start = addDays(startOfWeek(today), -7 * (weeks - 1));
  const cols: { iso: ISODate; xp: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const iso = addDays(start, w * 7 + d);
      col.push({ iso, xp: dayXP(p, iso), future: diffDays(today, iso) > 0 });
    }
    cols.push(col);
  }
  return cols;
}

export interface BuildRow {
  front: BuildFront;
  planned: number; // 0..1
  actual: number; // 0..1
  xp: number;
}

/**
 * Build da semana: fatia planejada de cada frente contra a fatia real de XP
 * conquistado desde segunda. Fortuna fica de fora — é resultado, não esforço.
 */
export function weekBuild(p: Progress, plan: Record<BuildFront, number>, today: ISODate): { rows: BuildRow[]; totalXP: number } {
  const start = startOfWeek(today);
  const xp: Record<BuildFront, number> = { faculdade: 0, estudio: 0, lab: 0, pessoal: 0 };
  for (let i = 0; i < 7; i++) {
    const d = p.days[addDays(start, i)];
    if (!d) continue;
    for (const k of ATTR_KEYS) {
      const front = ATTRS[k].front;
      if (front === 'cofre') continue;
      xp[front] += d.xp[k] || 0;
    }
  }
  const total = BUILD_FRONTS.reduce((s, f) => s + xp[f], 0);
  const planTotal = BUILD_FRONTS.reduce((s, f) => s + (plan[f] || 0), 0) || 1;
  return {
    totalXP: total,
    rows: BUILD_FRONTS.map((front) => ({
      front,
      planned: (plan[front] || 0) / planTotal,
      actual: total ? xp[front] / total : 0,
      xp: xp[front],
    })),
  };
}

export const emptyXP = (): Record<AttrKey, number> => ({ int: 0, ofi: 0, inf: 0, eng: 0, for: 0, vig: 0 });
