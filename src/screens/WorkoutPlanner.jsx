import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { normalizeKey } from '../utils/normalize'
import { toTitleCase } from '../utils/label'
import { getPublicAssetUrl } from '../services/exerciseCatalog'
import AddExerciseModal from '../components/AddExerciseModal'
import { createDefaultSets } from '../components/ExerciseEditorModal'
import PlanMuscleHeatmapSVG from '../components/PlanMuscleHeatmapSVG'
import { computePlanMuscleIntensities } from '../utils/planIntensity'
import Icon from '../components/Icon'
import useNumberInputController from '../hooks/useNumberInputController'
import useHoldScrubNumber from '../hooks/useHoldScrubNumber'
import ScrubNumberOverlay from '../components/ScrubNumberOverlay'

const MUSCLE_FIELD_CANDIDATES = ['primaryMuscles', 'muscles', 'muscleGroups', 'muscleGroup', 'targetMuscles', 'targets']
const EQUIPMENT_FIELD_CANDIDATES = ['equipment', 'equipments', 'gear', 'machine']
const FALLBACK_SET = { reps: 10, weight: 0, restSec: 60 }
const FIELD_CONFIG = {
  reps: { step: 1, allowDecimal: false, min: 0, max: 200, unit: '' },
  weight: { step: 0.5, allowDecimal: true, min: 0, max: 500, unit: 'kg' },
  restSec: { step: 5, allowDecimal: false, min: 0, max: 600, unit: 's' },
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10_000)}`
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return [value]
  return []
}

function extractKeys(exercise, fieldNames) {
  for (const fieldName of fieldNames) {
    const values = normalizeArray(exercise[fieldName]).map((entry) => normalizeKey(entry)).filter(Boolean)
    if (values.length) return values
  }
  return []
}

function clampValue(type, value) {
  const config = FIELD_CONFIG[type] || FIELD_CONFIG.reps
  const num = Number(value)
  if (!Number.isFinite(num)) return type === 'restSec' ? FALLBACK_SET.restSec : 0

  const rounded = config.allowDecimal ? Math.round(num * 100) / 100 : Math.round(num)
  return Math.max(config.min, Math.min(config.max, rounded))
}

function ScrubbableNumberField({ id, label, value, config, onTap, onScrubChange }) {
  const { bind, overlay, overlayRef } = useHoldScrubNumber({
    value,
    onChange: onScrubChange,
    onTap: (event) => onTap(event.currentTarget),
    step: config.step,
    min: config.min,
    max: config.max,
    longPressMs: 250,
    pixelsPerStep: 14,
  })

  return (
    <>
      <button
        id={id}
        type="button"
        className="field-button numeric-field-trigger"
        aria-label={label}
        role="button"
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

function NumberKeypad({ isOpen, fieldKey, value, onChange, onDone, onClose }) {
  if (!isOpen || !fieldKey) return null

  const config = FIELD_CONFIG[fieldKey]
  const nudges = config.allowDecimal ? [-10, -5, -2.5, 2.5, 5, 10] : [-10, -5, 5, 10]

  return (
    <div className="modal-backdrop keypad-backdrop" role="presentation" onClick={onClose}>
      <section className="number-pad-sheet keypad-sheet glass glass-strong" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="number-pad-value">{value || '0'}</div>
        <div className="number-pad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button key={digit} type="button" onClick={() => onChange((prev) => `${prev || ''}${digit}`)}>{digit}</button>
          ))}
          {config.allowDecimal
            ? <button type="button" onClick={() => onChange((prev) => (prev.includes('.') ? prev : `${prev || '0'}.`))}>.</button>
            : <button type="button" onClick={() => onChange((prev) => (prev ? prev.slice(0, -1) : ''))}>⌫</button>}
          <button type="button" onClick={() => onChange((prev) => `${prev || ''}0`)}>0</button>
          <button type="button" onClick={() => onChange((prev) => (prev ? prev.slice(0, -1) : ''))}>⌫</button>
        </div>

        <div className="nudge-row">
          {nudges.map((step) => (
            <button
              key={step}
              type="button"
              className="ghost"
              onClick={() => onChange((prev) => {
                const base = Number(prev || 0)
                return String(Math.max(config.min, Math.min(config.max, (Number.isFinite(base) ? base : 0) + step)))
              })}
            >
              {step > 0 ? `+${step}` : step}
            </button>
          ))}
        </div>

        <button type="button" onClick={onDone}>Done</button>
      </section>
    </div>
  )
}

export default function WorkoutPlanner({ plan, allExercises, onPlanChange, onStartWorkout }) {
  const navigate = useNavigate()
  const { exerciseItemId = '' } = useParams()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  const [openMenuItemId, setOpenMenuItemId] = useState('')
  const [reorderItemId, setReorderItemId] = useState('')
  const titleInputRef = useRef(null)
  const menuRef = useRef(null)
  const menuHoldTimerRef = useRef(null)

  const intensities = useMemo(() => computePlanMuscleIntensities(plan.exercises, allExercises), [plan.exercises, allExercises])
  const exerciseById = useMemo(() => new Map((allExercises || []).map((exercise) => [exercise.id, exercise])), [allExercises])
  const editingItem = plan.exercises.find((item) => item.id === exerciseItemId) || null
  const editingExercise = editingItem ? exerciseById.get(editingItem.exerciseId) : null

  const setExercises = (exercises) => onPlanChange({ ...plan, exercises })

  const updateItemSets = (itemId, updater) => {
    setExercises(plan.exercises.map((item) => {
      if (item.id !== itemId) return item
      const nextSets = typeof updater === 'function' ? updater(item.sets || []) : updater
      return { ...item, sets: nextSets }
    }))
  }

  const numberInputController = useNumberInputController({
    onCommit: (field, value) => {
      if (!editingItem) return
      updateItemSets(editingItem.id, (sets) => sets.map((entry) => (
        entry.id === field.setId ? { ...entry, [field.fieldKey]: clampValue(field.fieldKey, value) } : entry
      )))
    },
  })

  const editingMuscles = useMemo(() => {
    if (editingItem?.muscles?.length) return editingItem.muscles
    return extractKeys(editingExercise || {}, MUSCLE_FIELD_CANDIDATES)
  }, [editingItem, editingExercise])

  useEffect(() => {
    if (!openMenuItemId && !reorderItemId) return undefined
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuItemId('')
        setReorderItemId('')
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [openMenuItemId, reorderItemId])

  useEffect(() => {
    if (isTitleEditing) {
      window.requestAnimationFrame(() => {
        titleInputRef.current?.focus()
        titleInputRef.current?.select()
      })
    }
  }, [isTitleEditing])

  useEffect(() => {
    if (!numberInputController.isKeypadOpen) return undefined
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = originalOverflow }
  }, [numberInputController.isKeypadOpen])

  useEffect(() => () => {
    if (menuHoldTimerRef.current) window.clearTimeout(menuHoldTimerRef.current)
  }, [])

  const addExercise = (exercise) => {
    const item = {
      id: createId('item'),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscles: extractKeys(exercise, MUSCLE_FIELD_CANDIDATES),
      equipment: extractKeys(exercise, EQUIPMENT_FIELD_CANDIDATES),
      sets: createDefaultSets(exercise),
    }
    setExercises([...plan.exercises, item])
  }

  const moveExercise = (itemId, direction) => {
    const index = plan.exercises.findIndex((item) => item.id === itemId)
    if (index < 0) return
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= plan.exercises.length) return
    const list = [...plan.exercises]
    const [moved] = list.splice(index, 1)
    list.splice(nextIndex, 0, moved)
    setExercises(list)
  }

  if (exerciseItemId) {
    if (!editingItem) {
      return <section className="screen planner-exercise-editor-screen"><p>Exercise not found.</p><button type="button" className="ghost" onClick={() => navigate('/planner')}>Back to plan</button></section>
    }

    return (
      <section className="screen planner-exercise-editor-screen">
        <div className="exercise-editor-top-row">
          <button type="button" className="ghost" onClick={() => navigate('/planner')} aria-label="Back to plan"><Icon name="arrow_back" /></button>
        </div>

        <PlanMuscleHeatmapSVG svgPath={getPublicAssetUrl('svg/muscle-groups.svg')} intensities={Object.fromEntries(editingMuscles.map((group) => [normalizeKey(group), 1]))} className="plan-editor-heatmap exercise-editor-heatmap" />
        <h2 className="exercise-editor-title">{toTitleCase(editingItem.exerciseName)}</h2>

        <div className="exercise-editor-content">
          <div className="sets-table">
            <div className="sets-header sets-grid-extended centered-headers"><span>Set #</span><span>Reps</span><span>Weight</span><span>Rest</span><span /></div>
            {(editingItem.sets || []).map((setRow, index) => {
              const setId = setRow.id || `${editingItem.id}-set-${index + 1}`

              return (
                <div key={setId} className="set-row sets-grid-extended">
                  <span className="set-index">{index + 1}</span>
                  {['reps', 'weight', 'restSec'].map((fieldKey) => {
                    const config = FIELD_CONFIG[fieldKey]

                    return (
                      <div key={fieldKey} className="number-input-wrap">
                        <ScrubbableNumberField
                          id={`${setId}-${fieldKey}`}
                          label={`Set ${index + 1} ${fieldKey === 'restSec' ? 'rest in seconds' : fieldKey}`}
                          value={setRow[fieldKey]}
                          config={config}
                          onScrubChange={(nextValue) => {
                            numberInputController.openField({ setId, fieldKey }, nextValue)
                            numberInputController.commit(nextValue)
                          }}
                          onTap={(target) => {
                            numberInputController.openField({ setId, fieldKey }, setRow[fieldKey], { openKeypad: true })
                            window.requestAnimationFrame(() => {
                              target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
                            })
                          }}
                        />
                      </div>
                    )
                  })}
                  <button type="button" className="text-button" aria-label={`Delete set ${index + 1}`} onClick={() => updateItemSets(editingItem.id, (sets) => sets.filter((_, rowIndex) => rowIndex !== index))}>X</button>
                </div>
              )
            })}
          </div>

          <button type="button" className="ghost add-set-full" onClick={() => {
            const sets = editingItem.sets || []
            const last = sets[sets.length - 1] || FALLBACK_SET
            updateItemSets(editingItem.id, [...sets, { id: createId('set'), reps: last.reps, weight: last.weight, restSec: last.restSec }])
          }}>
            + Add set
          </button>
        </div>

        <button type="button" className="fab done-fab" onClick={() => { numberInputController.close(); navigate('/planner') }} aria-label="Done"><Icon name="check" /></button>

        <NumberKeypad
          isOpen={numberInputController.isKeypadOpen}
          fieldKey={numberInputController.activeField?.fieldKey}
          value={numberInputController.currentValue}
          onChange={numberInputController.setCurrentValue}
          onClose={numberInputController.closeKeypad}
          onDone={() => {
            numberInputController.commit(numberInputController.currentValue || '0')
            numberInputController.closeKeypad()
          }}
        />
      </section>
    )
  }

  return (
    <section className="screen planner-screen">
      <PlanMuscleHeatmapSVG svgPath={getPublicAssetUrl('svg/muscle-groups.svg')} intensities={intensities} className="plan-editor-heatmap" />

      {isTitleEditing ? (
        <input
          ref={titleInputRef}
          className="plan-name-input filled-plan-name"
          value={plan.name}
          onChange={(event) => onPlanChange({ ...plan, name: event.target.value })}
          onBlur={() => setIsTitleEditing(false)}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur() }}
          aria-label="Plan Name"
        />
      ) : (
        <button type="button" className="plan-name-input filled-plan-name plan-name-display" onClick={() => setIsTitleEditing(true)} aria-label="Edit plan name">{plan.name || 'New Plan'}</button>
      )}

      <div className="plan-items scroll-safe-list plans-grid-padded">
        {plan.exercises.map((item) => (
          <article key={item.id} className="plan-item-shell">
            <div className="plan-item-row plan-item-touch" onClick={() => { navigate(`/planner/exercise/${item.id}`); setOpenMenuItemId(''); setReorderItemId('') }}>
              <div>
                <strong>{toTitleCase(item.exerciseName)}</strong>
                <small>{(item.sets || []).length} sets</small>
              </div>

              <div className="kebab-wrap" ref={(openMenuItemId === item.id || reorderItemId === item.id) ? menuRef : null}>
                <button
                  type="button"
                  className="ghost kebab-button kebab-icon-only"
                  aria-label={`Exercise menu for ${item.exerciseName}`}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    if (menuHoldTimerRef.current) window.clearTimeout(menuHoldTimerRef.current)
                    menuHoldTimerRef.current = window.setTimeout(() => {
                      setReorderItemId(item.id)
                      setOpenMenuItemId('')
                      menuHoldTimerRef.current = null
                    }, 220)
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation()
                    if (!menuHoldTimerRef.current) return
                    window.clearTimeout(menuHoldTimerRef.current)
                    menuHoldTimerRef.current = null
                    setOpenMenuItemId((current) => (current === item.id ? '' : item.id))
                    setReorderItemId('')
                  }}
                  onPointerLeave={() => {
                    if (menuHoldTimerRef.current) {
                      window.clearTimeout(menuHoldTimerRef.current)
                      menuHoldTimerRef.current = null
                    }
                  }}
                  onPointerCancel={() => {
                    if (menuHoldTimerRef.current) {
                      window.clearTimeout(menuHoldTimerRef.current)
                      menuHoldTimerRef.current = null
                    }
                  }}
                >
                  <Icon name="more_vert" />
                </button>

                {reorderItemId === item.id ? (
                  <div className="kebab-menu glass">
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveExercise(item.id, 'up') }}>Move up</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveExercise(item.id, 'down') }}>Move down</button>
                  </div>
                ) : null}

                {openMenuItemId === item.id ? (
                  <div className="kebab-menu glass">
                    <button
                      type="button"
                      className="destructive"
                      onClick={(event) => {
                        event.stopPropagation()
                        setOpenMenuItemId('')
                        if (window.confirm('Delete this exercise?')) {
                          setExercises(plan.exercises.filter((entry) => entry.id !== item.id))
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      <button type="button" className="fab" aria-label="Add exercise" onClick={() => setIsAddOpen(true)}>
        <Icon name="add" />
      </button>

      <button
        type="button"
        className="fab planner-play-fab"
        aria-label="Start workout"
        onClick={() => onStartWorkout(plan)}
        style={{ right: '5rem' }}
      >
        <Icon name="play_arrow" />
      </button>

      <AddExerciseModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        allExercises={allExercises}
        selectedIds={new Set(plan.exercises.map((item) => item.exerciseId))}
        onAdd={(exercise) => {
          addExercise(exercise)
          setIsAddOpen(false)
        }}
      />
    </section>
  )
}
