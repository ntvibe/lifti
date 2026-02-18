import { useMemo, useState } from 'react'

function getDefaultSets() {
  return [
    { reps: '', weight: '', restSec: '' },
    { reps: '', weight: '', restSec: '' },
    { reps: '', weight: '', restSec: '' },
  ]
}

export default function ExerciseEditor({ planItem, onSave, onCancel }) {
  const isWeights = (planItem?.exerciseType || 'weights') === 'weights'
  const [sets, setSets] = useState(() => planItem?.sets?.length ? planItem.sets : getDefaultSets())

  const title = useMemo(() => planItem?.exerciseName || 'Exercise', [planItem])

  if (!planItem) {
    return (
      <section className="screen">
        <p>Exercise item not found.</p>
      </section>
    )
  }

  if (!isWeights) {
    return (
      <section className="screen">
        <h1>{title}</h1>
        <p>Editor for this exercise type is coming soon.</p>
        <button type="button" className="fab done-fab" onClick={onCancel} aria-label="Back">←</button>
      </section>
    )
  }

  return (
    <section className="screen editor-screen">
      <h1>{title}</h1>
      <div className="sets-table">
        <div className="sets-header">
          <span>Reps</span>
          <span>Weight</span>
          <span>Rest</span>
        </div>

        {sets.map((setRow, index) => (
          <div className="set-row" key={`set-${index + 1}`}>
            <input
              type="number"
              inputMode="numeric"
              value={setRow.reps}
              onChange={(event) => setSets((current) => current.map((item, rowIndex) => (rowIndex === index ? { ...item, reps: event.target.value === '' ? '' : Number(event.target.value) } : item)))}
              placeholder="Reps"
            />
            <input
              type="number"
              inputMode="decimal"
              value={setRow.weight}
              onChange={(event) => setSets((current) => current.map((item, rowIndex) => (rowIndex === index ? { ...item, weight: event.target.value === '' ? '' : Number(event.target.value) } : item)))}
              placeholder="Weight"
            />
            <input
              type="number"
              inputMode="numeric"
              value={setRow.restSec}
              onChange={(event) => setSets((current) => current.map((item, rowIndex) => (rowIndex === index ? { ...item, restSec: event.target.value === '' ? '' : Number(event.target.value) } : item)))}
              placeholder="Rest"
            />
          </div>
        ))}
      </div>

      <button type="button" className="ghost" onClick={() => setSets((current) => [...current, { reps: '', weight: '', restSec: '' }])}>+ Add Set</button>
      <button type="button" className="fab done-fab" onClick={() => onSave(sets)} aria-label="Save">✓</button>
    </section>
  )
}
