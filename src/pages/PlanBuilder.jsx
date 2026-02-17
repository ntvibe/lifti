import { useState } from 'react'
import MuscleMap from '../components/MuscleMap'

export default function PlanBuilder() {
  const [selectedGroups, setSelectedGroups] = useState([])

  const clearSelection = () => {
    setSelectedGroups([])
  }

  return (
    <section className="screen">
      <h1>Plans</h1>
      <p>Create and customize your weekly lifting plan.</p>

      <div className="card muscle-map-card">
        <h2>Target Muscle Groups</h2>
        <MuscleMap value={selectedGroups} onChange={setSelectedGroups} />

        <div className="selected-groups" aria-live="polite">
          {selectedGroups.length > 0
            ? selectedGroups.map((group) => (
                <span className="badge" key={group}>{group}</span>
              ))
            : <p>No muscle groups selected.</p>}
        </div>

        <button type="button" className="ghost" onClick={clearSelection}>Clear Selection</button>
      </div>
    </section>
  )
}
