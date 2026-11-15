import { useSyncExternalStore } from 'react';
import { now } from './dates';
import { getStamp, getState, hydrate, onChange } from './store';
import { SLICES, type AppState, type SliceKey } from './types';

// Persistência em duas camadas:
// 1. localStorage — cache imediato, sempre ligado.
// 2. Banco privado do Artifact (claude.ai) — quando o app roda como Artifact, cada
//    fatia do estado vira um documento em data/users/<id>/, visível só para o dono.
//    Conflitos entre aparelhos se resolvem por fatia: vence a alteração mais recente.

const LS = 'hexa:v1:';
const MAX_DOC_BYTES = 240 * 1024;

interface Stored {
  t: number;
  data: unknown;
}

function lsGet(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(LS + key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.t === 'number' && v.data && typeof v.data === 'object' ? v : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: Stored) {
  try {
    localStorage.setItem(LS + key, JSON.stringify(value));
  } catch {
    /* armazenamento cheio ou bloqueado: o app continua funcionando em memória */
  }
}

export type SyncStatus = 'idle' | 'connecting' | 'saving' | 'synced' | 'offline' | 'readonly' | 'full';

export interface SyncState {
  /** 'cloud' quando o banco privado do Artifact está respondendo. */
  mode: 'local' | 'cloud';
  status: SyncStatus;
  at?: number;
}

let sync: SyncState = { mode: 'local', status: 'idle' };
const syncListeners = new Set<() => void>();
function setSync(patch: Partial<SyncState>) {
  sync = { ...sync, ...patch };
  syncListeners.forEach((l) => l());
}
export const useSync = (): SyncState =>
  useSyncExternalStore(
    (l) => {
      syncListeners.add(l);
      return () => syncListeners.delete(l);
    },
    () => sync,
  );

// ---- cache local ----

const localDirty = new Set<SliceKey>();
let localTimer: ReturnType<typeof setTimeout> | undefined;

function flushLocal() {
  clearTimeout(localTimer);
  for (const key of localDirty) lsSet(key, { t: getStamp(key), data: getState()[key] });
  localDirty.clear();
}

// ---- nuvem (Artifact) ----

interface DbError {
  code?: string;
}
interface DocRef {
  set(data: Record<string, unknown>): Promise<void>;
}
interface Snap {
  docs: { id: string; data(): Record<string, unknown> | undefined; metadata: { hasPendingWrites: boolean } }[];
  metadata: { fromCache: boolean };
}
interface Collection {
  doc(id: string): DocRef;
  onSnapshot(next: (snap: Snap) => void, error?: (e: DbError) => void): () => void;
}

let col: Collection | null = null;
const cloudDirty = new Set<SliceKey>();
const inflight = new Set<SliceKey>();
const retries = new Map<SliceKey, number>();
let cloudTimer: ReturnType<typeof setTimeout> | undefined;

function settle() {
  if (!col) return;
  if (!cloudDirty.size && !inflight.size) setSync({ status: 'synced', at: now() });
}

function flushCloud() {
  clearTimeout(cloudTimer);
  if (!col) return;
  for (const key of [...cloudDirty]) {
    if (inflight.has(key)) continue; // uma escrita por documento de cada vez
    const body = { t: getStamp(key), data: JSON.parse(JSON.stringify(getState()[key])) };
    if (JSON.stringify(body).length > MAX_DOC_BYTES) {
      cloudDirty.delete(key);
      setSync({ status: 'full' });
      continue;
    }
    cloudDirty.delete(key);
    inflight.add(key);
    col.doc(key).set(body).then(
      () => {
        inflight.delete(key);
        retries.delete(key);
        if (cloudDirty.has(key)) flushCloud();
        settle();
      },
      (e: DbError) => {
        inflight.delete(key);
        const code = e?.code ?? 'unavailable';
        if (code === 'quota_exceeded') return setSync({ status: 'full' });
        if (code === 'unavailable' || code === 'resource_exhausted') {
          const n = (retries.get(key) ?? 0) + 1;
          retries.set(key, n);
          cloudDirty.add(key);
          if (n <= 3) cloudTimer = setTimeout(flushCloud, 3000 * n + Math.random() * 1500);
          else setSync({ status: 'offline' });
          return;
        }
        // invalid_argument (sem permissão de escrita), revoked etc.: segue só neste navegador.
        col = null;
        cloudDirty.clear();
        setSync({ mode: 'local', status: 'readonly' });
      },
    );
  }
}

function scheduleCloud() {
  if (!col) return;
  setSync({ status: 'saving' });
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(flushCloud, 1200);
}

interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}
const runtime = (): ClaudeRuntime | null => {
  const c = (globalThis as { claude?: ClaudeRuntime }).claude;
  return c && typeof c.use === 'function' ? c : null;
};

