import { useState } from 'react'

function formatDate(value) {
  if (!value) {
    return 'Unknown update'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown update'
  }

  return date.toLocaleDateString()
}

export default function Home({ plans, loading, onCreatePlan, onOpenPlan, onRenamePlan, onDeletePlan }) {
  const [openMenuId, setOpenMenuId] = useState('')

  return (
    <section className="screen">
      <h1>Home</h1>
      <p>Your workout plans.</p>

      <div className="planner-results home-list">
        {loading ? <p>Loading…</p> : null}

        {!loading && plans.map((plan) => (
          <article key={plan.id} className="planner-list-item home-plan-card">
            <button type="button" className="plan-open-button" onClick={() => onOpenPlan(plan.id)}>
              <span>{plan.name}</span>
              <small>{plan.items.length} exercises • Updated {formatDate(plan.updatedAt)}</small>
            </button>

            <div className="kebab-wrap">
              <button type="button" className="text-button kebab-button" onClick={() => setOpenMenuId((value) => (value === plan.id ? '' : plan.id))}>⋯</button>
              {openMenuId === plan.id ? (
                <div className="kebab-menu">
                  <button
                    type="button"
                    onClick={() => {
                      const nextName = window.prompt('Rename plan', plan.name)
                      setOpenMenuId('')
                      if (nextName !== null) {
                        onRenamePlan(plan.id, nextName)
                      }
                    }}
                  >
                    Rename
                  </button>
                  <button type="button" onClick={() => { setOpenMenuId(''); onDeletePlan(plan.id) }}>Delete</button>
                </div>
              ) : null}
            </div>
          </article>
        ))}

        {!loading && !plans.length ? <p>No workout plans yet.</p> : null}
      </div>

      <button type="button" className="fab" onClick={onCreatePlan} aria-label="Create workout plan">+</button>
    </section>
  )
}
