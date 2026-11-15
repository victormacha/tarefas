# Hexa

Aplicativo pessoal: faculdade, estúdio de edição freelancer, projetos, finanças e progressão (seis atributos, ranks E→S) em um só lugar, com um motor que diz por onde começar e um Copiloto com IA.

## Rodar

```bash
npm install
npm run dev            # desenvolvimento
npm test               # testes da lógica
npm run build          # site estático (PWA) em dist/
npm run build:artifact # arquivo único em dist-artifact/hexa.html (Artifact do claude.ai)
```

## Arquitetura

- `src/lib` — dados e regras, sem interface: `engine` (sinais, ranking, linha do tempo), `capture` (captura em linguagem natural), `xp`, `academics`, `finance`, `actions` (toda alteração de estado), `persist` (localStorage + banco privado do Artifact).
- `src/ai` — Copiloto: `provider` (Claude da conta no Artifact, ou API da Anthropic com chave própria no build independente), `context`, `protocol` (ações propostas em JSON, aplicadas só com confirmação), `local` (análises por regras quando não há IA).
- `src/features` — telas. `src/ui` — componentes base. `src/styles/app.css` — sistema visual.

## Onde os dados ficam

- Como Artifact: documentos privados por usuário (`data/users/<id>/`), sincronizados entre aparelhos.
- Build independente: `localStorage` do navegador. Use Ajustes → Exportar backup.
