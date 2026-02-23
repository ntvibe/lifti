import { useEffect, useMemo, useState } from 'react'
import { toTitleCase } from '../utils/label'

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10_000)}`
}

const FALLBACK_SET = { reps: 10, weight: 0, restSec: 60 }

function parseDefaults(exercise = {}) {
  const hasPerSet = Array.isArray(exercise.defaultSets)
    ? exercise.defaultSets
    : Array.isArray(exercise.defaults?.sets)
      ? exercise.defaults.sets
      : null

  if (hasPerSet?.length) {
    const base = hasPerSet.slice(0, 3).map((entry) => ({
      reps: Number.isFinite(entry.reps) ? entry.reps : FALLBACK_SET.reps,
      weight: Number.isFinite(entry.weight) ? entry.weight : FALLBACK_SET.weight,
      restSec: Number.isFinite(entry.restSec) ? entry.restSec : FALLBACK_SET.restSec,
    }))

    while (base.length < 3) {
      base.push({ ...base[base.length - 1] })
    }

    return base
  }

  const defaultTriple = {
    reps: Number.isFinite(exercise.defaultReps) ? exercise.defaultReps : FALLBACK_SET.reps,
    weight: Number.isFinite(exercise.defaultWeight) ? exercise.defaultWeight : FALLBACK_SET.weight,
    restSec: Number.isFinite(exercise.defaultRestSec) ? exercise.defaultRestSec : FALLBACK_SET.restSec,
  }

  return [{ ...defaultTriple }, { ...defaultTriple }, { ...defaultTriple }]
}

export function createDefaultSets(exercise) {
  return parseDefaults(exercise).map((set) => ({ ...set, id: createId('set') }))
}

function clampValue(type, value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return type === 'restSec' ? FALLBACK_SET.restSec : 0
  }

  if (type === 'weight') {
    return Math.max(0, Math.round(num * 100) / 100)
  }

  return Math.max(0, Math.round(num))
}

function normalizeSet(setRow = {}) {
  return {
    id: setRow.id || createId('set'),
    reps: clampValue('reps', setRow.reps),
    weight: clampValue('weight', setRow.weight),
    restSec: clampValue('restSec', setRow.restSec),
  }
}

export default function ExerciseEditorModal({ isOpen, item, exercise, onClose, onSave }) {
  const [draftSets, setDraftSets] = useState([])

  const sets = useMemo(() => {
    if (draftSets.length) {
      return draftSets
    }

    if (item?.sets?.length) {
      return item.sets.map(normalizeSet)
    }

    return createDefaultSets(exercise)
  }, [draftSets, item?.sets, exercise])

  useEffect(() => {
    if (isOpen && item) {
      setDraftSets(item.sets?.length ? item.sets.map(normalizeSet) : createDefaultSets(exercise))
    }
  }, [isOpen, item, exercise])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen || !item) {
    return null
  }

  const commitSets = (nextSets) => {
    setDraftSets(nextSets)
    onSave(nextSets)
  }

  const updateSet = (rowIndex, field, nextValue) => {
    const nextSets = sets.map((set, index) => (index === rowIndex ? { ...set, [field]: clampValue(field, nextValue) } : set))
    commitSets(nextSets)
  }

  const saveAndClose = () => {
    onSave(sets)
    onClose()
  }

  return (
    <div className="modal-backdrop bottom-sheet-backdrop select-none" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) saveAndClose() }}>
      <section
        className="modal-sheet bottom-sheet exercise-editor-sheet glass glass-strong"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Keep close actions explicit (button / ESC / backdrop) so pointer movement never dismisses this dialog. */}
        <div className="sheet-handle" />
        <div className="filter-header-row">
          <h2>{toTitleCase(item.exerciseName)}</h2>
          <button type="button" className="text-button" onClick={saveAndClose}>X</button>
        </div>

        <div className="exercise-editor-content">
          <div className="sets-table">
            <div className="sets-header sets-grid-extended centered-headers">
              <span>Set #</span>
              <span>Reps</span>
              <span>Weight</span>
              <span>Rest</span>
              <span />
            </div>
            {sets.map((setRow, index) => (
              <div key={setRow.id || `${item.id}-set-${index + 1}`} className="set-row sets-grid-extended">
                <span className="set-index">{index + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="field-button"
                  value={setRow.reps}
                  min={0}
                  step={1}
                  aria-label={`Set ${index + 1} reps`}
                  onChange={(event) => updateSet(index, 'reps', event.target.value)}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  className="field-button"
                  value={setRow.weight}
                  min={0}
                  step={0.5}
                  aria-label={`Set ${index + 1} weight`}
                  onChange={(event) => updateSet(index, 'weight', event.target.value)}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  className="field-button"
                  value={setRow.restSec}
                  min={0}
                  step={5}
                  aria-label={`Set ${index + 1} rest in seconds`}
                  onChange={(event) => updateSet(index, 'restSec', event.target.value)}
                />
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Delete set ${index + 1}`}
                  onClick={() => commitSets(sets.filter((_, rowIndex) => rowIndex !== index))}
                >
                  X
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="ghost add-set-full"
            onClick={() => {
              const last = sets[sets.length - 1] || FALLBACK_SET
              commitSets([...sets, { id: createId('set'), reps: last.reps, weight: last.weight, restSec: last.restSec }])
            }}
          >
            + Add set
          </button>
        </div>
      </section>
    </div>
  )
}
