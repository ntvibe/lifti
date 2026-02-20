import { useMemo, useRef } from 'react'
import Icon from '../components/Icon'
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
  onOpenPlan,
  onPlayPlan,
  onDeletePlan,
}) {
  const longPressTimerRef = useRef(null)
  const longPressTriggeredRef = useRef(false)

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
            <p>We couldn’t load your plans right now.</p>
            <button type="button" className="ghost" onClick={onRetry}>Retry</button>
            {driveError ? <small>{driveError}</small> : null}
          </article>
        ) : null}

        {driveStatus === 'ready' && plans.map((plan) => (
          <article
            key={plan.id}
            className="planner-list-item home-plan-card modern-plan-card glass"
            onPointerDown={() => {
              clearLongPress()
              longPressTriggeredRef.current = false
              longPressTimerRef.current = window.setTimeout(() => {
                longPressTriggeredRef.current = true
                if (window.confirm(`Delete ${plan.name}?`)) {
                  onDeletePlan(plan.id)
                }
              }, 400)
            }}
            onPointerUp={() => {
              clearLongPress()
              if (!longPressTriggeredRef.current) {
                onOpenPlan(plan.id)
              }
              longPressTriggeredRef.current = false
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

            <button
              type="button"
              className="ghost play-plan-button"
              onClick={(event) => {
                event.stopPropagation()
                onPlayPlan(plan.id)
              }}
              aria-label={`Start ${plan.name}`}
            >
              <Icon name="play_arrow" />
              <span>Play</span>
            </button>
          </article>
        ))}

        {driveStatus === 'ready' && !plans.length ? <p className="subtle-empty">No workout plans yet. Tap + to create your first plan.</p> : null}
      </div>
    </section>
  )
}
