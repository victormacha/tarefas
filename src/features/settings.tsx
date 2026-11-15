import { useRef, useState } from 'react';
import { resetAll, setProfile } from '../lib/actions';
import { exportJSON, importJSON, useSync } from '../lib/persist';
import { clearDemo, loadDemo } from '../lib/seed';
import { useSlice } from '../lib/store';
import { toast } from '../lib/ui';
import { canConfigureKey, loadAIConfig, MODELS, saveAIConfig, useAI } from '../ai/provider';
import { ConfirmButton, Field, Segmented, parseNum } from '../ui/kit';
import { syncLabel } from './shell';

async function saveFile(filename: string, data: string) {
  const rt = (globalThis as { claude?: { use(n: string): Promise<unknown> } }).claude;
  const downloads = rt ? ((await rt.use('downloads')) as { save(r: { filename: string; data: string }): Promise<unknown> } | null) : null;
  if (downloads) {
    await downloads.save({ filename, data });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function SettingsView() {
  const profile = useSlice('profile');
  const sync = useSync();
  const ai = useAI();
  const file = useRef<HTMLInputElement>(null);
  const [cfg, setCfg] = useState(loadAIConfig);

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <header className="page-head">
        <div>
          <span className="label">Hexa</span>
          <h1 className="display">Ajustes</h1>
        </div>
      </header>

      <section className="section">
        <h2 className="label">Perfil</h2>
        <Field label="Nome">
          <input id="set-name" className="input" defaultValue={profile.name} onBlur={(e) => setProfile({ name: e.target.value.trim() })} />
        </Field>
        <Field label="Meta de receita por mês (R$)">
          <input id="set-goal" className="input" inputMode="decimal" defaultValue={profile.incomeGoal || ''} onBlur={(e) => setProfile({ incomeGoal: parseNum(e.target.value) ?? 0 })} />
        </Field>
        <Field label="Sobre você" hint="O Copiloto lê este texto em toda conversa. Edite para refletir quem você é e o que quer.">
          <textarea id="set-about" className="textarea" defaultValue={profile.about} onBlur={(e) => setProfile({ about: e.target.value })} />
        </Field>
        {canConfigureKey() && (
          <Field label="Tema">
            <Segmented
              label="Tema"
              value={profile.theme}
              onChange={(theme) => setProfile({ theme })}
              options={[
                { value: 'system', label: 'Sistema' },
                { value: 'dark', label: 'Escuro' },
                { value: 'light', label: 'Claro' },
              ]}
            />
          </Field>
        )}
      </section>

      <section className="section">
        <h2 className="label">Copiloto</h2>
        <p className="small soft">
          {ai.state === 'ready' ? `Conectado: ${ai.provider.label}.` : ai.state === 'checking' ? 'Verificando…' : 'Sem IA conectada: o Copiloto roda em modo local, por regras.'}
          {!canConfigureKey() && ' Aqui o Copiloto usa o Claude da sua própria conta; a primeira pergunta pede a sua permissão.'}
        </p>
        {canConfigureKey() && (
          <>
            <Field label="Chave da API da Anthropic" hint="Fica guardada só neste navegador e não entra no backup.">
              <input id="set-key" className="input" type="password" autoComplete="off" value={cfg.apiKey} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value.trim() })} placeholder="sk-ant-…" />
            </Field>
            <Field label="Modelo">
              <select id="set-model" className="select" value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })}>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </Field>
            <button
              className="btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                saveAIConfig(cfg);
                toast({ text: cfg.apiKey ? 'Chave salva' : 'Chave removida' });
              }}
            >
              Salvar
            </button>
          </>
        )}
      </section>

      <section className="section">
        <h2 className="label">Dados</h2>
        <p className="small soft">{syncLabel(sync)}.</p>
        <div className="row-flex wrap">
          <button
            className="btn"
            onClick={() => saveFile('hexa-backup.json', exportJSON()).then(() => toast({ text: 'Backup exportado' }), () => toast({ text: 'Exportação cancelada' }))}
          >
            Exportar backup
          </button>
          <button className="btn" onClick={() => file.current?.click()}>Importar backup</button>
          <input
            id="set-import"
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const res = importJSON(await f.text());
              toast({ text: res.ok ? 'Backup importado' : res.error });
            }}
          />
          {profile.demo ? (
            <button className="btn" onClick={clearDemo}>Remover dados de exemplo</button>
          ) : (
            <button className="btn" onClick={loadDemo}>Carregar dados de exemplo</button>
          )}
        </div>
        <div>
          <ConfirmButton label="Apagar tudo" confirm="Confirmar: apagar todos os dados" onConfirm={resetAll} />
        </div>
      </section>
    </div>
  );
}
