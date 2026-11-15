import { lazy, Suspense, useEffect } from 'react';
import { CircleDot, Clapperboard, FlaskConical, GraduationCap, Plus, Settings, Sparkles, Wallet } from 'lucide-react';
import { useSync, type SyncState } from '../lib/persist';
import { useSlice } from '../lib/store';
import { closeCapture, closeCopilot, go, openCapture, openCopilot, useUI, type Route } from '../lib/ui';
import { levelOf, streakOf, titleOf, totalXP } from '../lib/xp';
import { useToday } from '../ui/hooks';
import { Logo, Ring, TipHost, Toasts } from '../ui/kit';
import { AcademyView } from './academy';
import { BuildView } from './build';
import { CaptureSheet } from './capture';
import { ProjectsView } from './projects';
import { SettingsView } from './settings';
import { StudioView } from './studio';
import { TodayView } from './today';
import { VaultView } from './vault';

const CopilotPanel = lazy(() => import('./copilot').then((m) => ({ default: m.CopilotPanel })));

const NAV: { route: Route; label: string; icon: typeof CircleDot }[] = [
  { route: 'hoje', label: 'Hoje', icon: CircleDot },
  { route: 'faculdade', label: 'Faculdade', icon: GraduationCap },
  { route: 'estudio', label: 'Estúdio', icon: Clapperboard },
  { route: 'projetos', label: 'Projetos', icon: FlaskConical },
  { route: 'cofre', label: 'Cofre', icon: Wallet },
];

const VIEWS: Record<Route, () => JSX.Element> = {
  hoje: TodayView,
  faculdade: AcademyView,
  estudio: StudioView,
  projetos: ProjectsView,
  cofre: VaultView,
  build: BuildView,
  ajustes: SettingsView,
};

export function syncLabel(s: SyncState): string {
  if (s.mode === 'cloud') {
    if (s.status === 'saving') return 'Salvando…';
    if (s.status === 'offline') return 'Sem conexão — salvo neste aparelho';
    if (s.status === 'full') return 'Limite de armazenamento atingido';
    if (s.status === 'connecting') return 'Conectando…';
    return 'Sincronizado na sua conta';
  }
  if (s.status === 'connecting') return 'Conectando…';
  if (s.status === 'readonly') return 'Sem permissão de escrita — salvo só aqui';
  return 'Salvo neste navegador';
}

export function Shell() {
  const ui = useUI();
  const profile = useSlice('profile');
  const progress = useSlice('progress');
  const sync = useSync();
  const today = useToday();
  const level = levelOf(totalXP(progress.xp));
  const streak = streakOf(progress, today);
  const View = VIEWS[ui.route];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        if (ui.capture.open) closeCapture();
        else openCapture();
      } else if (key === 'j') {
        e.preventDefault();
        if (ui.copilot.open) closeCopilot();
        else openCopilot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.capture.open, ui.copilot.open]);

  return (
    <>
      <aside className="side">
        <div className="brand">
          <Logo /> HEXA
        </div>
        <nav aria-label="Seções" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((n) => (
            <button key={n.route} className="nav-item" aria-current={ui.route === n.route ? 'page' : undefined} onClick={() => go(n.route)}>
              <n.icon size={18} strokeWidth={1.8} /> {n.label}
            </button>
          ))}
        </nav>
        <div className="side-sep" />
        <button className="nav-item" onClick={() => openCapture()}>
          <Plus size={18} strokeWidth={1.8} /> Capturar <kbd>Ctrl K</kbd>
        </button>
        <button className="nav-item" onClick={() => openCopilot()}>
          <Sparkles size={18} strokeWidth={1.8} /> Copiloto <kbd>Ctrl J</kbd>
        </button>
        <div className="side-gap" />
        <button className="me" aria-current={ui.route === 'build' ? 'page' : undefined} onClick={() => go('build')}>
          <Ring value={level.progress} size={38}>{level.level}</Ring>
          <span className="grow">
            <span className="me-name truncate" style={{ display: 'block' }}>{profile.name || 'Sua build'}</span>
            <span className="me-sub truncate" style={{ display: 'block' }}>
              {titleOf(progress.xp)}
              {streak > 1 ? ` · ${streak} dias` : ''}
            </span>
          </span>
        </button>
        <button className="nav-item" aria-current={ui.route === 'ajustes' ? 'page' : undefined} onClick={() => go('ajustes')}>
          <Settings size={18} strokeWidth={1.8} /> Ajustes
        </button>
        <span className="me-sub" style={{ padding: '4px 10px 0' }}>{syncLabel(sync)}</span>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="brand">
            <Logo size={20} /> HEXA
          </div>
          <span className="topbar-gap" />
          <button className="icon-btn" onClick={() => openCopilot()} aria-label="Abrir o Copiloto">
            <Sparkles size={19} />
          </button>
          <button className="icon-btn" onClick={() => openCapture()} aria-label="Capturar">
            <Plus size={21} />
          </button>
          <button onClick={() => go('build')} aria-label={`Sua build: nível ${level.level}`} style={{ borderRadius: '50%' }}>
            <Ring value={level.progress} size={34}>{level.level}</Ring>
          </button>
        </div>
        <View key={ui.route} />
      </main>

      <nav className="tabbar" aria-label="Seções">
        {NAV.map((n) => (
          <button key={n.route} className="tab" aria-current={ui.route === n.route ? 'page' : undefined} onClick={() => go(n.route)}>
            <n.icon size={21} strokeWidth={1.8} />
            {n.label}
          </button>
        ))}
      </nav>

      {ui.capture.open && <CaptureSheet preset={ui.capture.preset} />}
      {ui.copilot.open && (
        <Suspense fallback={null}>
          <CopilotPanel />
        </Suspense>
      )}
      <Toasts />
      <TipHost />
    </>
  );
}
