import { useState } from 'react'
import { toTitleCase } from '../utils/label'
import AddExerciseModal from '../components/AddExerciseModal'

export default function Planner({ plan, savedExercises, onPlanNameChange, onAddExercise, onDeleteItem, onEditItem, onDone }) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState('')

  return (
    <section className="screen planner-screen">
      <input
        className="plan-name-input"
        value={plan.name}
        onChange={(event) => onPlanNameChange(event.target.value)}
        aria-label="Plan Name"
      />

      <div className="plan-items">
        {plan.items.map((item) => (
          <article key={item.id} className="plan-item-row">
            <span>{toTitleCase(item.exerciseName)}</span>
            <div className="kebab-wrap">
              <button type="button" className="text-button kebab-button" onClick={() => setOpenMenuId((id) => (id === item.id ? '' : item.id))}>⋯</button>
              {openMenuId === item.id ? (
                <div className="kebab-menu">
                  <button type="button" onClick={() => { setOpenMenuId(''); onEditItem(item.id) }}>Edit</button>
                  <button type="button" onClick={() => { setOpenMenuId(''); onDeleteItem(item.id) }}>Delete</button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="add-exercise-wrap">
        <button type="button" className="circle-add" onClick={() => setIsAddOpen(true)}>+</button>
      </div>

      <button type="button" className="fab done-fab" onClick={onDone} aria-label="Done">✓</button>

      <AddExerciseModal
        isOpen={isAddOpen}
        exercises={savedExercises}
        onClose={() => setIsAddOpen(false)}
        onSelectExercise={(exercise) => {
          onAddExercise(exercise)
          setIsAddOpen(false)
        }}
      />
    </section>
  )
}
