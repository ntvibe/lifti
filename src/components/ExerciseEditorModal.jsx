import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [draftSets, setDraftSets] = useState([])
  const [sheetOffsetY, setSheetOffsetY] = useState(0)
  const [scrub, setScrub] = useState({ active: false, rowIndex: -1, type: '', startY: 0, startValue: 0, pointerId: null, x: 0, y: 0 })
  const holdTimer = useRef(null)
  const pointerState = useRef({ startX: 0, startY: 0, moved: 0, holdTriggered: false, scrollMode: false })

  const sets = useMemo(() => {
    if (draftSets.length) {
      return draftSets
    }

    if (item?.sets?.length) {
      return item.sets
    }

    return createDefaultSets(exercise)
  }, [draftSets, item?.sets, exercise])

  useEffect(() => {
    if (isOpen && item) {
      setDraftSets(item.sets?.length ? item.sets : createDefaultSets(exercise))
    }
  }, [isOpen, item, exercise])

  if (!isOpen || !item) {
    return null
  }

  const updateSet = (rowIndex, field, nextValue) => {
    setDraftSets((current) => current.map((set, index) => (index === rowIndex ? { ...set, [field]: clampValue(field, nextValue) } : set)))
  }

  const saveAndClose = () => {
    onSave(sets)
    onClose()
    setKeypadTarget(null)
    setSheetOffsetY(0)
    setScrub({ active: false, rowIndex: -1, type: '', startY: 0, startValue: 0, pointerId: null, x: 0, y: 0 })
  }

  const resetHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const onPointerDownField = (event, rowIndex, field) => {
    const originY = event.clientY
    const originX = event.clientX
    pointerState.current = { startX: originX, startY: originY, moved: 0, holdTriggered: false, scrollMode: false }
    const currentValue = Number(sets[rowIndex]?.[field] ?? 0)

    resetHold()
    holdTimer.current = window.setTimeout(() => {
      pointerState.current.holdTriggered = true
    }, 250)

    setScrub((current) => ({ ...current, pointerId: event.pointerId, rowIndex, type: field, startY: originY, startValue: currentValue, x: originX, y: originY }))
  }

  const onPointerMoveField = (event, rowIndex, field) => {
    const moved = Math.hypot(event.clientY - pointerState.current.startY, event.clientX - pointerState.current.startX)
    pointerState.current.moved = moved

    if (!pointerState.current.holdTriggered && moved > 10) {
      resetHold()
      return
    }

    if (!pointerState.current.holdTriggered) {
      return
    }

    pointerState.current.scrollMode = true
    event.preventDefault()
    event.stopPropagation()

    const deltaY = scrub.startY - event.clientY
    const stepCount = Math.trunc(deltaY / 14)
    const next = clampValue(scrub.type, scrub.startValue + stepCount)

    setScrub((current) => ({ ...current, active: true, x: event.clientX, y: event.clientY }))
    updateSet(rowIndex, field, next)
  }

  const onPointerUpField = (rowIndex, field) => {
    resetHold()

    if (pointerState.current.scrollMode) {
      setScrub({ active: false, rowIndex: -1, type: '', startY: 0, startValue: 0, pointerId: null, x: 0, y: 0 })
      return
    }

    if (!pointerState.current.holdTriggered && pointerState.current.moved < 10) {
      setKeypadTarget({ rowIndex, field })
    }
  }

  return (
    <div className="modal-backdrop bottom-sheet-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) saveAndClose() }}>
      <section
        className="modal-sheet bottom-sheet"
        role="dialog"
        aria-modal="true"
        style={{ transform: `translateY(${sheetOffsetY}px)` }}
        onPointerDown={(event) => {
          pointerState.current.startY = event.clientY
        }}
        onPointerMove={(event) => {
          const delta = event.clientY - pointerState.current.startY
          if (delta > 0) {
            setSheetOffsetY(delta)
          }
        }}
        onPointerUp={() => {
          if (sheetOffsetY > 100) {
            saveAndClose()
          } else {
            setSheetOffsetY(0)
          }
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="filter-header-row">
          <h2>{toTitleCase(item.exerciseName)}</h2>
          <button type="button" className="text-button" onClick={saveAndClose}>✕</button>
        </div>

        <div className="sets-table">
          <div className="sets-header sets-grid-extended centered-headers">
            <span>Sets</span>
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
              <button type="button" className="text-button" onClick={() => setDraftSets(sets.filter((_, rowIndex) => rowIndex !== index))}>✕</button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ghost add-set-full"
          onClick={() => {
            const last = sets[sets.length - 1] || FALLBACK_SET
            setDraftSets([...sets, { id: createId('set'), reps: last.reps, weight: last.weight, restSec: last.restSec }])
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
