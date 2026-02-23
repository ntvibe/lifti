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

const MUSCLE_FIELD_CANDIDATES = ['primaryMuscles', 'muscles', 'muscleGroups', 'muscleGroup', 'targetMuscles', 'targets']
const EQUIPMENT_FIELD_CANDIDATES = ['equipment', 'equipments', 'gear', 'machine']
const FALLBACK_SET = { reps: 10, weight: 0, restSec: 60 }
const FIELD_CONFIG = {
  reps: { step: 1, allowDecimal: false },
  weight: { step: 0.5, allowDecimal: true },
  restSec: { step: 5, allowDecimal: false },
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
  const num = Number(value)
  if (!Number.isFinite(num)) return type === 'restSec' ? FALLBACK_SET.restSec : 0
  if (type === 'weight') return Math.max(0, Math.round(num * 100) / 100)
  return Math.max(0, Math.round(num))
}

function NumberKeypad({ isOpen, fieldKey, value, onChange, onDone, onClose }) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop keypad-backdrop" role="presentation" onClick={onClose}>
      <section className="number-pad-sheet keypad-sheet glass glass-strong" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="number-pad-value">{value || '0'}</div>
        <div className="number-pad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button key={digit} type="button" onClick={() => onChange((prev) => `${prev || ''}${digit}`)}>{digit}</button>
          ))}
          {fieldKey === 'weight'
            ? <button type="button" onClick={() => onChange((prev) => (prev.includes('.') ? prev : `${prev || '0'}.`))}>.</button>
            : <button type="button" onClick={() => onChange((prev) => (prev ? prev.slice(0, -1) : ''))}>⌫</button>}
          <button type="button" onClick={() => onChange((prev) => `${prev || ''}0`)}>0</button>
          <button type="button" onClick={() => onChange((prev) => (prev ? prev.slice(0, -1) : ''))}>⌫</button>
        </div>

        <div className="nudge-row">
          {[-10, -5, -2.5, 2.5, 5, 10].map((step) => (
            <button
              key={step}
              type="button"
              className="ghost"
              onClick={() => onChange((prev) => {
                const base = Number(prev || 0)
                return String(Math.max(0, (Number.isFinite(base) ? base : 0) + step))
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
                    const isActive = numberInputController.activeField?.setId === setId && numberInputController.activeField?.fieldKey === fieldKey

                    return (
                      <div key={fieldKey} className="number-input-wrap">
                        <input
                          type="text"
                          inputMode={config.allowDecimal ? 'decimal' : 'numeric'}
                          className="field-button"
                          value={isActive ? numberInputController.currentValue : String(setRow[fieldKey])}
                          aria-label={`Set ${index + 1} ${fieldKey === 'restSec' ? 'rest in seconds' : fieldKey}`}
                          onFocus={() => numberInputController.openField({ setId, fieldKey }, setRow[fieldKey])}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            if (!config.allowDecimal && /[^\d]/.test(nextValue)) return
                            if (config.allowDecimal && /[^\d.]/.test(nextValue)) return
                            if (config.allowDecimal && nextValue.split('.').length > 2) return
                            numberInputController.setCurrentValue(nextValue)
                          }}
                          onBlur={(event) => numberInputController.commit(event.currentTarget.value || '0')}
                        />

                        {isActive ? (
                          <div className="input-stepper-overlay" aria-hidden="true">
                            <button type="button" className="ghost stepper-btn" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => numberInputController.nudge(config.step)}>+{config.step}</button>
                            <button type="button" className="ghost stepper-btn" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => numberInputController.nudge(-config.step)}>-{config.step}</button>
                          </div>
                        ) : null}
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

        {numberInputController.activeField ? (
          <button type="button" className="open-keypad-fab" onClick={numberInputController.openKeypad} aria-label="Open keypad"><Icon name="calculate" /></button>
        ) : null}

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
                      Delete exercise
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="add-exercise-wrap">
        <button type="button" className="ghost add-exercise-full" onClick={() => setIsAddOpen(true)} aria-label="Add exercise"><Icon name="add" /><span>Add exercise</span></button>
      </div>

      <button type="button" className="fab start-plan-fab" onClick={() => onStartWorkout?.(plan)} aria-label={`Start ${plan.name}`}><Icon name="play_arrow" /></button>

      <AddExerciseModal
        isOpen={isAddOpen}
        allExercises={allExercises}
        onClose={() => setIsAddOpen(false)}
        onSelectExercise={(exercise) => { addExercise(exercise); setIsAddOpen(false) }}
      />
    </section>
  )
}
