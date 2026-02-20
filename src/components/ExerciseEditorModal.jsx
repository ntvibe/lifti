import { useEffect, useMemo, useRef, useState } from 'react'
import { toTitleCase } from '../utils/label'
import useHoldScrubNumber from '../hooks/useHoldScrubNumber'
import CustomNumberPad from './CustomNumberPad'
import ScrubNumberOverlay from './ScrubNumberOverlay'

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10_000)}`
}

const FALLBACK_SET = { reps: 10, weight: 0, restSec: 90 }

const FIELD_CONFIG = {
  reps: { step: 1, min: 0, max: 200, unit: '' },
  weight: { step: 0.5, min: 0, max: 500, unit: 'kg' },
  restSec: { step: 5, min: 0, max: 600, unit: 's' },
}

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

function NumericFieldButton({ value, field, onTap, onScrub }) {
  const config = FIELD_CONFIG[field]
  const { bind, overlay, overlayRef } = useHoldScrubNumber({
    value,
    onChange: onScrub,
    onTap,
    step: config.step,
    min: config.min,
    max: config.max,
    longPressMs: 250,
  })

  return (
    <>
      <button
        type="button"
        className="field-button select-none"
        style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
        aria-label={`${field} value ${value}`}
        {...bind}
      >
        {value}
      </button>
      <ScrubNumberOverlay
        open={overlay.open}
        anchorRect={overlay.anchorRect}
        value={overlay.displayValue}
        step={config.step}
        unit={config.unit}
        pulseKey={overlay.pulseKey}
        overlayRef={overlayRef}
      />
    </>
  )
}

export default function ExerciseEditorModal({ isOpen, item, exercise, onClose, onSave }) {
  const [keypadTarget, setKeypadTarget] = useState(null)
  const [draftSets, setDraftSets] = useState([])
  const [sheetOffsetY, setSheetOffsetY] = useState(0)
  const sheetPointerStart = useRef(0)

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
  }

  return (
    <div className="modal-backdrop bottom-sheet-backdrop select-none" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) saveAndClose() }}>
      <section
        className="modal-sheet bottom-sheet glass glass-strong"
        role="dialog"
        aria-modal="true"
        style={{ transform: `translateY(${sheetOffsetY}px)` }}
        onPointerDown={(event) => {
          sheetPointerStart.current = event.clientY
        }}
        onPointerMove={(event) => {
          if (keypadTarget) {
            return
          }
          const delta = event.clientY - sheetPointerStart.current
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
                <NumericFieldButton
                  key={field}
                  field={field}
                  value={setRow[field]}
                  onTap={() => setKeypadTarget({ rowIndex: index, field })}
                  onScrub={(nextValue) => updateSet(index, field, nextValue)}
                />
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
    </div>
  )
}
