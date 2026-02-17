import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MuscleMap from '../components/MuscleMap'
import TagToggleList from '../components/TagToggleList'
import { formatLabel, listEquipmentOptions } from '../services/exerciseCatalog'

function toggleSetValue(currentSet, value) {
  const next = new Set(currentSet)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }

  return next
}

export default function Exercises({ exercises, selectedGroups = [], onSelectedGroupsChange = () => {} }) {
  const [search, setSearch] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState(() => new Set())
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const [muscleGroups, setMuscleGroups] = useState([])

  const selectedMuscles = useMemo(() => new Set(selectedGroups), [selectedGroups])

  const equipmentOptions = useMemo(() => listEquipmentOptions(exercises), [exercises])

  const filteredExercises = useMemo(() => exercises.filter((exercise) => {
    const matchesName = exercise.name.toLowerCase().includes(search.toLowerCase())
    const matchesEquipment = !selectedEquipment.size
      || exercise.equipment.some((item) => selectedEquipment.has(item))
    const matchesMuscles = !selectedMuscles.size
      || exercise.primaryMuscles.some((muscle) => selectedMuscles.has(muscle))
      || exercise.secondaryMuscles.some((muscle) => selectedMuscles.has(muscle))

    return matchesName && matchesEquipment && matchesMuscles
  }), [selectedEquipment, exercises, search, selectedMuscles])

  return (
    <section className="screen">
      <h1>Exercises</h1>
      <p>Search and filter the Lifti exercise catalog.</p>

      <div className="card exercise-filters minimal-card">
        <h2>Target Muscle Groups</h2>
        <MuscleMap value={selectedGroups} onChange={onSelectedGroupsChange} onGroupsChange={setMuscleGroups} />

        <div className="filter-header-row">
          <h2>Muscles</h2>
          <button type="button" className="text-button" onClick={() => onSelectedGroupsChange([])}>Clear</button>
        </div>
        <TagToggleList
          items={muscleGroups}
          selectedSet={selectedMuscles}
          onToggle={(value) => onSelectedGroupsChange(Array.from(toggleSetValue(selectedMuscles, value)))}
        />

        <div className="search-row">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exercises"
          />
          {search ? (
            <button type="button" className="text-button clear-search" onClick={() => setSearch('')}>
              Clear
            </button>
          ) : null}
        </div>

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
      </div>

      <div className="exercise-grid">
        {filteredExercises.map((exercise) => (
          <Link key={exercise.id} to={`/exercises/${exercise.id}`} className="card exercise-card-link">
            <article className="exercise-card">
              <h3>{formatLabel(exercise.name)}</h3>
              <div className="badges">
                <span className="badge">{formatLabel(exercise.trackMode)}</span>
                {exercise.equipment.map((item) => <span key={`${exercise.id}-${item}`} className="badge">{formatLabel(item)}</span>)}
              </div>
              <p><strong>Primary:</strong> {exercise.primaryMuscles.map(formatLabel).join(', ')}</p>
            </article>
          </Link>
        ))}
      </div>

      {!filteredExercises.length ? <p className="status">No exercises match this filter.</p> : null}
    </section>
  )
}
