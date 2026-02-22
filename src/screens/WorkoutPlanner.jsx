import { useMemo, useRef, useState } from 'react'
import { normalizeKey, titleCaseLabel } from '../utils/normalize'
import { toTitleCase } from '../utils/label'
import { getPublicAssetUrl } from '../services/exerciseCatalog'
import AddExerciseModal from '../components/AddExerciseModal'
import { createDefaultSets } from '../components/ExerciseEditorModal'
import PlanMuscleHeatmapSVG from '../components/PlanMuscleHeatmapSVG'
import { computePlanMuscleIntensities } from '../utils/planIntensity'
import Icon from '../components/Icon'

const MUSCLE_FIELD_CANDIDATES = ['primaryMuscles', 'muscles', 'muscleGroups', 'muscleGroup', 'targetMuscles', 'targets']
const EQUIPMENT_FIELD_CANDIDATES = ['equipment', 'equipments', 'gear', 'machine']
const SWIPE_REVEAL_PX = 86

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

function clampSetValue(field, value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  if (field === 'weight') {
    return Math.max(0, Math.round(parsed * 100) / 100)
  }

  return Math.max(0, Math.round(parsed))
}

export default function WorkoutPlanner({ plan, allExercises, onPlanChange, onDone, onStartWorkout }) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [expandedItemIds, setExpandedItemIds] = useState(() => new Set())
  const [revealedItemId, setRevealedItemId] = useState('')
  const [swipeOffset, setSwipeOffset] = useState({ id: '', x: 0 })
  const [draggingItemId, setDraggingItemId] = useState('')
  const [dragOverItemId, setDragOverItemId] = useState('')
  const holdTimerRef = useRef(null)
  const gestureRef = useRef({ id: '', pointerId: null, startX: 0, startY: 0, moved: false, swiping: false })

  const intensities = useMemo(() => computePlanMuscleIntensities(plan.exercises, allExercises), [plan.exercises, allExercises])

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
    setExpandedItemIds((current) => new Set(current).add(item.id))
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

  const toggleExpanded = (itemId) => {
    setExpandedItemIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  return (
    <section className="screen planner-screen">
      <input
        className="plan-name-input filled-plan-name"
        value={plan.name}
        onChange={(event) => onPlanChange({ ...plan, name: event.target.value })}
        aria-label="Plan Name"
      />

      <PlanMuscleHeatmapSVG
        svgPath={getPublicAssetUrl('svg/muscle-groups.svg')}
        intensities={intensities}
        className="plan-editor-heatmap"
      />

      <div className="add-exercise-wrap">
        <button type="button" className="circle-add" onClick={() => setIsAddOpen(true)} aria-label="Add exercise">+</button>
      </div>

      <div className="plan-items scroll-safe-list plans-grid-padded">
        {plan.exercises.map((item) => {
          const isExpanded = expandedItemIds.has(item.id)
          const isRevealed = revealedItemId === item.id
          const rowOffset = swipeOffset.id === item.id ? swipeOffset.x : (isRevealed ? -SWIPE_REVEAL_PX : 0)
          const isDragging = draggingItemId === item.id
          const isDragTarget = dragOverItemId === item.id && draggingItemId && draggingItemId !== item.id

          return (
            <article key={item.id} className={`plan-item-shell ${isDragTarget ? 'drag-target' : ''}`}>
              <button
                type="button"
                className="plan-item-delete"
                onClick={() => {
                  if (window.confirm('Delete this exercise?')) {
                    setExercises(plan.exercises.filter((entry) => entry.id !== item.id))
                    setRevealedItemId('')
                  }
                }}
              >
                Delete
              </button>

              <div
                className={`plan-item-row plan-item-touch ${isDragging ? 'dragging' : ''}`}
                style={{ transform: `translateX(${rowOffset}px)` }}
                onPointerDown={(event) => {
                  gestureRef.current = {
                    id: item.id,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                    swiping: false,
                  }
                  clearHold()
                  holdTimerRef.current = window.setTimeout(() => {
                    setDraggingItemId(item.id)
                    setDragOverItemId(item.id)
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

                  if (draggingItemId) {
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

                  if (!gestureRef.current.swiping && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
                    gestureRef.current.swiping = true
                    clearHold()
                  }

                  if (gestureRef.current.swiping) {
                    setSwipeOffset({ id: item.id, x: Math.max(-SWIPE_REVEAL_PX, Math.min(0, deltaX)) })
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
                    setSwipeOffset({ id: '', x: 0 })
                    gestureRef.current = { id: '', pointerId: null, startX: 0, startY: 0, moved: false, swiping: false }
                    return
                  }

                  if (gestureRef.current.swiping) {
                    const shouldReveal = (swipeOffset.id === item.id ? swipeOffset.x : 0) <= -SWIPE_REVEAL_PX / 2
                    setRevealedItemId(shouldReveal ? item.id : '')
                    setSwipeOffset({ id: '', x: 0 })
                    gestureRef.current = { id: '', pointerId: null, startX: 0, startY: 0, moved: false, swiping: false }
                    return
                  }

                  if (!gestureRef.current.moved) {
                    if (revealedItemId && revealedItemId !== item.id) {
                      setRevealedItemId('')
                    } else {
                      toggleExpanded(item.id)
                    }
                  }

                  gestureRef.current = { id: '', pointerId: null, startX: 0, startY: 0, moved: false, swiping: false }
                }}
                onPointerLeave={() => {
                  clearHold()
                }}
                data-plan-item-id={item.id}
              >
                <div>
                  <strong>{toTitleCase(item.exerciseName)}</strong>
                  <small>{item.sets.length} sets</small>
                  <small>{item.muscles.map(titleCaseLabel).join(', ')}</small>
                </div>
                <Icon name="drag_indicator" />
              </div>

              {isExpanded ? (
                <div className="plan-item-expanded">
                  {(item.sets || []).map((setRow, index) => (
                    <div key={setRow.id || `${item.id}-set-${index + 1}`} className="plan-inline-set-row">
                      <span className="set-index">{index + 1}</span>
                      {['reps', 'weight', 'restSec'].map((field) => (
                        <label key={field}>
                          <small>{field === 'restSec' ? 'rest' : field}</small>
                          <input
                            type="number"
                            value={setRow[field]}
                            onChange={(event) => {
                              const value = clampSetValue(field, event.target.value)
                              updateItemSets(item.id, (currentSets) => currentSets.map((set, setIndex) => (
                                setIndex === index ? { ...set, [field]: value } : set
                              )))
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      <button type="button" className="fab done-fab" onClick={onDone} aria-label="Done">✓</button>
      <button
        type="button"
        className="fab play-fab"
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
