import { useEffect, useState } from 'react';
import { now, todayISO } from '../lib/dates';

/** Data de hoje, atualizada quando o dia vira com o app aberto. */
export function useToday() {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()));
    const t = setInterval(check, 30000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

/** Relógio que só bate enquanto `active` — usado pelo cronômetro de foco. */
export function useNow(active: boolean, interval = 1000) {
  const [t, setT] = useState(now);
  useEffect(() => {
    if (!active) return;
    setT(now());
    const id = setInterval(() => setT(now()), interval);
    return () => clearInterval(id);
  }, [active, interval]);
  return t;
}