/** Verdadeiro quando o app está rodando dentro do visualizador de Artifacts. */
export const cloudCapable = () => runtime() !== null;

function attachCloud(): Promise<void> {
  return new Promise((resolve) => {
    const rt = runtime();
    if (!rt) return resolve();
    setSync({ status: 'connecting' });
    (async () => {
      const [db, user] = (await Promise.all([rt.use('db'), rt.use('user')])) as [
        { collection(path: string): Collection } | null,
        { id(): Promise<string | null> } | null,
      ];
      const uid = db && user ? await user.id() : null;
      if (!db || !uid) {
        setSync({ mode: 'local', status: 'idle' });
        return resolve();
      }
      col = db.collection(`data/users/${uid}`);
      setSync({ mode: 'cloud' });
      let pushedLocal = false;
      const slow = setTimeout(() => {
        setSync({ status: 'offline' });
        resolve();
      }, 10000);

      col.onSnapshot(
        (snap) => {
          const remote = new Map<string, number>();
          for (const doc of snap.docs) {
            const body = doc.data();
            const key = doc.id as SliceKey;
            if (!body || !SLICES.includes(key)) continue;
            const t = Number(body.t) || 0;
            remote.set(key, t);
            if (doc.metadata.hasPendingWrites || !body.data || typeof body.data !== 'object') continue;
            if (t > getStamp(key)) {
              hydrate(key, JSON.parse(JSON.stringify(body.data)) as AppState[typeof key], t, 'remote');
            }
          }
          // Na primeira resposta definitiva, sobe o que este aparelho tem de mais novo.
          if (!snap.metadata.fromCache && !pushedLocal) {
            pushedLocal = true;
            for (const key of SLICES) {
              if (getStamp(key) > (remote.get(key) ?? 0)) cloudDirty.add(key);
            }
            if (cloudDirty.size) flushCloud();
          }
          if (!snap.metadata.fromCache) {
            clearTimeout(slow);
            settle();
          }
          resolve();
        },
        (e) => {
          clearTimeout(slow);
          col = null;
          setSync({ mode: 'local', status: e?.code === 'revoked' ? 'readonly' : 'offline' });
          resolve();
        },
      );
    })().catch(() => {
      setSync({ mode: 'local', status: 'idle' });
      resolve();
    });
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Carrega o cache local e conecta à nuvem quando disponível. Resolve quando o
 * app pode renderizar: na hora se já há dados locais; senão espera a nuvem por
 * até 6 s para não mostrar o onboarding a quem já tem conta em outro aparelho.
 */
let booted: Promise<void> | null = null;
/** Idempotente: o StrictMode do React chama os efeitos duas vezes em desenvolvimento. */
export function boot(): Promise<void> {
  return (booted ??= doBoot());
}

async function doBoot(): Promise<void> {
  for (const key of SLICES) {
    const stored = lsGet(key);
    if (stored) hydrate(key, stored.data as AppState[typeof key], stored.t, 'boot');
  }

  onChange((key, origin) => {
    if (origin === 'boot') return;
    localDirty.add(key);
    clearTimeout(localTimer);
    localTimer = setTimeout(flushLocal, 250);
    if (origin === 'local' && col) {
      cloudDirty.add(key);
      scheduleCloud();
    }
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        flushLocal();
        flushCloud();
      }
    });
  }

  if (!cloudCapable()) return;
  const attached = attachCloud();
  if (getState().profile.onboarded) return;
  await Promise.race([attached, sleep(6000)]);
}

// ---- backup ----

export function exportJSON(): string {
  const slices: Record<string, Stored> = {};
  for (const key of SLICES) slices[key] = { t: getStamp(key), data: getState()[key] };
  return JSON.stringify({ app: 'hexa', version: 1, exportedAt: new Date(now()).toISOString(), slices }, null, 1);
}

export function importJSON(text: string): { ok: true } | { ok: false; error: string } {
  let parsed: { app?: string; slices?: Record<string, Stored> };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  if (parsed?.app !== 'hexa' || !parsed.slices || typeof parsed.slices !== 'object') {
    return { ok: false, error: 'Este arquivo não é um backup do Hexa.' };
  }
  let count = 0;
  for (const key of SLICES) {
    const slice = parsed.slices[key];
    if (!slice || !slice.data || typeof slice.data !== 'object') continue;
    hydrate(key, slice.data as AppState[typeof key], now(), 'local');
    count++;
  }
  return count ? { ok: true } : { ok: false, error: 'O backup está vazio.' };
}
