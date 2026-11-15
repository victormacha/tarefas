import type { ISODate } from './types';

// Relógio substituível: os testes fixam "agora" para que a lógica de prazos seja determinística.
let clock: () => number = () => Date.now();
export const now = () => clock();
export function setClock(fn: (() => number) | null) {
  clock = fn ?? (() => Date.now());
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Meia-noite local do dia informado. */
export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const todayISO = (): ISODate => toISO(new Date(now()));

export function addDays(iso: ISODate, n: number): ISODate {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Quantos dias de `a` até `b` (positivo se `b` é depois). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

export const weekdayOf = (iso: ISODate) => fromISO(iso).getDay();

/** Segunda-feira da semana do dia informado. */
export function startOfWeek(iso: ISODate): ISODate {
  const wd = weekdayOf(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

export const ymOf = (iso: ISODate) => iso.slice(0, 7);

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export const isISODate = (s: unknown): s is ISODate =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISO(s).getTime());

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "15 nov" */
export function fmtDay(iso: ISODate): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "sábado, 15 de novembro" */
export function fmtLong(iso: ISODate): string {
  const d = fromISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** "novembro de 2026" */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias", "sex", "28 nov" */
export function relDay(iso: ISODate, today: ISODate = todayISO()): string {
  const n = diffDays(today, iso);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n < 0) return `há ${-n} dias`;
  if (n < 7) return WEEKDAYS_SHORT[weekdayOf(iso)];
  return fmtDay(iso);
}

/** "em 3 dias" / "há 2 dias" / "hoje" — sempre relativo, para frases. */
export function inDays(iso: ISODate, today: ISODate = todayISO()): string {
  const n = diffDays(today, iso);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function fmtMoney(n: number, cents = false): string {
  return (cents && !Number.isInteger(n) ? moneyCents : money).format(n).replace(/ /g, ' ');
}

/** 7.5 -> "7,5" */
export function fmtGrade(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** 95 -> "1h 35" · 40 -> "40 min" */
export function fmtMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${pad(r)}` : `${h}h`;
}

/** Cronômetro "00:24:13" a partir de milissegundos. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function greeting(): string {
  const h = new Date(now()).getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

let seq = 0;
export function uid(prefix = ''): string {
  seq = (seq + 1) % 1296;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${now().toString(36)}${seq.toString(36)}${rand}`;
}
