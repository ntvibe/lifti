import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon'
import { getPublicAssetUrl } from '../services/exerciseCatalog'
import { computePlanMuscleIntensities } from '../utils/planIntensity'
import PlanMuscleHeatmapSVG from '../components/PlanMuscleHeatmapSVG'

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
  const menuRef = useRef(null)
  const [openMenuPlanId, setOpenMenuPlanId] = useState('')

  const intensitiesByPlanId = useMemo(
    () => Object.fromEntries(plans.map((plan) => [plan.id, computePlanMuscleIntensities(plan.exercises, allExercises)])),
    [plans, allExercises],
  )

  useEffect(() => {
    if (!openMenuPlanId) {
      return undefined
    }

    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuPlanId('')
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [openMenuPlanId])

  if (authStatus !== 'signed_in') {
    return (
      <section className="screen home-signin-screen select-none">
        <button type="button" className="ghost" onClick={onSignIn}>Sign in</button>
      </section>
    )
  }

  return (
    <section className="screen select-none">
      <div className="planner-results home-list scroll-safe-list plans-grid-padded">
        {driveStatus === 'loading' && !plans.length ? (
          <article className="glass drive-error-card">
            <p>Loading your plans…</p>
          </article>
        ) : null}

        {driveStatus === 'error' ? (
          <article className="glass drive-error-card">
            <p>We couldn’t load your plans right now.</p>
            <button type="button" className="ghost" onClick={onRetry}>Retry</button>
            {driveError ? <small>{driveError}</small> : null}
          </article>
        ) : null}

        {plans.map((plan) => (
          <article
            key={plan.id}
            className="planner-list-item home-plan-card modern-plan-card glass"
            onClick={() => {
              setOpenMenuPlanId('')
              onOpenPlan(plan.id)
            }}
          >
            <div className="kebab-wrap" ref={openMenuPlanId === plan.id ? menuRef : null}>
              <button
                type="button"
                className="ghost kebab-button"
                aria-label={`Plan menu for ${plan.name}`}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setOpenMenuPlanId((current) => (current === plan.id ? '' : plan.id))
                }}
              >
                <Icon name="more_vert" />
              </button>

              {openMenuPlanId === plan.id ? (
                <div className="kebab-menu glass">
                  <button
                    type="button"
                    className="destructive"
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpenMenuPlanId('')
                      if (window.confirm(`Delete ${plan.name}?`)) {
                        onDeletePlan(plan.id)
                      }
                    }}
                  >
                    Delete plan
                  </button>
                </div>
              ) : null}
            </div>

            <div className="plan-card-content">
              <PlanMuscleHeatmapSVG
                svgPath={getPublicAssetUrl('svg/muscle-groups.svg')}
                intensities={intensitiesByPlanId[plan.id] || {}}
                className="plan-card-heatmap"
              />
              <h3>{plan.name}</h3>
              <small>{plan.exercises.length} exercises</small>
            </div>

            <button
              type="button"
              className="ghost play-plan-button"
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onPointerUp={(event) => {
                event.stopPropagation()
              }}
              onPointerLeave={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.stopPropagation()
                setOpenMenuPlanId('')
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
