import { useMemo, useRef, useState } from 'react'
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

export default function WorkoutPlanner({ plan, allExercises, onPlanChange, onDone, onStartWorkout }) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState('')
  const [contextItemId, setContextItemId] = useState('')
  const holdTimerRef = useRef(null)

  const activeEditItem = useMemo(() => plan.exercises.find((item) => item.id === editingItemId) || null, [plan.exercises, editingItemId])
  const activeExercise = useMemo(() => allExercises.find((exercise) => exercise.id === activeEditItem?.exerciseId), [allExercises, activeEditItem])
  const intensities = useMemo(() => computePlanMuscleIntensities(plan.exercises, allExercises), [plan.exercises, allExercises])

  const addExercise = (exercise) => {
    const item = {
      id: createId('item'),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscles: extractKeys(exercise, MUSCLE_FIELD_CANDIDATES),
      equipment: extractKeys(exercise, EQUIPMENT_FIELD_CANDIDATES),
      sets: createDefaultSets(exercise),
    }

    onPlanChange({ ...plan, exercises: [...plan.exercises, item] })
    setEditingItemId(item.id)
  }

  const updateItemSets = (itemId, sets) => {
    onPlanChange({ ...plan, exercises: plan.exercises.map((item) => (item.id === itemId ? { ...item, sets } : item)) })
  }

  const clearHold = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
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
        {plan.exercises.map((item) => (
          <article
            key={item.id}
            className="plan-item-row plan-item-touch"
            onPointerDown={() => {
              clearHold()
              holdTimerRef.current = window.setTimeout(() => setContextItemId(item.id), 350)
            }}
            onPointerUp={() => {
              const isContextOpen = contextItemId === item.id
              clearHold()
              if (!isContextOpen) {
                setEditingItemId(item.id)
              }
            }}
            onPointerLeave={clearHold}
          >
            <div>
              <strong>{toTitleCase(item.exerciseName)}</strong>
              <small>{item.sets.length} sets</small>
              <small>{item.muscles.map(titleCaseLabel).join(', ')}</small>
            </div>

            {contextItemId === item.id ? (
              <div className="inline-card-actions" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setContextItemId('')
                    if (window.confirm('Delete this exercise?')) {
                      onPlanChange({ ...plan, exercises: plan.exercises.filter((entry) => entry.id !== item.id) })
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </article>
        ))}
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

      <ExerciseEditorModal
        isOpen={Boolean(activeEditItem)}
        item={activeEditItem}
        exercise={activeExercise}
        onClose={() => setEditingItemId('')}
        onSave={(sets) => {
          if (!activeEditItem) {
            return
          }

          updateItemSets(activeEditItem.id, sets)
        }}
      />
    </section>
  )
}
