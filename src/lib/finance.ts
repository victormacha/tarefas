import { addMonths, daysInMonth, ymOf } from './dates';
import type { ISODate, Job, Tx } from './types';

export interface Bucket {
  name: string;
  amount: number;
}

export interface MonthSummary {
  ym: string;
  income: number;
  expense: number;
  balance: number;
  sources: Bucket[];
  categories: Bucket[];
  txs: Tx[];
}

function buckets(txs: Tx[]): Bucket[] {
  const map = new Map<string, number>();
  for (const t of txs) map.set(t.category, (map.get(t.category) || 0) + t.amount);
  return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

export function monthSummary(txs: Tx[], ym: string): MonthSummary {
  const month = txs.filter((t) => ymOf(t.date) === ym);
  const ins = month.filter((t) => t.kind === 'in');
  const outs = month.filter((t) => t.kind === 'out');
  const income = ins.reduce((s, t) => s + t.amount, 0);
  const expense = outs.reduce((s, t) => s + t.amount, 0);
  return {
    ym,
    income,
    expense,
    balance: income - expense,
    sources: buckets(ins),
    categories: buckets(outs),
    txs: [...month].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
  };
}

/** Últimos `n` meses terminando em `ym`, do mais antigo para o mais recente. */
export function monthSeries(txs: Tx[], ym: string, n: number): { ym: string; income: number; expense: number }[] {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addMonths(ym, -i);
    const s = monthSummary(txs, key);
    out.push({ ym: key, income: s.income, expense: s.expense });
  }
  return out;
}

export interface Receivables {
  /** Entregue e ainda não pago. */
  due: number;
  /** Em produção (briefing → revisão). */
  inProgress: number;
  dueJobs: Job[];
}

export function receivables(jobs: Job[]): Receivables {
  const dueJobs = jobs.filter((j) => j.stage === 'entregue');
  const wip = jobs.filter((j) => j.stage === 'briefing' || j.stage === 'edicao' || j.stage === 'revisao');
  return {
    due: dueJobs.reduce((s, j) => s + j.price, 0),
    inProgress: wip.reduce((s, j) => s + j.price, 0),
    dueJobs,
  };
}

/** Quanto do mês já passou (0..1) — usado para dizer se a receita está no ritmo. */
export function monthProgress(today: ISODate): number {
  const day = Number(today.slice(8, 10));
  return day / daysInMonth(ymOf(today));
}

/** Valor/hora real: só trabalhos pagos que tiveram tempo de foco registrado. */
export function hourlyRate(jobs: Job[]): { rate: number; hours: number; jobs: number } | null {
  const paid = jobs.filter((j) => j.stage === 'pago' && j.minutes >= 10);
  if (!paid.length) return null;
  const minutes = paid.reduce((s, j) => s + j.minutes, 0);
  const total = paid.reduce((s, j) => s + j.price, 0);
  return { rate: total / (minutes / 60), hours: minutes / 60, jobs: paid.length };
}
