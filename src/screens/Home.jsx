import { useMemo, useRef, useState } from 'react'
import { getPublicAssetUrl } from '../services/exerciseCatalog'
import { computePlanMuscleIntensities } from '../utils/planIntensity'
import PlanMuscleHeatmapSVG from '../components/PlanMuscleHeatmapSVG'

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
  allExercises,
  loading,
  onSignIn,
  onCreatePlan,
  onOpenPlan,
  onDeletePlan,
}) {
  const [contextPlanId, setContextPlanId] = useState('')
  const longPressTimerRef = useRef(null)

  const intensitiesByPlanId = useMemo(
    () => Object.fromEntries(plans.map((plan) => [plan.id, computePlanMuscleIntensities(plan.exercises, allExercises)])),
    [plans, allExercises],
  )

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="screen home-signin-screen">
        <button type="button" onClick={onSignIn}>Sign in</button>
      </section>
    )
  }

  return (
    <section className="screen">
      <div className="planner-results home-list scroll-safe-list plans-grid-padded">
        {loading ? <p>Loading…</p> : null}

        {!loading && plans.map((plan) => (
          <article
            key={plan.id}
            className="planner-list-item home-plan-card modern-plan-card"
            onPointerDown={() => {
              clearLongPress()
              longPressTimerRef.current = window.setTimeout(() => {
                setContextPlanId(plan.id)
              }, 350)
            }}
            onPointerUp={() => {
              const isContextOpen = contextPlanId === plan.id
              clearLongPress()
              if (!isContextOpen) {
                onOpenPlan(plan.id)
              }
            }}
            onPointerLeave={clearLongPress}
          >
            <div className="plan-card-content">
              <h3>{plan.name}</h3>
              <small>{plan.exercises.length} exercises • Updated {formatDate(plan.updatedAt)}</small>
              <PlanMuscleHeatmapSVG
                svgPath={getPublicAssetUrl('svg/muscle-groups.svg')}
                intensities={intensitiesByPlanId[plan.id] || {}}
                className="plan-card-heatmap"
              />
            </div>

            {contextPlanId === plan.id ? (
              <div className="inline-card-actions" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setContextPlanId('')
                    if (window.confirm('Delete this plan?')) {
                      onDeletePlan(plan.id)
                    }
                  }}
                >
                  Delete plan
                </button>
              </div>
            ) : null}
          </article>
        ))}

        {!loading && !plans.length ? <p>No workout plans yet.</p> : null}
      </div>

      <button type="button" className="fab" onClick={onCreatePlan} aria-label="Create workout plan">
        +
      </button>
    </section>
  )
}
