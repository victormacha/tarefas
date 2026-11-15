import { useMemo, useState } from 'react';
import { AlertTriangle, Check, CircleAlert, Minus, Plus, Trash2 } from 'lucide-react';
import {
  addAssessment, addCourse, bumpAbsence, deleteAssessment, deleteCourse, setGrade, updateAssessment, updateCourse,
} from '../lib/actions';
import { absenceLevel, standing, STATUS_LABEL, type CourseStanding, type CourseStatus } from '../lib/academics';
import { diffDays, fmtDay, fmtGrade, inDays, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/dates';
import { ASSESSMENT_KINDS } from '../lib/meta';
import { useSlice } from '../lib/store';
import type { Assessment, AssessmentKind, Course, ID } from '../lib/types';
import { useToday } from '../ui/hooks';
import { ConfirmButton, Empty, Field, Meter, Sheet, parseNum } from '../ui/kit';

const STATUS_TONE: Record<CourseStatus, string> = {
  'sem-notas': '',
  aprovado: ' pill--good',
  'no-caminho': '',
  atencao: ' pill--warn',
  critico: ' pill--crit',
  reprovado: ' pill--crit',
};

function StatusPill({ status }: { status: CourseStatus }) {
  const Icon = status === 'aprovado' ? Check : status === 'atencao' ? CircleAlert : status === 'critico' || status === 'reprovado' ? AlertTriangle : null;
  return (
    <span className={`pill${STATUS_TONE[status]}`}>
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function standingLine(st: CourseStanding, pass: number): string {
  if (st.status === 'sem-notas') return st.pending ? `Nenhuma nota ainda · mínimo ${fmtGrade(pass)}` : 'Cadastre as avaliações para acompanhar a média';
  const avg = `Média ${fmtGrade(st.average ?? 0)}`;
  if (st.status === 'aprovado') return st.pending ? `${avg} · já garante a aprovação` : `${avg} · fechada`;
  if (st.status === 'reprovado') return `${avg} · abaixo de ${fmtGrade(pass)}`;
  if (st.status === 'critico') return `${avg} · precisaria de ${fmtGrade(st.needed ?? 0)} no que falta`;
  return `${avg} · precisa de ${fmtGrade(st.needed ?? 0)} no que falta`;
}

const kindLabel = (k: AssessmentKind) => ASSESSMENT_KINDS.find((x) => x.key === k)?.label ?? k;

export function AcademyView() {
  const { courses, assessments } = useSlice('academy');
  const today = useToday();
  const [open, setOpen] = useState<ID | null>(null);
  const [creating, setCreating] = useState(false);
  const active = courses.filter((c) => !c.archived);

  const upcoming = useMemo(
    () =>
      assessments
        .filter((a) => typeof a.grade !== 'number' && a.date && a.date >= today)
        .sort((a, b) => (a.date! < b.date! ? -1 : 1))
        .slice(0, 6),
    [assessments, today],
  );
  const course = (id: ID) => courses.find((c) => c.id === id);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="label">Intelecto</span>
          <h1 className="display">Faculdade</h1>
        </div>
        <div className="head-actions">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Disciplina
          </button>
        </div>
      </header>

      {!active.length ? (
        <Empty
          title="Nenhuma disciplina cadastrada"
          action={
            <button className="btn btn--primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Cadastrar a primeira
            </button>
          }
        >
          Cadastre as disciplinas do semestre com as avaliações e os pesos. O Hexa calcula a média, quanto você precisa tirar no que falta e avisa
          quando as faltas chegarem perto do limite.
        </Empty>
      ) : (
        <div className="cols">
          <section className="section">
            <div className="section-head">
              <h2 className="label">Disciplinas</h2>
            </div>
            <div className="list">
              {active.map((c) => {
                const st = standing(c, assessments);
                const abs = absenceLevel(c);
                return (
                  <button key={c.id} className="row" onClick={() => setOpen(c.id)}>
                    <span className="row-main">
                      <span className="row-title">{c.name}</span>
                      <span className="row-meta">{standingLine(st, c.passGrade)}</span>
                    </span>
                    <span className="row-end" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <StatusPill status={st.status} />
                      <span className={`small ${abs === 'ok' ? 'muted' : ''}`} style={abs !== 'ok' ? { color: abs === 'perto' ? 'var(--warn-ink)' : 'var(--crit-ink)' } : undefined}>
                        {c.absences}/{c.maxAbsences} faltas
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="label">Próximas avaliações</h2>
            </div>
            {!upcoming.length ? (
              <p className="small muted">Nenhuma avaliação com data pela frente. Abra uma disciplina para adicionar provas e trabalhos.</p>
            ) : (
              <div className="list">
                {upcoming.map((a) => {
                  const d = diffDays(today, a.date!);
                  return (
                    <button key={a.id} className="row" onClick={() => setOpen(a.courseId)}>
                      <span className="mono soft nowrap" style={{ width: 52 }}>{fmtDay(a.date!)}</span>
                      <span className="row-main">
                        <span className="row-title">{a.title}</span>
                        <span className="row-meta">{course(a.courseId)?.name} · {kindLabel(a.kind)} · peso {a.weight}</span>
                      </span>
                      <span className={`pill${d <= 2 ? ' pill--crit' : d <= 7 ? ' pill--warn' : ''}`}>{inDays(a.date!, today)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {creating && <NewCourseSheet onClose={() => setCreating(false)} onCreated={setOpen} />}
      {open && course(open) && <CourseSheet course={course(open)!} assessments={assessments.filter((a) => a.courseId === open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

function NewCourseSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: ID) => void }) {
  const [name, setName] = useState('');
  const [professor, setProfessor] = useState('');
  const [pass, setPass] = useState('6');
  const [max, setMax] = useState('7');
  const save = () => {
    if (!name.trim()) return;
    const id = addCourse({ name, professor: professor.trim() || undefined, passGrade: parseNum(pass) ?? 6, maxAbsences: Math.round(parseNum(max) ?? 7) });
    onClose();
    onCreated(id);
  };
  return (
    <Sheet title="Nova disciplina" onClose={onClose}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nome">
          <input id="course-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex.: Cálculo II" />
        </Field>
        <Field label="Professor(a)">
          <input id="course-prof" className="input" value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="Opcional" />
        </Field>
        <div className="form-row">
          <Field label="Nota mínima">
            <input id="course-pass" className="input" inputMode="decimal" value={pass} onChange={(e) => setPass(e.target.value)} />
          </Field>
          <Field label="Limite de faltas" hint="Em geral 25% das aulas">
            <input id="course-max" className="input" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
          </Field>
        </div>
        <div className="sheet-foot">
          <button className="btn btn--primary" type="submit" disabled={!name.trim()}>Criar e adicionar avaliações</button>
        </div>
      </form>
    </Sheet>
  );
}

function GradeInput({ a }: { a: Assessment }) {
  const [text, setText] = useState(typeof a.grade === 'number' ? fmtGrade(a.grade) : '');
  const commit = () => {
    const n = parseNum(text);
    const next = n === undefined ? undefined : Math.max(0, Math.min(10, n));
    if (next !== a.grade) setGrade(a.id, next);
    setText(next === undefined ? '' : fmtGrade(next));
  };
  return (
    <input
      id={`grade-${a.id}`}
      className="input"
      style={{ width: 66, height: 34, textAlign: 'center', padding: '0 6px' }}
      inputMode="decimal"
      placeholder="nota"
      aria-label={`Nota de ${a.title}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function CourseSheet({ course, assessments, onClose }: { course: Course; assessments: Assessment[]; onClose: () => void }) {
  const st = standing(course, assessments);
  const abs = absenceLevel(course);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<AssessmentKind>('prova');
  const [date, setDate] = useState('');
  const [weight, setWeight] = useState('1');
  const [weekday, setWeekday] = useState('1');
  const [start, setStart] = useState('19:00');

  const sorted = [...assessments].sort((a, b) => (a.date ?? '9999') .localeCompare(b.date ?? '9999'));
  const add = () => {
    if (!title.trim()) return;
    addAssessment({ courseId: course.id, title, kind, date: date || undefined, weight: parseNum(weight) ?? 1 });
    setTitle('');
    setDate('');
  };
  const absColor = abs === 'ok' ? 'var(--fg-2)' : abs === 'perto' ? 'var(--warn)' : 'var(--crit)';

  return (
    <Sheet title={course.name} onClose={onClose}>
      <div className="sheet-body">
        <div className="row-flex wrap">
          <StatusPill status={st.status} />
          <span className="small soft">{standingLine(st, course.passGrade)}</span>
        </div>

        <section className="section">
          <h3 className="label">Avaliações</h3>
          {!sorted.length && <p className="small muted">Adicione as provas e trabalhos com os pesos do plano de ensino.</p>}
          <div className="list">
            {sorted.map((a) => (
              <div key={a.id} className="row">
                <span className="row-main">
                  <span className="row-title">{a.title}</span>
                  <span className="row-meta">
                    {kindLabel(a.kind)}
                    {a.date ? ` · ${fmtDay(a.date)}` : ''} · peso
                    <input
                      id={`weight-${a.id}`}
                      aria-label={`Peso de ${a.title}`}
                      className="input"
                      style={{ width: 44, height: 24, padding: '0 4px', fontSize: 12.5, textAlign: 'center' }}
                      inputMode="decimal"
                      defaultValue={String(a.weight)}
                      onBlur={(e) => {
                        const n = parseNum(e.target.value);
                        if (n && n > 0 && n !== a.weight) updateAssessment(a.id, { weight: n });
                      }}
                    />
                  </span>
                </span>
                <GradeInput a={a} />
                <button className="icon-btn icon-btn--sm" aria-label={`Excluir ${a.title}`} onClick={() => deleteAssessment(a.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <div className="form-row">
              <Field label="Nova avaliação">
                <input id="assess-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: P2" />
              </Field>
              <Field label="Tipo">
                <select id="assess-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
                  {ASSESSMENT_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>{k.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Data">
                <input id="assess-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Peso">
                <input id="assess-weight" className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </Field>
            </div>
            <button className="btn" type="submit" disabled={!title.trim()} style={{ alignSelf: 'flex-start' }}>
              <Plus size={15} /> Adicionar avaliação
            </button>
          </form>
        </section>

        <section className="section">
          <h3 className="label">Faltas</h3>
          <div className="row-flex">
            <div className="stepper">
              <button className="icon-btn" onClick={() => bumpAbsence(course.id, -1)} aria-label="Remover uma falta" disabled={course.absences === 0}>
                <Minus size={16} />
              </button>
              <b style={{ fontSize: 18, minWidth: 30 }}>{course.absences}</b>
              <button className="icon-btn" onClick={() => bumpAbsence(course.id, 1)} aria-label="Registrar uma falta">
                <Plus size={16} />
              </button>
            </div>
            <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Meter value={course.maxAbsences ? course.absences / course.maxAbsences : 0} color={absColor} label="Faltas usadas" />
              <span className="small muted">
                {abs === 'estourou'
                  ? `Limite de ${course.maxAbsences} estourado`
                  : abs === 'limite'
                    ? 'No limite: a próxima falta reprova'
                    : `Você ainda pode faltar ${course.maxAbsences - course.absences} ${course.maxAbsences - course.absences === 1 ? 'vez' : 'vezes'}`}
              </span>
            </div>
          </div>
        </section>

        <section className="section">
          <h3 className="label">Horário das aulas</h3>
          <div className="row-flex wrap" style={{ gap: 6 }}>
            {course.slots.map((s, i) => (
              <button
                key={`${s.weekday}-${s.start}-${i}`}
                className="chip"
                title="Remover horário"
                onClick={() => updateCourse(course.id, { slots: course.slots.filter((_, j) => j !== i) })}
              >
                {WEEKDAYS_SHORT[s.weekday]} {s.start} ×
              </button>
            ))}
            {!course.slots.length && <span className="small muted">As aulas do dia aparecem no topo da tela Hoje.</span>}
          </div>
          <form
            className="row-flex"
            onSubmit={(e) => {
              e.preventDefault();
              updateCourse(course.id, { slots: [...course.slots, { weekday: Number(weekday), start }] });
            }}
          >
            <select id="slot-day" className="select" aria-label="Dia da semana" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i}>{w}</option>
              ))}
            </select>
            <input id="slot-time" className="input" type="time" aria-label="Horário" value={start} onChange={(e) => setStart(e.target.value)} style={{ maxWidth: 130 }} />
            <button className="btn" type="submit">Adicionar</button>
          </form>
        </section>

        <section className="section">
          <h3 className="label">Configuração</h3>
          <div className="form-row">
            <Field label="Nota mínima">
              <input
                id="cfg-pass" className="input" inputMode="decimal" defaultValue={fmtGrade(course.passGrade)}
                onBlur={(e) => {
                  const n = parseNum(e.target.value);
                  if (n !== undefined && n !== course.passGrade) updateCourse(course.id, { passGrade: Math.max(0, Math.min(10, n)) });
                }}
              />
            </Field>
            <Field label="Limite de faltas">
              <input
                id="cfg-max" className="input" inputMode="numeric" defaultValue={String(course.maxAbsences)}
                onBlur={(e) => {
                  const n = parseNum(e.target.value);
                  if (n !== undefined && n !== course.maxAbsences) updateCourse(course.id, { maxAbsences: Math.max(0, Math.round(n)) });
                }}
              />
            </Field>
          </div>
        </section>

        <div className="sheet-foot">
          <ConfirmButton
            label="Excluir disciplina"
            onConfirm={() => {
              deleteCourse(course.id);
              onClose();
            }}
          />
          <span className="spacer" />
          <button className="btn btn--primary" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </Sheet>
  );
}
