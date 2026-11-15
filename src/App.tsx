import { useEffect, useState } from 'react';
import { housekeeping } from './lib/actions';
import { boot } from './lib/persist';
import { useSlice } from './lib/store';
import { Onboarding } from './features/onboarding';
import { Shell } from './features/shell';
import { Logo } from './ui/kit';

declare const __ARTIFACT__: boolean;

export function App() {
  const [ready, setReady] = useState(false);
  const profile = useSlice('profile');

  useEffect(() => {
    let alive = true;
    boot()
      .catch(() => undefined)
      .then(() => {
        if (!alive) return;
        housekeeping();
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // No Artifact o tema é do claude.ai; no build independente, o usuário escolhe nos Ajustes.
  useEffect(() => {
    if (__ARTIFACT__) return;
    const root = document.documentElement;
    if (profile.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', profile.theme);
  }, [profile.theme]);

  if (!ready) {
    return (
      <main className="center">
        <div className="splash" role="status">
          <Logo size={40} />
          Carregando sua build…
        </div>
      </main>
    );
  }
  return profile.onboarded ? <Shell /> : <Onboarding />;
}
