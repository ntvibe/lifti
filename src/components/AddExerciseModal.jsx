import { useMemo, useState } from 'react'
import MuscleMap from './MuscleMap'
import TagToggleList from './TagToggleList'
import { listEquipmentOptions } from '../services/exerciseCatalog'
import { toTitleCase } from '../utils/label'

function toggleSetValue(currentSet, value) {
  const next = new Set(currentSet)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }

  return next
}

export default function AddExerciseModal({ isOpen, exercises, onClose, onSelectExercise }) {
  const [search, setSearch] = useState('')
  const [selectedGroups, setSelectedGroups] = useState([])
  const [muscleGroups, setMuscleGroups] = useState([])
  const [selectedEquipment, setSelectedEquipment] = useState(() => new Set())
  const [equipmentOpen, setEquipmentOpen] = useState(false)

  const selectedMuscles = useMemo(() => new Set(selectedGroups), [selectedGroups])
  const equipmentOptions = useMemo(() => listEquipmentOptions(exercises), [exercises])

  const filteredExercises = useMemo(() => exercises.filter((exercise) => {
    const matchesName = exercise.name.toLowerCase().includes(search.toLowerCase())
    const matchesEquipment = !selectedEquipment.size || exercise.equipment.some((item) => selectedEquipment.has(item))
    const matchesMuscles = !selectedMuscles.size || exercise.primaryMuscles.some((muscle) => selectedMuscles.has(muscle))

    return matchesName && matchesEquipment && matchesMuscles
  }), [exercises, search, selectedEquipment, selectedMuscles])

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

        <div className="planner-results">
          {filteredExercises.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              className="planner-list-item"
              onClick={() => onSelectExercise(exercise)}
            >
              <span>{toTitleCase(exercise.name)}</span>
              <small>Muscles: {exercise.primaryMuscles.map(toTitleCase).join(', ')}</small>
            </button>
          ))}
          {!filteredExercises.length ? <p className="status">No exercises match current filters.</p> : null}
        </div>
      </section>
    </div>
  )
}
