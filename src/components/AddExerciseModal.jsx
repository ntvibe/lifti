import { useEffect, useMemo, useState } from 'react'
import MuscleMap from './MuscleMap'
import TagToggleList from './TagToggleList'
import { titleCaseLabel, normalizeKey } from '../utils/normalize'

const MUSCLE_FIELD_CANDIDATES = [
  'primaryMuscles',
  'muscles',
  'muscleGroups',
  'muscleGroup',
  'targetMuscles',
  'targets',
]

const EQUIPMENT_FIELD_CANDIDATES = [
  'equipment',
  'equipments',
  'gear',
  'machine',
]

function toggleSetValue(currentSet, value) {
  const normalizedValue = normalizeKey(value)
  const next = new Set(currentSet)

  if (next.has(normalizedValue)) {
    next.delete(normalizedValue)
  } else {
    next.add(normalizedValue)
  }

  return next
}

function normalizeAsArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    return [value]
  }

  return []
}

function getFirstNormalizedValues(exercise, candidates) {
  for (const fieldName of candidates) {
    const normalizedValues = normalizeAsArray(exercise[fieldName])
      .map((item) => normalizeKey(item))
      .filter(Boolean)

    if (normalizedValues.length) {
      return normalizedValues
    }
  }

  return []
}

function getExerciseMuscles(exercise) {
  return getFirstNormalizedValues(exercise, MUSCLE_FIELD_CANDIDATES)
}

function getExerciseEquipment(exercise) {
  return getFirstNormalizedValues(exercise, EQUIPMENT_FIELD_CANDIDATES)
}

function formatExerciseName(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ')
}

export default function AddExerciseModal({ isOpen, allExercises = [], onClose, onSelectExercise }) {
  const [search, setSearch] = useState('')
  const [selectedGroups, setSelectedGroups] = useState([])
  const [muscleGroups, setMuscleGroups] = useState([])
  const [selectedEquipment, setSelectedEquipment] = useState(() => new Set())
  const [equipmentOpen, setEquipmentOpen] = useState(false)

  const selectedMuscles = useMemo(() => new Set((selectedGroups || []).map((group) => normalizeKey(group))), [selectedGroups])

  const equipmentOptions = useMemo(() => {
    const values = new Set()
    allExercises.forEach((exercise) => {
      getExerciseEquipment(exercise).forEach((item) => values.add(item))
    })

    return [...values].sort((a, b) => titleCaseLabel(a).localeCompare(titleCaseLabel(b)))
  }, [allExercises])

  const filteredExercises = useMemo(() => allExercises.filter((exercise) => {
    const normalizedMuscles = getExerciseMuscles(exercise)
    const normalizedEquipment = getExerciseEquipment(exercise)

    const matchesName = (exercise.name || '').toLowerCase().includes(search.toLowerCase())
    const matchesMuscles = !selectedMuscles.size
      || normalizedMuscles.some((muscle) => selectedMuscles.has(muscle))
    const matchesEquipment = !selectedEquipment.size
      || normalizedEquipment.some((item) => selectedEquipment.has(item))

    return matchesName && matchesMuscles && matchesEquipment
  }), [allExercises, search, selectedMuscles, selectedEquipment])

  useEffect(() => {
    if (!isOpen || filteredExercises.length || !allExercises.length) {
      return
    }

    const sample = allExercises.slice(0, 3).map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      normalizedMuscles: getExerciseMuscles(exercise),
      normalizedEquipment: getExerciseEquipment(exercise),
    }))

    // temporary debug logging for filter field diagnostics
    console.info('AddExerciseModal empty results debug:', sample)
  }, [allExercises, filteredExercises, isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="filter-header-row">
          <h2>Add Exercise</h2>
          <button type="button" className="text-button" onClick={onClose}>Close</button>
        </div>

        <div className="search-row">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exercises"
          />
        </div>

        <MuscleMap value={selectedGroups} onChange={setSelectedGroups} onGroupsChange={setMuscleGroups} />

        <div className="filter-header-row">
          <h2>Muscles</h2>
          <button type="button" className="text-button" onClick={() => setSelectedGroups([])}>Clear</button>
        </div>

        <TagToggleList
          items={muscleGroups}
          selectedSet={selectedMuscles}
          onToggle={(value) => setSelectedGroups(Array.from(toggleSetValue(selectedMuscles, value)))}
        />

        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setEquipmentOpen((open) => !open)}
          aria-expanded={equipmentOpen}
        >
          <span>Equipment</span>
          <span aria-hidden="true">{equipmentOpen ? '▾' : '▸'}</span>
        </button>

        {equipmentOpen ? (
          <TagToggleList
            items={equipmentOptions}
            selectedSet={selectedEquipment}
            onToggle={(value) => setSelectedEquipment((current) => toggleSetValue(current, value))}
          />
        ) : null}

        <p className="status">Showing {filteredExercises.length} of {allExercises.length} exercises</p>

        <div className="planner-results">
          {filteredExercises.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              className="planner-list-item"
              onClick={() => onSelectExercise(exercise)}
            >
              <span>{formatExerciseName(exercise.name)}</span>
              <small>Muscles: {getExerciseMuscles(exercise).map(titleCaseLabel).join(', ')}</small>
            </button>
          ))}
          {!filteredExercises.length && allExercises.length ? <p className="status">No exercises match current filters.</p> : null}
          {!allExercises.length ? <p className="status">No exercises loaded. Try refreshing the app or reloading the catalog.</p> : null}
        </div>
      </section>
    </div>
  )
}
