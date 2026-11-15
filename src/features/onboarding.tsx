import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { setProfile } from '../lib/actions';
import { now } from '../lib/dates';
import { BUILD_PRESETS, FRONT_KEYS, FRONTS } from '../lib/meta';
import { loadDemo } from '../lib/seed';
import { Field, Logo, frontStyle, parseNum } from '../ui/kit';

const FRONT_COPY: Record<string, string> = {
  faculdade: 'Disciplinas, provas, média necessária e faltas.',
  estudio: 'Leads, propostas, entregas e quanto vale a sua hora.',
  lab: 'Ideias, SaaS e experimentos com IA, do rascunho ao lançamento.',
  cofre: 'Receita contra a meta, despesas e o que falta receber.',
  pessoal: 'Rituais diários e o que mantém você inteiro.',
};

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [preset, setPreset] = useState(BUILD_PRESETS[0].id);
  const [demo, setDemo] = useState(false);

  const finish = () => {
    const build = BUILD_PRESETS.find((p) => p.id === preset)?.build ?? BUILD_PRESETS[0].build;
    setProfile({ name: name.trim(), incomeGoal: parseNum(goal) ?? 0, build, onboarded: true, createdAt: now() });
    if (demo) loadDemo();
  };

  return (
    <main className="center">
      <form
        className="onb"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 2) setStep(step + 1);
          else finish();
        }}
      >
        <div className="onb-steps" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="brand" style={{ padding: 0 }}>
              <Logo size={26} /> HEXA
            </div>
            <h1 className="display">Sua vida inteira em uma build.</h1>
            <p className="soft">
              Faculdade, edição, projetos e dinheiro no mesmo lugar. O Hexa cruza prazos, clientes e metas, diz por onde começar hoje e transforma
              o que você faz em progressão de verdade: seis atributos, do rank E ao S.
            </p>
            <Field label="Como devo te chamar?">
              <input id="onb-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="given-name" placeholder="Seu nome ou apelido" />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="display">Cinco frentes, um só plano.</h1>
            <div className="onb-fronts">
              {FRONT_KEYS.map((f) => (
                <div key={f}>
                  <b className="row-flex" style={{ gap: 8 }}>
                    <i className="dot" style={frontStyle(f)} />
                    {FRONTS[f].label}
                  </b>
                  <span className="soft">{FRONT_COPY[f]}</span>
                </div>
              ))}
            </div>
            <Field label="Como é a sua semana agora?" hint="É a sua build: quanto do seu foco vai para cada frente. Dá para mudar toda semana.">
              <select id="onb-build" className="select" value={preset} onChange={(e) => setPreset(e.target.value)}>
                {BUILD_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} — {p.hint.toLowerCase()}</option>
                ))}
              </select>
            </Field>
            <Field label="Meta de receita por mês (opcional)" hint="O Cofre mede o mês contra esse número.">
              <input id="onb-goal" className="input" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex.: 3000" />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="display">Como quer começar?</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" className="choice" aria-pressed={!demo} onClick={() => setDemo(false)}>
                <b>Do zero</b>
                <span>App vazio, pronto para os seus dados. Comece capturando o que está na cabeça.</span>
              </button>
              <button type="button" className="choice" aria-pressed={demo} onClick={() => setDemo(true)}>
                <b>Com dados de exemplo</b>
                <span>Disciplinas, clientes e lançamentos fictícios para ver tudo funcionando. Você remove com um toque.</span>
              </button>
            </div>
          </>
        )}

        <div className="row-flex">
          {step > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          )}
          <span className="grow" />
          <button type="submit" className="btn btn--primary">
            {step < 2 ? 'Continuar' : 'Entrar no Hexa'} <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </main>
  );
}
