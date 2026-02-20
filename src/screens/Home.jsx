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

function LoadingSkeletons() {
  return (
    <div className="planner-results home-list scroll-safe-list plans-grid-padded">
      {[1, 2, 3].map((entry) => (
        <article key={entry} className="modern-plan-card glass loading-skeleton" aria-hidden="true" />
      ))}
    </div>
  )
}

export default function Home({
  authStatus,
  plans,
  allExercises,
  driveStatus,
  driveError,
  onRetry,
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

  if (authStatus !== 'signed_in') {
    return (
      <section className="screen home-signin-screen select-none">
        <button type="button" className="ghost" onClick={onSignIn}>Sign in</button>
      </section>
    )
  }

  if (driveStatus === 'loading') {
    return <LoadingSkeletons />
  }

  return (
    <section className="screen select-none">
      <div className="planner-results home-list scroll-safe-list plans-grid-padded">
        {driveStatus === 'error' ? (
          <article className="glass drive-error-card">
            <p>Couldn’t load your plans. Tap Retry.</p>
            <button type="button" className="ghost" onClick={onRetry}>Retry</button>
            <details>
              <summary>Details</summary>
              <small>{driveError || 'Unknown Drive error.'}</small>
            </details>
          </article>
        ) : null}

        {driveStatus === 'ready' && plans.map((plan) => (
          <article
            key={plan.id}
            className="planner-list-item home-plan-card modern-plan-card glass"
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

        {driveStatus === 'ready' && !plans.length ? <p className="subtle-empty">No workout plans yet. Tap + to create your first plan.</p> : null}
      </div>

      <button type="button" className="fab select-none" onClick={onCreatePlan} aria-label="Create workout plan">
        +
      </button>
    </section>
  )
}
