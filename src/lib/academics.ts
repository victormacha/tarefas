import type { Assessment, Course } from './types';

// Matemática da faculdade: média ponderada, nota necessária e limite de faltas.

export type CourseStatus = 'sem-notas' | 'aprovado' | 'no-caminho' | 'atencao' | 'critico' | 'reprovado';

export interface CourseStanding {
  status: CourseStatus;
  /** Média das avaliações já lançadas (ponderada). */
  average: number | null;
  /** Média necessária no que falta para fechar com a nota mínima. */
  needed: number | null;
  graded: number;
  pending: number;
  /** Fração do peso total já avaliada (0..1). */
  weightDone: number;
}

export function standing(course: Course, all: Assessment[]): CourseStanding {
  const list = all.filter((a) => a.courseId === course.id);
  const graded = list.filter((a) => typeof a.grade === 'number');
  const pending = list.filter((a) => typeof a.grade !== 'number');
  const w = (a: Assessment) => (a.weight > 0 ? a.weight : 1);
  const wGraded = graded.reduce((s, a) => s + w(a), 0);
  const wPending = pending.reduce((s, a) => s + w(a), 0);
  const wTotal = wGraded + wPending;
  const points = graded.reduce((s, a) => s + (a.grade as number) * w(a), 0);
  const average = wGraded ? points / wGraded : null;
  const base = { average, graded: graded.length, pending: pending.length, weightDone: wTotal ? wGraded / wTotal : 0 };

  if (!graded.length) return { ...base, status: 'sem-notas', needed: pending.length ? course.passGrade : null };

  if (!pending.length) {
    return { ...base, needed: null, status: (average as number) >= course.passGrade ? 'aprovado' : 'reprovado' };
  }

  const needed = (course.passGrade * wTotal - points) / wPending;
  let status: CourseStatus;
  if (needed <= 0) status = 'aprovado';
  else if (needed > 10) status = 'critico';
  else if (needed > course.passGrade + 1) status = 'atencao';
  else status = 'no-caminho';
  return { ...base, needed: Math.max(0, needed), status };
}

export type AbsenceLevel = 'ok' | 'perto' | 'limite' | 'estourou';

export function absenceLevel(course: Course): AbsenceLevel {
  if (course.maxAbsences <= 0) return 'ok';
  if (course.absences > course.maxAbsences) return 'estourou';
  if (course.absences === course.maxAbsences) return 'limite';
  if (course.absences >= Math.ceil(course.maxAbsences * 0.75)) return 'perto';
  return 'ok';
}

export const STATUS_LABEL: Record<CourseStatus, string> = {
  'sem-notas': 'Sem notas',
  aprovado: 'Aprovado',
  'no-caminho': 'No caminho',
  atencao: 'Atenção',
  critico: 'Crítico',
  reprovado: 'Abaixo da média',
};
