import { MUSCLE_GROUPS } from '../constants/muscles'

export function MuscleFilter({ selectedMuscles, onChange }) {
  const handleToggle = (muscleId) => {
    const nextSelection = selectedMuscles.includes(muscleId)
      ? selectedMuscles.filter((id) => id !== muscleId)
      : [...selectedMuscles, muscleId]

    onChange(nextSelection)
  }

  return (
    <section className="muscle-filter" aria-label="Filter exercises by muscles">
      <div className="muscle-filter-list">
        <h2>Muscle Filter</h2>
        {MUSCLE_GROUPS.map((group) => (
          <fieldset key={group.id} className="muscle-group">
            <legend>{group.label}</legend>
            <div className="muscle-options">
              {group.muscles.map((muscle) => (
                <label key={muscle.id} className="muscle-option">
                  <input
                    type="checkbox"
                    checked={selectedMuscles.includes(muscle.id)}
                    onChange={() => handleToggle(muscle.id)}
                  />
                  <span>{muscle.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="muscle-placeholder" aria-label="Muscle visualization placeholder">
        Muscle map placeholder
      </div>
    </section>
  )
}
