import { useSyncExternalStore } from 'react';
import type { AttrKey } from './types';

// Estado efêmero da interface (não é persistido): rota, avisos, painéis abertos.

export const ROUTES = ['hoje', 'faculdade', 'estudio', 'projetos', 'cofre', 'build', 'ajustes'] as const;
export type Route = (typeof ROUTES)[number];

const readRoute = (): Route => {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '');
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'hoje';
};

export interface Toast {
  id: number;
  text: string;
  tone: 'xp' | 'ok' | 'warn';
  attr?: AttrKey;
  xp?: number;
  undo?: () => void;
}

export interface UIState {
  route: Route;
  toasts: Toast[];
  copilot: { open: boolean; prompt?: string; nonce: number };
  capture: { open: boolean; preset?: string };
  levelUp: number | null;
}

let ui: UIState = {
  route: readRoute(),
  toasts: [],
  copilot: { open: false, nonce: 0 },
  capture: { open: false },
  levelUp: null,
};

const listeners = new Set<() => void>();
function set(patch: Partial<UIState>) {
  ui = { ...ui, ...patch };
  listeners.forEach((l) => l());
}

export const getUI = () => ui;
export const useUI = (): UIState =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ui,
  );

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const route = readRoute();
    if (route !== ui.route) {
      set({ route });
      window.scrollTo(0, 0);
    }
  });
}

export function go(route: Route) {
  if (typeof location !== 'undefined' && location.hash !== `#${route}`) location.hash = route;
  if (route !== ui.route) set({ route });
  if (typeof window !== 'undefined') window.scrollTo(0, 0);
}

let toastSeq = 0;
export function toast(t: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }) {
  const id = ++toastSeq;
  const item: Toast = { tone: 'ok', ...t, id };
  set({ toasts: [...ui.toasts.slice(-2), item] });
  setTimeout(() => dismissToast(id), t.undo ? 6000 : 3600);
}

export function dismissToast(id: number) {
  if (ui.toasts.some((t) => t.id === id)) set({ toasts: ui.toasts.filter((t) => t.id !== id) });
}

/** Abre o Copiloto; com `prompt`, a pergunta é enviada assim que o painel abre. */
export function openCopilot(prompt?: string) {
  set({ copilot: { open: true, prompt, nonce: ui.copilot.nonce + (prompt ? 1 : 0) } });
}
export const closeCopilot = () => set({ copilot: { ...ui.copilot, open: false, prompt: undefined } });
export const consumeCopilotPrompt = () => set({ copilot: { ...ui.copilot, prompt: undefined } });

export const openCapture = (preset?: string) => set({ capture: { open: true, preset } });
export const closeCapture = () => set({ capture: { open: false } });

export const showLevelUp = (level: number) => set({ levelUp: level });
export const clearLevelUp = () => set({ levelUp: null });
