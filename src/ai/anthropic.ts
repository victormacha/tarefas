import Anthropic from '@anthropic-ai/sdk';
import { AIError, type AIConfig, type AIProvider } from './provider';

// Provedor do build independente: chama a API da Anthropic direto do navegador com a
// chave do próprio usuário. É aceitável aqui porque o Hexa é um app de uma pessoa só —
// a chave nunca sai do aparelho dela. Para um produto multiusuário, troque este arquivo
// por um proxy no servidor; o resto do app não muda.

export function anthropicProvider(config: AIConfig): AIProvider {
  const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });
  return {
    id: 'anthropic-api',
    label: `API da Anthropic · ${config.model}`,
    async complete(instructions, turns, opts = {}) {
      let partial = '';
      try {
        const stream = client.beta.messages.stream(
          {
            model: config.model,
            max_tokens: 16000,
            system: instructions,
            messages: turns,
            // Se o modelo pedido recusar por política, a API tenta o substituto padrão.
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          },
          { signal: opts.signal },
        );
        stream.on('text', (_delta, snapshot) => {
          partial = snapshot;
          opts.onText?.(snapshot);
        });
        const message = await stream.finalMessage();
        if (message.stop_reason === 'refusal') {
          throw new AIError('refused', 'O Claude recusou esse pedido. Reformule e tente outra vez.');
        }
        const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
        if (!text) throw new AIError('empty_completion', 'Não veio resposta. Tente pedir de outro jeito.');
        return text;
      } catch (e) {
        if (e instanceof AIError) throw e;
        if (e instanceof Anthropic.APIUserAbortError) throw new AIError('cancelled', 'Cancelado', partial);
        if (e instanceof Anthropic.AuthenticationError) {
          throw new AIError('auth', 'A chave da API foi recusada. Confira a chave nos Ajustes.');
        }
        if (e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError) {
          throw new AIError('model', 'Sua chave não tem acesso a esse modelo. Escolha outro nos Ajustes.');
        }
        if (e instanceof Anthropic.RateLimitError) {
          throw new AIError('rate_limited', 'Limite de uso atingido. Tente de novo em alguns minutos.', partial);
        }
        if (e instanceof Anthropic.APIConnectionError) {
          throw new AIError('upstream_error', 'Sem conexão com a API da Anthropic. Verifique sua internet.', partial);
        }
        if (e instanceof Anthropic.APIError) {
          throw new AIError('upstream_error', `A API respondeu com erro ${e.status ?? ''}. Tente de novo.`.replace('  ', ' '), partial);
        }
        throw new AIError('upstream_error', 'Algo falhou ao falar com a API. Tente de novo.', partial);
      }
    },
  };
}
