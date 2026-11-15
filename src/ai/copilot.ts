import { useSyncExternalStore } from 'react';
import { patchMessage, pushMessage } from '../lib/actions';
import { getState } from '../lib/store';
import type { ID } from '../lib/types';
import { localBriefing, localReview } from './local';
import { AIError, getProvider, resetProvider, type Turn } from './provider';
import { instructions, parseReply, visibleText } from './protocol';

// Orquestra uma pergunta ao Copiloto: monta o contexto, chama o provedor,
// transmite a resposta e guarda as ações propostas junto da mensagem.

export interface Preset {
  id: 'briefing' | 'review' | 'neglect' | 'plan';
  label: string;
  prompt: string;
  /** Tem versão por regras quando não há IA. */
  local?: boolean;
}

export const PRESETS: Preset[] = [
  {
    id: 'briefing',
    label: 'Briefing do dia',
    local: true,
    prompt: 'Faça meu briefing de hoje: por onde começo, o que vem depois e o que não pode passar de hoje. Considere prazos, clientes esperando e a build da semana.',
  },
  {
    id: 'review',
    label: 'Revisão da semana',
    local: true,
    prompt: 'Revise minha semana: para onde foi meu esforço em comparação com o plano, o que avançou, o que ficou parado, e o que eu deveria mudar na próxima semana. Se fizer sentido, proponha uma nova build.',
  },
  {
    id: 'neglect',
    label: 'O que estou negligenciando?',
    prompt: 'Olhando todos os meus dados, o que eu estou negligenciando e que vai me custar caro se continuar assim? Seja específico e proponha as missões que resolvem.',
  },
  {
    id: 'plan',
    label: 'Mais renda este mês',
    prompt: 'Com base no meu funil, nos trabalhos em andamento e na minha meta, qual é o caminho mais curto para aumentar minha receita este mês? Proponha ações concretas.',
  },
];

/** Resposta em andamento — fica fora do estado persistido para não gravar a cada token. */
interface Live {
  id: ID;
  text: string;
}
let live: Live | null = null;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();
const setLive = (next: Live | null) => {
  live = next;
  listeners.forEach((l) => l());
};
export const useLive = (): Live | null =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => live,
  );

export const isBusy = () => live !== null;
export const stop = () => controller?.abort();

function history(): Turn[] {
  const msgs = getState().copilot.messages.filter((m) => m.text.trim()).slice(-12);
  const firstUser = msgs.findIndex((m) => m.role === 'user');
  return msgs.slice(Math.max(0, firstUser)).map((m) => ({ role: m.role, content: m.text }));
}

const NO_AI =
  'Sem IA conectada, eu só consigo fazer análises por regras: o **Briefing do dia** e a **Revisão da semana**. ' +
  'Para conversar, quebrar objetivos e escrever propostas, conecte um modelo nos Ajustes.';

/** Envia uma pergunta. `shown` é o texto exibido no balão quando difere do prompt enviado. */
export async function ask(prompt: string, shown?: string, presetId?: Preset['id']): Promise<void> {
  if (live || !prompt.trim()) return;
  pushMessage({ role: 'user', text: shown ?? prompt });

  const provider = await getProvider().catch(() => null);
  if (!provider) {
    const state = getState();
    const text = presetId === 'briefing' ? localBriefing(state) : presetId === 'review' ? localReview(state) : NO_AI;
    pushMessage({ role: 'assistant', text, source: 'local' });
    return;
  }

  const turns = history();
  // O último turno precisa carregar o prompt completo, não o rótulo curto do atalho.
  if (shown && turns.length) turns[turns.length - 1] = { role: 'user', content: prompt };

  const id = pushMessage({ role: 'assistant', text: '', source: 'ai' });
  controller = new AbortController();
  setLive({ id, text: '' });
  try {
    const raw = await provider.complete(instructions(getState()), turns, {
      signal: controller.signal,
      onText: (text) => setLive({ id, text: visibleText(text) }),
    });
    const { text, actions } = parseReply(raw, getState());
    patchMessage(id, { text: text || 'Pronto — veja as ações abaixo.', actions: actions.length ? actions : undefined });
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError('upstream_error', 'Algo falhou. Tente de novo.');
    const partial = err.partial ? visibleText(err.partial) : '';
    if (err.code === 'cancelled') {
      patchMessage(id, { text: partial || 'Resposta interrompida.' });
    } else {
      patchMessage(id, { text: partial, error: err.message });
      // Permissão negada ou recurso indisponível: reavalia o provedor na próxima pergunta.
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'auth'].includes(err.code)) {
        resetProvider();
      }
    }
  } finally {
    controller = null;
    setLive(null);
  }
}

/** Prompts contextuais disparados a partir das telas. */
export const prompts = {
  breakdown: (projectId: ID, name: string) => ({
    shown: `Quebrar "${name}" em missões`,
    prompt: `Quebre o projeto "${name}" (id ${projectId}) em um plano executável: os marcos que ainda faltam até uma primeira versão que alguém possa usar ou pagar, e as 3 a 5 primeiras missões que eu consigo fazer nesta semana, na ordem certa. Proponha os marcos e as missões como ações, ligando as missões ao projeto.`,
  }),
  outreach: (leadId: ID, name: string, kind: 'abordagem' | 'follow-up' | 'proposta') => ({
    shown: `Escrever ${kind} para ${name}`,
    prompt:
      kind === 'proposta'
        ? `Escreva uma proposta de edição para o lead "${name}" (id ${leadId}), usando o que sei sobre ele e a minha tabela de serviços. Estrutura: o que entendi da necessidade, o que entrego, prazo, investimento e próximo passo. Pronta para copiar e enviar. Se faltar um dado essencial, marque com colchetes o que eu preciso preencher.`
        : kind === 'follow-up'
          ? `Escreva uma mensagem curta de follow-up para o lead "${name}" (id ${leadId}), considerando a etapa em que ele está e há quanto tempo não falamos. Dê duas versões: uma direta e uma que entrega algo de valor antes de pedir resposta. Depois, proponha a data do próximo follow-up como ação.`
          : `Escreva uma primeira mensagem de abordagem para o lead "${name}" (id ${leadId}), no canal em que ele está. Curta, específica para o nicho dele, com um motivo concreto para responder. Dê duas variações.`,
  }),
  goal: (text: string) => ({
    shown: `Transformar em plano: ${text}`,
    prompt: `Quero alcançar este objetivo: "${text}". Transforme em um plano executável para a minha realidade (veja minhas frentes, prazos e tempo disponível): crie um projeto com marcos e proponha as primeiras missões desta semana.`,
  }),
};
