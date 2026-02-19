import { useState } from 'react'
import Icon from '../components/Icon'

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

export default function Home({
  isAuthenticated,
  plans,
  loading,
  onSignIn,
  onCreatePlan,
  onOpenPlan,
  onRenamePlan,
  onDeletePlan,
}) {
  const [openMenuId, setOpenMenuId] = useState('')

  if (!isAuthenticated) {
    return (
      <section className="screen home-signin-screen">
        <button type="button" onClick={onSignIn}>Sign in</button>
      </section>
    )
  }

  return (
    <section className="screen">
      <div className="planner-results home-list scroll-safe-list">
        {loading ? <p>Loading…</p> : null}

        {!loading && plans.map((plan) => (
          <article key={plan.id} className="planner-list-item home-plan-card">
            <button type="button" className="plan-open-button" onClick={() => onOpenPlan(plan.id)}>
              <span>{plan.name}</span>
              <small>{plan.exercises.length} exercises • Updated {formatDate(plan.updatedAt)}</small>
            </button>

            <div className="kebab-wrap">
              <button type="button" className="text-button kebab-button" onClick={() => setOpenMenuId((value) => (value === plan.id ? '' : plan.id))} aria-label="Plan options">
                <Icon name="more_vert" />
              </button>
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

      <button type="button" className="fab" onClick={onCreatePlan} aria-label="Create workout plan">
        <Icon name="add" />
      </button>
    </section>
  )
}
