import { useMemo, useRef, useState } from 'react'
import { toTitleCase } from '../utils/label'
import CustomNumberPad from './CustomNumberPad'
import ScrubNumberOverlay from './ScrubNumberOverlay'

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10_000)}`
}

const FALLBACK_SET = { reps: 10, weight: 0, restSec: 90 }

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
    return 0
  }

  if (type === 'weight') {
    return Math.max(0, Math.round(num * 100) / 100)
  }

  return Math.max(0, Math.round(num))
}

export default function ExerciseEditorModal({ isOpen, item, exercise, onClose, onSave }) {
  const [keypadTarget, setKeypadTarget] = useState(null)
  const [scrub, setScrub] = useState({ active: false, rowIndex: -1, type: '', startY: 0, startX: 0, startValue: 0, pointerId: null, x: 0, y: 0 })
  const holdTimer = useRef(null)
  const pointerStart = useRef({ x: 0, y: 0 })

  const sets = useMemo(() => {
    if (item?.sets?.length) {
      return item.sets
    }

    return createDefaultSets(exercise)
  }, [item?.sets, exercise])

  if (!isOpen || !item) {
    return null
  }

  const updateSet = (rowIndex, field, nextValue) => {
    const updated = sets.map((set, index) => (index === rowIndex ? { ...set, [field]: clampValue(field, nextValue) } : set))
    onSave(updated)
  }

  const onPointerDownField = (event, rowIndex, field) => {
    const pointerId = event.pointerId
    const originY = event.clientY
    const originX = event.clientX
    pointerStart.current = { x: originX, y: originY }
    const currentValue = Number(sets[rowIndex]?.[field] ?? 0)

    holdTimer.current = window.setTimeout(() => {
      setScrub({
        active: true,
        rowIndex,
        type: field,
        startY: originY,
        startX: originX,
        startValue: currentValue,
        pointerId,
        x: originX,
        y: originY,
      })
    }, 300)
  }

  const onPointerMoveField = (event, rowIndex, field) => {
    if (!scrub.active) {
      const moved = Math.hypot(event.clientY - pointerStart.current.y, event.clientX - pointerStart.current.x)
      if (moved > 12 && holdTimer.current) {
        window.clearTimeout(holdTimer.current)
        holdTimer.current = null
      }
      return
    }

    if (event.pointerId !== scrub.pointerId || rowIndex !== scrub.rowIndex || field !== scrub.type) {
      return
    }

    event.preventDefault()
    const deltaY = scrub.startY - event.clientY
    const step = scrub.type === 'weight' ? 0.5 : scrub.type === 'restSec' ? 5 : 1
    const stepCount = Math.trunc(deltaY / 14)
    const next = clampValue(scrub.type, scrub.startValue + (stepCount * step))

    setScrub((current) => ({ ...current, x: event.clientX, y: event.clientY }))
    updateSet(rowIndex, field, next)

    if (navigator.vibrate && stepCount !== 0) {
      navigator.vibrate(8)
    }
  }

  const onPointerUpField = (rowIndex, field) => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }

    if (scrub.active) {
      setScrub({ active: false, rowIndex: -1, type: '', startY: 0, startX: 0, startValue: 0, pointerId: null, x: 0, y: 0 })
      return
    }

    setKeypadTarget({ rowIndex, field })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="filter-header-row">
          <h2>{toTitleCase(item.exerciseName)}</h2>
          <button type="button" className="text-button" onClick={onClose}>✕</button>
        </div>

        <div className="sets-table">
          <div className="sets-header sets-grid-extended">
            <span>#</span>
            <span>Reps</span>
            <span>Weight</span>
            <span>Rest</span>
            <span />
          </div>
          {sets.map((setRow, index) => (
            <div key={setRow.id || `${item.id}-set-${index + 1}`} className="set-row sets-grid-extended">
              <span className="set-index">{index + 1}</span>
              {['reps', 'weight', 'restSec'].map((field) => (
                <button
                  key={field}
                  type="button"
                  className="field-button"
                  onPointerDown={(event) => onPointerDownField(event, index, field)}
                  onPointerMove={(event) => onPointerMoveField(event, index, field)}
                  onPointerUp={() => onPointerUpField(index, field)}
                  onPointerCancel={() => onPointerUpField(index, field)}
                >
                  {setRow[field]}
                </button>
              ))}
              <button type="button" className="text-button" onClick={() => onSave(sets.filter((_, rowIndex) => rowIndex !== index))}>✕</button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ghost"
          onClick={() => {
            const last = sets[sets.length - 1] || FALLBACK_SET
            onSave([...sets, { id: createId('set'), reps: last.reps, weight: last.weight, restSec: last.restSec }])
          }}
        >
          + Add Set
        </button>
      </section>

      <CustomNumberPad
        isOpen={Boolean(keypadTarget)}
        type={keypadTarget?.field}
        value={keypadTarget ? sets[keypadTarget.rowIndex]?.[keypadTarget.field] : 0}
        onClose={() => setKeypadTarget(null)}
        onDone={(nextValue) => {
          if (keypadTarget) {
            updateSet(keypadTarget.rowIndex, keypadTarget.field, nextValue)
          }
          setKeypadTarget(null)
        }}
      />

      <ScrubNumberOverlay
        active={scrub.active}
        x={scrub.x}
        y={scrub.y}
        label={scrub.type}
        value={scrub.active && scrub.rowIndex >= 0 ? sets[scrub.rowIndex]?.[scrub.type] : 0}
      />
    </div>
  )
}
