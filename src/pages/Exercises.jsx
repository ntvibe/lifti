import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MUSCLE_OPTIONS, formatLabel, listEquipmentOptions } from '../services/exerciseCatalog'

function toggleSelection(current, value) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
}

function Chips({ items, selectedItems, onToggle }) {
  return (
    <div className="chips">
      {items.map((item) => {
        const key = typeof item === 'string' ? item : item.id
        const label = typeof item === 'string' ? formatLabel(item) : item.label
        const isSelected = selectedItems.includes(key)

        return (
          <button key={key} type="button" className={`chip ${isSelected ? 'selected' : ''}`} onClick={() => onToggle(key)}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function Exercises({ exercises }) {
  const [search, setSearch] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState([])
  const [muscleFilter, setMuscleFilter] = useState([])

  const equipmentOptions = useMemo(() => listEquipmentOptions(exercises), [exercises])

  const filteredExercises = useMemo(() => exercises.filter((exercise) => {
    const matchesName = exercise.name.toLowerCase().includes(search.toLowerCase())
    const matchesEquipment = !equipmentFilter.length
      || equipmentFilter.some((item) => exercise.equipment.includes(item))
    const matchesMuscles = !muscleFilter.length
      || muscleFilter.some((muscle) => exercise.primaryMuscles.includes(muscle) || exercise.secondaryMuscles.includes(muscle))

    return matchesName && matchesEquipment && matchesMuscles
  }), [equipmentFilter, exercises, muscleFilter, search])

  return (
    <section className="screen">
      <h1>Exercises</h1>
      <p>Search and filter the Lifti exercise catalog.</p>

      <div className="card exercise-filters">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search exercises"
        />
        <h2>Equipment</h2>
        <Chips items={equipmentOptions} selectedItems={equipmentFilter} onToggle={(value) => setEquipmentFilter((current) => toggleSelection(current, value))} />
        <h2>Muscles</h2>
        <Chips items={MUSCLE_OPTIONS} selectedItems={muscleFilter} onToggle={(value) => setMuscleFilter((current) => toggleSelection(current, value))} />
      </div>

      <div className="exercise-grid">
        {filteredExercises.map((exercise) => (
          <article key={exercise.id} className="card exercise-card">
            <h3>{exercise.name}</h3>
            <div className="badges">
              {exercise.equipment.map((item) => <span key={`${exercise.id}-${item}`} className="badge">{formatLabel(item)}</span>)}
            </div>
            <p><strong>Primary:</strong> {exercise.primaryMuscles.map(formatLabel).join(', ')}</p>
            <Link to={`/exercises/${exercise.id}`}>View details</Link>
          </article>
        ))}
      </div>

      {!filteredExercises.length ? <p className="status">No exercises match this filter.</p> : null}
    </section>
  )
}
