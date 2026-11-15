import { describe, expect, it } from 'vitest';
import { parseCapture } from '../src/lib/capture';
import { standing } from '../src/lib/academics';
import { levelOf, rankOf } from '../src/lib/xp';
import type { Course } from '../src/lib/types';

const today = '2026-11-15'; // domingo
const calc: Course = { id: 'c1', name: 'Cálculo II', passGrade: 6, maxAbsences: 7, absences: 0, slots: [] };

describe('captura', () => {
  it('missão com prazo', () => {
    const c = parseCapture('editar reels do cliente até sexta', [], today);
    expect(c).toMatchObject({ type: 'mission', front: 'estudio', due: '2026-11-20' });
  });
  it('avaliação', () => {
    expect(parseCapture('prova de cálculo dia 28', [calc], today)).toMatchObject({ type: 'assessment', courseId: 'c1', date: '2026-11-28' });
  });
  it('despesa e receita', () => {
    expect(parseCapture('gastei 32 no uber', [], today)).toMatchObject({ type: 'tx', kind: 'out', amount: 32, category: 'Transporte' });
    expect(parseCapture('recebi 400 do vídeo do canal', [], today)).toMatchObject({ type: 'tx', kind: 'in', amount: 400 });
  });
  it('lead e ideia', () => {
    expect(parseCapture('lead: loja de suplementos no instagram', [], today)).toMatchObject({ type: 'lead', channel: 'Instagram' });
    expect(parseCapture('ideia: gerador de thumbnails', [], today)).toMatchObject({ type: 'idea' });
  });
});

describe('faculdade e xp', () => {
  it('média necessária', () => {
    const st = standing(calc, [
      { id: 'a', courseId: 'c1', title: 'P1', kind: 'prova', weight: 4, grade: 3.5 },
      { id: 'b', courseId: 'c1', title: 'P2', kind: 'prova', weight: 6 },
    ]);
    expect(st.needed).toBeCloseTo(7.67, 1);
    expect(st.status).toBe('atencao');
  });
  it('níveis e ranks', () => {
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(60).level).toBe(2);
    expect(rankOf(400).rank).toBe('C');
  });
});
