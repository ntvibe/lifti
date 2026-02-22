import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeKey, titleCaseLabel } from '../utils/normalize'
import { toTitleCase } from '../utils/label'
import { getPublicAssetUrl } from '../services/exerciseCatalog'
import AddExerciseModal from '../components/AddExerciseModal'
import ExerciseEditorModal, { createDefaultSets } from '../components/ExerciseEditorModal'
import PlanMuscleHeatmapSVG from '../components/PlanMuscleHeatmapSVG'
import { computePlanMuscleIntensities } from '../utils/planIntensity'
import Icon from '../components/Icon'

const MUSCLE_FIELD_CANDIDATES = ['primaryMuscles', 'muscles', 'muscleGroups', 'muscleGroup', 'targetMuscles', 'targets']
const EQUIPMENT_FIELD_CANDIDATES = ['equipment', 'equipments', 'gear', 'machine']
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

export default function WorkoutPlanner({ plan, allExercises, onPlanChange, onStartWorkout }) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  const [editingItemId, setEditingItemId] = useState('')
  const [openMenuItemId, setOpenMenuItemId] = useState('')
  const [draggingItemId, setDraggingItemId] = useState('')
  const [dragOverItemId, setDragOverItemId] = useState('')
  const titleInputRef = useRef(null)
  const menuRef = useRef(null)
  const holdTimerRef = useRef(null)
  const gestureRef = useRef(EMPTY_GESTURE)

  const intensities = useMemo(() => computePlanMuscleIntensities(plan.exercises, allExercises), [plan.exercises, allExercises])
  const exerciseById = useMemo(() => new Map((allExercises || []).map((exercise) => [exercise.id, exercise])), [allExercises])
  const editingItem = plan.exercises.find((item) => item.id === editingItemId) || null
  const editingExercise = editingItem ? exerciseById.get(editingItem.exerciseId) : null

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
            <article key={item.id} className={`plan-item-shell ${isDragTarget ? 'drag-target' : ''}`}>
              <div
                className={`plan-item-row plan-item-touch ${isDragging ? 'dragging' : ''}`}
                onPointerDown={(event) => {
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
                    return
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
                    setEditingItemId(item.id)
                    setOpenMenuItemId('')
                  }

                  resetGesture()
                }}
                onPointerLeave={() => {
                  clearHold()
                }}
                onPointerCancel={() => {
                  clearHold()
                  resetGesture()
                }}
                data-plan-item-id={item.id}
              >
                <div>
                  <strong>{toTitleCase(item.exerciseName)}</strong>
                  <small>{(item.sets || []).length} sets</small>
                  <small>{item.muscles.map(titleCaseLabel).join(', ')}</small>
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
                    <Icon name="drag_indicator" />
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
                            if (editingItemId === item.id) {
                              setEditingItemId('')
                            }
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

      <ExerciseEditorModal
        isOpen={Boolean(editingItem)}
        item={editingItem}
        exercise={editingExercise || {}}
        onClose={() => setEditingItemId('')}
        onSave={(nextSets) => {
          if (editingItem) {
            updateItemSets(editingItem.id, nextSets)
          }
        }}
      />
    </section>
  )
}
