import { useSyncExternalStore } from 'react';
import { now } from './dates';
import { emptyXP } from './xp';
import { SLICES, type AppState, type SliceKey } from './types';

// Estado em memória + assinaturas. A persistência (localStorage e nuvem) escuta
// as mudanças por `onChange` — o store não sabe onde os dados são guardados.

export const DEFAULT_ABOUT =
  'Estudante universitário e editor de vídeo freelancer em busca de clientes. ' +
  'Quero construir fontes de renda com IA, automação e SaaS. ' +
  'Gosto de programação, de jogos com progressão e builds, de animes e de RPG. ' +
  'Prefiro respostas práticas, objetivas e que economizem meu tempo.';

export function initialState(): AppState {
  return {
    profile: {
      name: '',
      onboarded: false,
      createdAt: 0,
      about: DEFAULT_ABOUT,
      incomeGoal: 0,
      hourGoal: 0,
      build: { faculdade: 3, estudio: 3, lab: 3, pessoal: 1 },
      theme: 'system',
      demo: false,
    },
    missions: { items: [], rituals: [] },
    academy: { courses: [], assessments: [] },
    studio: { leads: [], jobs: [], services: [] },
    vault: { txs: [], goals: [] },
    projects: { items: [] },
    progress: { xp: emptyXP(), days: {}, feed: [], unlocked: {}, sessions: [], focus: null },
    copilot: { messages: [] },
  };
}

let state: AppState = initialState();
/** Carimbo da última alteração de cada fatia (0 = nunca alterada neste aparelho). */
const stamps = Object.fromEntries(SLICES.map((k) => [k, 0])) as Record<SliceKey, number>;

const listeners = new Set<() => void>();
/** 'local' = edição neste aparelho · 'remote' = veio da nuvem · 'boot' = leitura inicial do cache. */
export type Origin = 'local' | 'remote' | 'boot';
type ChangeListener = (key: SliceKey, origin: Origin) => void;
const changeListeners = new Set<ChangeListener>();

const emit = () => listeners.forEach((l) => l());

export const getState = () => state;
export const getStamp = (key: SliceKey) => stamps[key];

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function onChange(listener: ChangeListener) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/** Altera uma fatia por mutação de um rascunho (clonado — o estado publicado nunca muda in-place). */
export function mutate<K extends SliceKey>(key: K, fn: (draft: AppState[K]) => void) {
  const draft = structuredClone(state[key]);
  fn(draft);
  state = { ...state, [key]: draft };
  stamps[key] = Math.max(now(), stamps[key] + 1);
  changeListeners.forEach((l) => l(key, 'local'));
  emit();
}

/** Substitui uma fatia inteira (carga inicial, sincronização ou importação). */
export function hydrate<K extends SliceKey>(key: K, value: AppState[K], stamp: number, origin: Origin) {
  state = { ...state, [key]: mergeDefaults(key, value) };
  stamps[key] = stamp;
  changeListeners.forEach((l) => l(key, origin));
  emit();
}

/** Garante que campos novos existam em dados gravados por versões antigas. */
function mergeDefaults<K extends SliceKey>(key: K, value: AppState[K]): AppState[K] {
  const base = initialState()[key];
  if (!value || typeof value !== 'object') return base;
  const merged = { ...base, ...value } as AppState[K];
  if (key === 'profile') {
    const p = merged as AppState['profile'];
    p.build = { ...(base as AppState['profile']).build, ...p.build };
  }
  if (key === 'progress') {
    const p = merged as AppState['progress'];
    p.xp = { ...emptyXP(), ...p.xp };
  }
  return merged;
}

export function resetState() {
  const fresh = initialState();
  for (const key of SLICES) {
    state = { ...state, [key]: fresh[key] };
    stamps[key] = now();
    changeListeners.forEach((l) => l(key, 'local'));
  }
  emit();
}

export const useApp = (): AppState => useSyncExternalStore(subscribe, getState);

export function useSlice<K extends SliceKey>(key: K): AppState[K] {
  return useSyncExternalStore(subscribe, () => state[key]);
}
