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

const MUSCLE_FIELD_CANDIDATES = ['primaryMuscles', 'muscles', 'muscleGroups', 'muscleGroup', 'targetMuscles', 'targets']
const EQUIPMENT_FIELD_CANDIDATES = ['equipment', 'equipments', 'gear', 'machine']
const FALLBACK_SET = { reps: 10, weight: 0, restSec: 60 }

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10_000)}`
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    return [value]
  }

  return []
}

function extractKeys(exercise, fieldNames) {
  for (const fieldName of fieldNames) {
    const values = normalizeArray(exercise[fieldName]).map((entry) => normalizeKey(entry)).filter(Boolean)
    if (values.length) {
      return values
    }
  }

  return []
}

const EMPTY_GESTURE = {
  id: '',
  pointerId: null,
  startX: 0,
  startY: 0,
  moved: false,
  holdReady: false,
  mode: '',
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

export default function WorkoutPlanner({ plan, allExercises, onPlanChange, onStartWorkout }) {
  const navigate = useNavigate()
  const { exerciseItemId = '' } = useParams()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  const [openMenuItemId, setOpenMenuItemId] = useState('')
  const [draggingItemId, setDraggingItemId] = useState('')
  const [dragOverItemId, setDragOverItemId] = useState('')
  const titleInputRef = useRef(null)
  const menuRef = useRef(null)
  const holdTimerRef = useRef(null)
  const gestureRef = useRef(EMPTY_GESTURE)

  const intensities = useMemo(() => computePlanMuscleIntensities(plan.exercises, allExercises), [plan.exercises, allExercises])
  const exerciseById = useMemo(() => new Map((allExercises || []).map((exercise) => [exercise.id, exercise])), [allExercises])
  const editingItem = plan.exercises.find((item) => item.id === exerciseItemId) || null
  const editingExercise = editingItem ? exerciseById.get(editingItem.exerciseId) : null
  const editingMuscles = useMemo(() => {
    if (editingItem?.muscles?.length) {
      return editingItem.muscles
    }

    return extractKeys(editingExercise || {}, MUSCLE_FIELD_CANDIDATES)
  }, [editingItem, editingExercise])

  useEffect(() => {
    if (isTitleEditing) {
      window.requestAnimationFrame(() => {
        titleInputRef.current?.focus()
        titleInputRef.current?.select()
      })
    }
  }, [isTitleEditing])

  useEffect(() => {
    if (!openMenuItemId) {
      return undefined
    }

    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuItemId('')
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [openMenuItemId])

  const clearHold = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const setExercises = (exercises) => onPlanChange({ ...plan, exercises })

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

  const updateItemSets = (itemId, updater) => {
    setExercises(plan.exercises.map((item) => {
      if (item.id !== itemId) {
        return item
      }

      const nextSets = typeof updater === 'function' ? updater(item.sets || []) : updater
      return { ...item, sets: nextSets }
    }))
  }

  const reorderExercises = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) {
      return
    }

    const list = [...plan.exercises]
    const fromIndex = list.findIndex((item) => item.id === fromId)
    const toIndex = list.findIndex((item) => item.id === toId)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }

    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    setExercises(list)
  }

  const resetGesture = () => {
    gestureRef.current = { ...EMPTY_GESTURE }
  }

  if (exerciseItemId) {
    if (!editingItem) {
      return (
        <section className="screen planner-exercise-editor-screen">
          <p>Exercise not found.</p>
          <button type="button" className="ghost" onClick={() => navigate('/planner')}>Back to plan</button>
        </section>
      )
    }

    return (
      <section className="screen planner-exercise-editor-screen">
        <div className="exercise-editor-top-row">
          <button
            type="button"
            className="ghost"
            onClick={() => navigate('/planner')}
            aria-label="Back to plan"
          >
            <Icon name="arrow_back" />
          </button>
        </div>

        <PlanMuscleHeatmapSVG
          svgPath={getPublicAssetUrl('svg/muscle-groups.svg')}
          intensities={Object.fromEntries(editingMuscles.map((group) => [normalizeKey(group), 1]))}
          className="plan-editor-heatmap exercise-editor-heatmap"
        />

        <h2 className="exercise-editor-title">{toTitleCase(editingItem.exerciseName)}</h2>

        <div className="exercise-editor-content">
          <div className="sets-table">
            <div className="sets-header sets-grid-extended centered-headers">
              <span>Set #</span>
              <span>Reps</span>
              <span>Weight</span>
              <span>Rest</span>
              <span />
            </div>
            {(editingItem.sets || []).map((setRow, index) => (
              <div key={setRow.id || `${editingItem.id}-set-${index + 1}`} className="set-row sets-grid-extended">
                <span className="set-index">{index + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="field-button"
                  value={setRow.reps}
                  min={0}
                  step={1}
                  aria-label={`Set ${index + 1} reps`}
                  onChange={(event) => updateItemSets(editingItem.id, (sets) => sets.map((entry, rowIndex) => (
                    rowIndex === index ? { ...entry, reps: clampValue('reps', event.target.value) } : entry
                  )))}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  className="field-button"
                  value={setRow.weight}
                  min={0}
                  step={0.5}
                  aria-label={`Set ${index + 1} weight`}
                  onChange={(event) => updateItemSets(editingItem.id, (sets) => sets.map((entry, rowIndex) => (
                    rowIndex === index ? { ...entry, weight: clampValue('weight', event.target.value) } : entry
                  )))}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  className="field-button"
                  value={setRow.restSec}
                  min={0}
                  step={5}
                  aria-label={`Set ${index + 1} rest in seconds`}
                  onChange={(event) => updateItemSets(editingItem.id, (sets) => sets.map((entry, rowIndex) => (
                    rowIndex === index ? { ...entry, restSec: clampValue('restSec', event.target.value) } : entry
                  )))}
                />
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Delete set ${index + 1}`}
                  onClick={() => updateItemSets(editingItem.id, (sets) => sets.filter((_, rowIndex) => rowIndex !== index))}
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
              const sets = editingItem.sets || []
              const last = sets[sets.length - 1] || FALLBACK_SET
              updateItemSets(editingItem.id, [...sets, { id: createId('set'), reps: last.reps, weight: last.weight, restSec: last.restSec }])
            }}
          >
            + Add set
          </button>
        </div>

        <button
          type="button"
          className="fab done-fab"
          onClick={() => navigate('/planner')}
          aria-label="Done"
        >
          <Icon name="check" />
        </button>
      </section>
    )
  }

  return (
    <section className="screen planner-screen">
      <PlanMuscleHeatmapSVG
        svgPath={getPublicAssetUrl('svg/muscle-groups.svg')}
        intensities={intensities}
        className="plan-editor-heatmap"
      />

      {isTitleEditing ? (
        <input
          ref={titleInputRef}
          className="plan-name-input filled-plan-name"
          value={plan.name}
          onChange={(event) => onPlanChange({ ...plan, name: event.target.value })}
          onBlur={() => setIsTitleEditing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.currentTarget.blur()
            }
          }}
          aria-label="Plan Name"
        />
      ) : (
        <button
          type="button"
          className="plan-name-input filled-plan-name plan-name-display"
          onClick={() => setIsTitleEditing(true)}
          aria-label="Edit plan name"
        >
          {plan.name || 'New Plan'}
        </button>
      )}

      <div className="plan-items scroll-safe-list plans-grid-padded">
        {plan.exercises.map((item) => {
          const isDragging = draggingItemId === item.id
          const isDragTarget = dragOverItemId === item.id && draggingItemId && draggingItemId !== item.id

          return (
            <article key={item.id} className={`plan-item-shell ${isDragTarget ? 'drag-target' : ''}`.trim()}>
              <div
                className={`plan-item-row plan-item-touch ${isDragging ? 'dragging' : ''}`.trim()}
                onPointerDown={(event) => {
                  if (event.button !== 0) {
                    return
                  }

                  gestureRef.current = {
                    id: item.id,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                    holdReady: false,
                    mode: '',
                  }

                  clearHold()
                  holdTimerRef.current = window.setTimeout(() => {
                    gestureRef.current.holdReady = true
                  }, 320)
                }}
                onPointerMove={(event) => {
                  if (gestureRef.current.pointerId !== event.pointerId || gestureRef.current.id !== item.id) {
                    return
                  }

                  const deltaX = event.clientX - gestureRef.current.startX
                  const deltaY = event.clientY - gestureRef.current.startY
                  if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
                    gestureRef.current.moved = true
                  }

                  if (draggingItemId === item.id) {
                    clearHold()
                    const nearest = plan.exercises.reduce((best, entry) => {
                      const node = document.querySelector(`[data-plan-item-id="${entry.id}"]`)
                      if (!node) {
                        return best
                      }
                      const rect = node.getBoundingClientRect()
                      const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - event.clientY)
                      if (!best || centerDistance < best.distance) {
                        return { id: entry.id, distance: centerDistance }
                      }
                      return best
                    }, null)
                    if (nearest?.id) {
                      setDragOverItemId(nearest.id)
                    }
                    return
                  }

                  if (!gestureRef.current.holdReady) {
                    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
                      clearHold()
                    }
                    return
                  }

                  if (!gestureRef.current.mode && Math.abs(deltaY) > 8 && Math.abs(deltaY) >= Math.abs(deltaX)) {
                    gestureRef.current.mode = 'drag'
                    setDraggingItemId(item.id)
                    setDragOverItemId(item.id)
                    clearHold()
                  }
                }}
                onPointerUp={(event) => {
                  if (gestureRef.current.pointerId !== event.pointerId || gestureRef.current.id !== item.id) {
                    return
                  }

                  clearHold()

                  if (draggingItemId === item.id) {
                    reorderExercises(item.id, dragOverItemId)
                    setDraggingItemId('')
                    setDragOverItemId('')
                    resetGesture()
                    return
                  }

                  if (!gestureRef.current.moved) {
                    navigate(`/planner/exercise/${item.id}`)
                    setOpenMenuItemId('')
                  }

                  resetGesture()
                }}
                onPointerLeave={clearHold}
                onPointerCancel={() => {
                  clearHold()
                  resetGesture()
                }}
                data-plan-item-id={item.id}
              >
                <div>
                  <strong>{toTitleCase(item.exerciseName)}</strong>
                  <small>{(item.sets || []).length} sets</small>
                </div>
                <div className="kebab-wrap" ref={openMenuItemId === item.id ? menuRef : null}>
                  <button
                    type="button"
                    className="ghost kebab-button"
                    aria-label={`Exercise menu for ${item.exerciseName}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpenMenuItemId((current) => (current === item.id ? '' : item.id))
                    }}
                  >
                    <Icon name="more_vert" />
                  </button>

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
          )
        })}
      </div>

      <div className="add-exercise-wrap">
        <button type="button" className="ghost add-exercise-full" onClick={() => setIsAddOpen(true)} aria-label="Add exercise">
          <Icon name="add" />
          <span>Add exercise</span>
        </button>
      </div>

      <button
        type="button"
        className="fab start-plan-fab"
        onClick={() => onStartWorkout?.(plan)}
        aria-label={`Start ${plan.name}`}
      >
        <Icon name="play_arrow" />
      </button>

      <AddExerciseModal
        isOpen={isAddOpen}
        allExercises={allExercises}
        onClose={() => setIsAddOpen(false)}
        onSelectExercise={(exercise) => {
          addExercise(exercise)
          setIsAddOpen(false)
        }}
      />
    </section>
  )
}
