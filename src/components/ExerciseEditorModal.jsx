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
const HOLD_MS = 250
const TAP_MOVE_THRESHOLD = 6

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
  const pointerState = useRef({
    startX: 0,
    startY: 0,
    moved: 0,
    holdTriggered: false,
    scrollMode: false,
    rowIndex: -1,
    field: '',
    pointerId: null,
    startValue: 0,
  })

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

  useEffect(() => () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  if (!isOpen || !item) {
    return null
  }

  const updateSet = (rowIndex, field, nextValue) => {
    setDraftSets((current) => current.map((set, index) => (index === rowIndex ? { ...set, [field]: clampValue(field, nextValue) } : set)))
  }

  const resetHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const clearScrub = () => {
    setScrub({ active: false, rowIndex: -1, type: '', startY: 0, startValue: 0, pointerId: null, x: 0, y: 0 })
    pointerState.current = { startX: 0, startY: 0, moved: 0, holdTriggered: false, scrollMode: false, rowIndex: -1, field: '', pointerId: null, startValue: 0 }
  }

  const saveAndClose = () => {
    onSave(sets)
    onClose()
    setKeypadTarget(null)
    setSheetOffsetY(0)
    resetHold()
    clearScrub()
  }

  const onPointerDownField = (event, rowIndex, field) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const originY = event.clientY
    const originX = event.clientX
    const currentValue = Number(sets[rowIndex]?.[field] ?? 0)

    pointerState.current = {
      startX: originX,
      startY: originY,
      moved: 0,
      holdTriggered: false,
      scrollMode: false,
      rowIndex,
      field,
      pointerId: event.pointerId,
      startValue: currentValue,
    }

    resetHold()
    holdTimer.current = window.setTimeout(() => {
      pointerState.current.holdTriggered = true
      pointerState.current.scrollMode = true
      setScrub({ active: true, rowIndex, type: field, startY: originY, startValue: currentValue, pointerId: event.pointerId, x: originX, y: originY })
    }, HOLD_MS)
  }

  const onPointerMoveField = (event) => {
    const state = pointerState.current
    if (event.pointerId !== state.pointerId) {
      return
    }

    const moved = Math.hypot(event.clientY - state.startY, event.clientX - state.startX)
    state.moved = moved

    if (!state.holdTriggered) {
      if (moved > TAP_MOVE_THRESHOLD) {
        resetHold()
      }
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const deltaY = state.startY - event.clientY
    const stepCount = Math.trunc(deltaY / 14)
    const next = clampValue(state.field, state.startValue + stepCount)

    setScrub((current) => ({ ...current, active: true, x: event.clientX, y: event.clientY }))
    updateSet(state.rowIndex, state.field, next)
  }

  const onPointerUpField = (event) => {
    const state = pointerState.current
    if (event.pointerId !== state.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    resetHold()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (state.scrollMode || state.holdTriggered) {
      clearScrub()
      return
    }

    if (state.moved < TAP_MOVE_THRESHOLD) {
      setKeypadTarget({ rowIndex: state.rowIndex, field: state.field })
    }

    clearScrub()
  }

  return (
    <div className="modal-backdrop bottom-sheet-backdrop select-none" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) saveAndClose() }}>
      <section
        className="modal-sheet bottom-sheet glass glass-strong"
        role="dialog"
        aria-modal="true"
        style={{ transform: `translateY(${sheetOffsetY}px)` }}
        onPointerDown={(event) => {
          pointerState.current.startY = event.clientY
        }}
        onPointerMove={(event) => {
          if (keypadTarget) {
            return
          }
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
                  className="field-button select-none"
                  style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
                  onPointerDown={(event) => onPointerDownField(event, index, field)}
                  onPointerMove={onPointerMoveField}
                  onPointerUp={onPointerUpField}
                  onPointerCancel={onPointerUpField}
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
