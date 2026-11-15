import { useEffect, useState } from 'react';

// Camada de IA do Hexa. O app nunca fala com um modelo diretamente: ele pede a um
// provedor. Há dois, escolhidos em tempo de execução:
//   • "claude-artifact": quando o Hexa roda como Artifact no claude.ai, usa o Claude
//     da própria conta de quem está vendo a página — sem chave, sem servidor.
//   • "anthropic-api": no build independente, usa a API da Anthropic com a chave que
//     o usuário cola nos Ajustes (fica só neste navegador).
// Sem nenhum dos dois, o Copiloto funciona em modo local (regras), e a interface diz isso.

declare const __ARTIFACT__: boolean;

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteOpts {
  onText?: (text: string) => void;
  signal?: AbortSignal;
}

export class AIError extends Error {
  code: string;
  /** Trecho da resposta que chegou antes da falha e pode ficar na tela. */
  partial?: string;
  constructor(code: string, message: string, partial?: string) {
    super(message);
    this.code = code;
    this.partial = partial;
  }
}

export interface AIProvider {
  id: 'claude-artifact' | 'anthropic-api';
  label: string;
  complete(instructions: string, turns: Turn[], opts?: CompleteOpts): Promise<string>;
}

// ---- configuração do provedor por chave (só no build independente) ----

export interface AIConfig {
  apiKey: string;
  model: string;
}

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — recomendado' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — mais rápido' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — mais barato' },
  { id: 'claude-fable-5-2', label: 'Claude Fable 5.2 — mais capaz' },
];

const CONFIG_KEY = 'hexa:ai';

export function loadAIConfig(): AIConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return { apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '', model: typeof raw.model === 'string' ? raw.model : MODELS[0].id };
  } catch {
    return { apiKey: '', model: MODELS[0].id };
  }
}

export function saveAIConfig(config: AIConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* sem armazenamento: a chave vale só até recarregar */
  }
  resetProvider();
}

// ---- Claude do Artifact ----

interface SampleFn {
  (
    input: Turn[],
    options: { cache: false; signal?: AbortSignal; onText?: (u: { text: string }) => void },
  ): Promise<{ text: string; truncated: boolean }>;
}

const SAMPLE_MESSAGES: Record<string, string> = {
  not_granted: 'O uso do Claude não foi liberado para esta página. Você pode liberar no menu de permissões do Artifact.',
  sampling_disabled: 'O Claude não está disponível para esta conta.',
  not_declared: 'Esta versão da página não declara acesso ao Claude.',
  capability_disabled: 'O Claude não está disponível nesta visualização.',
  capability_removed: 'O Claude não está disponível nesta visualização.',
  rate_limited: 'Limite de uso atingido. Tente de novo em alguns minutos.',
  session_expired: 'Sua sessão expirou. Entre de novo no claude.ai e recarregue.',
  refused: 'O Claude recusou esse pedido. Reformule e tente outra vez.',
  prompt_too_large: 'A conversa ficou longa demais. Limpe o histórico e tente de novo.',
  empty_completion: 'Não veio resposta. Tente pedir de outro jeito.',
  upstream_error: 'A conexão com o Claude falhou. Tente de novo.',
};

async function artifactProvider(): Promise<AIProvider | null> {
  const rt = (globalThis as { claude?: { use(name: string): Promise<unknown> } }).claude;
  if (!rt || typeof rt.use !== 'function') return null;
  const sample = (await rt.use('sample')) as SampleFn | null;
  if (!sample) return null;
  return {
    id: 'claude-artifact',
    label: 'Claude, pela sua conta',
    async complete(instructions, turns, opts = {}) {
      try {
        // Não existe papel "system" aqui: as instruções vão num primeiro turno do usuário.
        const res = await sample([{ role: 'user', content: instructions }, ...turns], {
          cache: false,
          signal: opts.signal,
          onText: opts.onText ? ({ text }) => opts.onText!(text) : undefined,
        });
        return res.text;
      } catch (e) {
        const err = e as { code?: string; text?: string };
        const code = err?.code ?? 'upstream_error';
        throw new AIError(code, SAMPLE_MESSAGES[code] ?? SAMPLE_MESSAGES.upstream_error, err?.text);
      }
    },
  };
}

// ---- seleção ----

let cached: Promise<AIProvider | null> | null = null;
const listeners = new Set<() => void>();

export function resetProvider() {
  cached = null;
  listeners.forEach((l) => l());
}

export function getProvider(): Promise<AIProvider | null> {
  cached ??= (async () => {
    const viaArtifact = await artifactProvider().catch(() => null);
    if (viaArtifact) return viaArtifact;
    if (__ARTIFACT__) return null; // dentro do Artifact a rede externa é bloqueada
    const config = loadAIConfig();
    if (!config.apiKey) return null;
    const { anthropicProvider } = await import('./anthropic');
    return anthropicProvider(config);
  })();
  return cached;
}

export type AIStatus = { state: 'checking' } | { state: 'ready'; provider: AIProvider } | { state: 'none' };

export function useAI(): AIStatus {
  const [status, setStatus] = useState<AIStatus>({ state: 'checking' });
  useEffect(() => {
    let alive = true;
    const load = () => {
      getProvider().then(
        (p) => alive && setStatus(p ? { state: 'ready', provider: p } : { state: 'none' }),
        () => alive && setStatus({ state: 'none' }),
      );
    };
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);
  return status;
}

/** No Artifact não há campo de chave: a IA vem da conta do Claude. */
export const canConfigureKey = () => !__ARTIFACT__;
