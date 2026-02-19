import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { upsertJsonByName } from './services/driveAppData'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import PlanBuilder from './pages/PlanBuilder'
import { fetchExerciseCatalog, getPublicAssetUrl } from './services/exerciseCatalog'
import usePlans from './hooks/usePlans'
import Home from './screens/Home'
import WorkoutPlanner from './screens/WorkoutPlanner'
import BottomNav from './components/BottomNav'
import AvatarMenu from './components/AvatarMenu'
import useAuth from './hooks/useAuth'

const HISTORY_FILE = 'lifti_history.json'
const PLANS_FILE = 'lifti_plans.json'
const EXERCISES_FILE = 'lifti_exercises.json'

const DEFAULT_HISTORY = { entries: [] }
const DEFAULT_PLANS = { plans: [] }

const primaryTabs = [
  { to: '/', label: 'Home' },
  { to: '/exercises', label: 'Exercises' },
  { to: '/history', label: 'History' },
]

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}`
}

function Page({ title, description }) {
  return (
    <section className="screen">
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}

function useExerciseCatalog() {
  const [catalog, setCatalog] = useState([])

  useEffect(() => {
    let cancelled = false

    fetchExerciseCatalog()
      .then((payload) => {
        if (!cancelled) {
          setCatalog(payload.exercises)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return catalog
}

function Toast({ toast }) {
  if (!toast) {
    return null
  }

  return <div className={`toast toast-${toast.type}`}>{toast.message}</div>
}

export default function App() {
  const navigate = useNavigate()
  const [fileIds, setFileIds] = useState(() => {
    const raw = localStorage.getItem('lifti_file_ids')
    return raw ? JSON.parse(raw) : { history: '', plans: '', exercises: '' }
  })
  const [toast, setToast] = useState(null)
  const [selectedGroups, setSelectedGroups] = useState([])
  const [draftPlan, setDraftPlan] = useState({ id: '', name: 'New Plan', createdAt: '', updatedAt: '', exercises: [] })
  const catalog = useExerciseCatalog()
  const { accessToken, profileName, profilePicture, isAuthenticated, authLoading, login, logout } = useAuth()
  const { plans, loading, loadPlans, createPlan, updatePlan, deletePlan, upsertPlan } = usePlans({ accessToken, fileIds })

  useEffect(() => {
    if (!toast) {
      return undefined
    }

    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const handleToast = (type, message) => {
    setToast({ type, message })
  }

  useEffect(() => {
    let mounted = true

    const ensureAppFiles = async () => {
      if (!isAuthenticated || !accessToken) {
        setFileIds({ history: '', plans: '', exercises: '' })
        localStorage.removeItem('lifti_file_ids')
        return
      }

      try {
        const exerciseSeedResponse = await fetch(getPublicAssetUrl('data/exercises.seed.json'))
        const exercisesSeed = exerciseSeedResponse.ok
          ? await exerciseSeedResponse.json()
          : { schemaVersion: 1, updatedAt: new Date().toISOString(), exercises: [] }

        const [history, planFiles, exercises] = await Promise.all([
          upsertJsonByName(accessToken, HISTORY_FILE, DEFAULT_HISTORY),
          upsertJsonByName(accessToken, PLANS_FILE, DEFAULT_PLANS),
          upsertJsonByName(accessToken, EXERCISES_FILE, exercisesSeed),
        ])

        if (!mounted) {
          return
        }

        const ids = {
          history: history.fileId,
          plans: planFiles.fileId,
          exercises: exercises.fileId,
        }

        setFileIds(ids)
        localStorage.setItem('lifti_file_ids', JSON.stringify(ids))
      } catch (error) {
        if (mounted) {
          handleToast('error', error.message)
        }
      }
    }

    ensureAppFiles()

    return () => {
      mounted = false
    }
  }, [accessToken, isAuthenticated])

  const handleLogin = async () => {
    try {
      await login()
      handleToast('success', 'Signed in successfully.')
    } catch (error) {
      handleToast('error', error.message)
    }
  }

  const handleLogout = () => {
    logout()
    setFileIds({ history: '', plans: '', exercises: '' })
    localStorage.removeItem('lifti_file_ids')
    handleToast('success', 'Signed out')
    navigate('/')
  }

  const homePlans = useMemo(() => plans.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [plans])

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Lifti</h1>
        <div className="top-bar-actions">
          {isAuthenticated ? (
            <AvatarMenu profileName={profileName} profilePicture={profilePicture} onSignOut={handleLogout} />
          ) : (
            <button type="button" className="ghost" onClick={handleLogin}>Login</button>
          )}
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar-tabs" aria-label="Primary">
          {primaryTabs.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </aside>

        <main>
          <Routes>
            <Route
              path="/"
              element={(
                <Home
                  isAuthenticated={isAuthenticated}
                  plans={homePlans}
                  allExercises={catalog}
                  loading={loading || authLoading}
                  onSignIn={handleLogin}
                  onCreatePlan={async () => {
                    try {
                      const newPlan = await createPlan('New Plan')
                      setDraftPlan(newPlan)
                      navigate('/planner')
                    } catch (error) {
                      handleToast('error', error.message)
                    }
                  }}
                  onOpenPlan={(planId) => {
                    const existing = plans.find((entry) => entry.id === planId)
                    if (existing) {
                      setDraftPlan(existing)
                      navigate('/planner')
                    }
                  }}
                  onDeletePlan={async (planId) => {
                    try {
                      await deletePlan(planId)
                      handleToast('success', 'Plan deleted')
                    } catch (error) {
                      handleToast('error', error.message)
                    }
                  }}
                />
              )}
            />
            <Route path="/exercises" element={<Exercises exercises={catalog} selectedGroups={selectedGroups} onSelectedGroupsChange={setSelectedGroups} />} />
            <Route path="/exercises/:id" element={<ExerciseDetail exercises={catalog} />} />
            <Route
              path="/planner"
              element={(
                <WorkoutPlanner
                  plan={draftPlan}
                  allExercises={catalog}
                  onPlanChange={setDraftPlan}
                  onDone={async () => {
                    try {
                      const saved = await upsertPlan({
                        ...draftPlan,
                        id: draftPlan.id || createId('plan'),
                        createdAt: draftPlan.createdAt || new Date().toISOString(),
                      })
                      setDraftPlan(saved)
                      await loadPlans()
                      handleToast('success', 'Plan saved')
                      navigate('/')
                    } catch (error) {
                      handleToast('error', error.message)
                    }
                  }}
                />
              )}
            />
            <Route path="/plan-builder" element={<PlanBuilder />} />
            <Route path="/workout-player" element={<Page title="Workout Player" description="Follow your workout step-by-step with timers and logging." />} />
            <Route path="/history" element={<Page title="History" description="Review completed workouts, trends, and personal records." />} />
          </Routes>
        </main>
      </div>

      <BottomNav />

      <Toast toast={toast} />
    </div>
  )
}
