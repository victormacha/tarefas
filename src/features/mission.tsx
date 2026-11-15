import { useState } from 'react';
import { Check, Pin } from 'lucide-react';
import { addMission, completeMission, deleteMission, reopenMission, togglePin, updateMission } from '../lib/actions';
import { relDay, todayISO } from '../lib/dates';
import { ATTRS, EFFORTS, FRONT_KEYS, FRONTS } from '../lib/meta';
import type { AttrKey, Effort, FrontKey, ISODate, Mission } from '../lib/types';
import { ConfirmButton, Field, FrontTag, Pips, Segmented, Sheet } from '../ui/kit';

export function DueChip({ due, today }: { due: ISODate; today: ISODate }) {
  const late = due < today;
  return <span className={`pill${late ? ' pill--crit' : due === today ? ' pill--warn' : ''}`}>{relDay(due, today)}</span>;
}

export function MissionRow({ mission, why, today, onOpen }: { mission: Mission; why?: string; today: ISODate; onOpen: (m: Mission) => void }) {
  return (
    <div className={`row${mission.done ? ' mission-done' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={mission.done}
        aria-label={mission.done ? `Reabrir: ${mission.title}` : `Concluir: ${mission.title}`}
        onClick={() => (mission.done ? reopenMission(mission.id) : completeMission(mission.id))}
      >
        <Check size={13} strokeWidth={3} />
      </button>
      <button className="row-main" onClick={() => onOpen(mission)} style={{ textAlign: 'left' }}>
        <span className="row-title">{mission.title}</span>
        <span className="row-meta">
          <FrontTag front={mission.front} />
          {!mission.done && why && <span>{why}</span>}
        </span>
      </button>
      <span className="row-end">
        {mission.pin === today && !mission.done && <Pin size={13} className="muted" aria-label="Fixada para hoje" />}
        {mission.due && !mission.done && <DueChip due={mission.due} today={today} />}
        <Pips effort={mission.effort} />
      </span>
    </div>
  );
}

/** Criar ou editar uma missão. */
export function MissionSheet({ mission, preset, onClose }: { mission?: Mission; preset?: Partial<Mission>; onClose: () => void }) {
  const base = mission ?? preset;
  const [title, setTitle] = useState(base?.title ?? '');
  const [front, setFront] = useState<FrontKey>(base?.front ?? 'pessoal');
  const [attr, setAttr] = useState<AttrKey>(base?.attr ?? FRONTS[base?.front ?? 'pessoal'].attr);
  const [effort, setEffort] = useState<Effort>(base?.effort ?? 2);
  const [due, setDue] = useState(base?.due ?? '');
  const [note, setNote] = useState(base?.note ?? '');
  const today = todayISO();

  const changeFront = (f: FrontKey) => {
    setFront(f);
    setAttr(FRONTS[f].attr);
  };

  const save = () => {
    if (!title.trim()) return;
    const data = { title: title.trim(), front, attr, effort, due: due || undefined, note: note.trim() || undefined };
    if (mission) updateMission(mission.id, data);
    else addMission({ ...data, ref: preset?.ref });
    onClose();
  };

  return (
    <Sheet title={mission ? 'Missão' : 'Nova missão'} onClose={onClose}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="O que precisa ser feito">
          <input id="mission-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!mission} placeholder="Algo que termina em uma sentada" />
        </Field>
        <div className="form-row">
          <Field label="Frente">
            <select id="mission-front" className="select" value={front} onChange={(e) => changeFront(e.target.value as FrontKey)}>
              {FRONT_KEYS.map((f) => (
                <option key={f} value={f}>{FRONTS[f].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Prazo">
            <input id="mission-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        {front === 'estudio' && (
          <Field label="Evolui qual atributo">
            <Segmented
              label="Atributo"
              wide
              value={attr === 'inf' ? 'inf' : 'ofi'}
              onChange={(v) => setAttr(v)}
              options={[
                { value: 'ofi', label: `${ATTRS.ofi.label} · edição` },
                { value: 'inf', label: `${ATTRS.inf.label} · clientes` },
              ]}
            />
          </Field>
        )}
        <Field label="Esforço" hint={`${EFFORTS[effort].hint} · +${EFFORTS[effort].xp} XP de ${ATTRS[attr].label}`}>
          <Segmented
            label="Esforço"
            wide
            value={String(effort)}
            onChange={(v) => setEffort(Number(v) as Effort)}
            options={([1, 2, 3, 4] as Effort[]).map((e) => ({ value: String(e), label: EFFORTS[e].label }))}
          />
        </Field>
        <Field label="Anotação">
          <textarea id="mission-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </Field>
        <div className="sheet-foot">
          {mission && (
            <>
              <ConfirmButton
                label="Excluir"
                onConfirm={() => {
                  deleteMission(mission.id);
                  onClose();
                }}
              />
              {!mission.done && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    togglePin(mission.id);
                    onClose();
                  }}
                >
                  <Pin size={15} /> {mission.pin === today ? 'Desafixar' : 'Fixar para hoje'}
                </button>
              )}
            </>
          )}
          <span className="spacer" />
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
            {mission ? 'Salvar' : 'Criar missão'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
