import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { ensureDriveClientReady, isAuthExpiredError, upsertJsonByName } from './services/driveAppData'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import PlanBuilder from './pages/PlanBuilder'
import Settings from './pages/Settings'
import { fetchExerciseCatalog, getPublicAssetUrl } from './services/exerciseCatalog'
import usePlans from './hooks/usePlans'
import Home from './screens/Home'
import WorkoutPlanner from './screens/WorkoutPlanner'
import BottomNav from './components/BottomNav'
import AvatarMenu from './components/AvatarMenu'
import useAuth from './hooks/useAuth'

const HISTORY_FILE = 'lifti_history.json'
const EXERCISES_FILE = 'lifti_exercises.json'

const DEFAULT_HISTORY = { entries: [] }

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
  const [, setFileIds] = useState(() => {
    const raw = localStorage.getItem('lifti_file_ids')
    return raw ? JSON.parse(raw) : { history: '', exercises: '' }
  })
  const [toast, setToast] = useState(null)
  const [selectedGroups, setSelectedGroups] = useState([])
  const [draftPlan, setDraftPlan] = useState({ id: '', name: 'New Plan', createdAt: '', updatedAt: '', exercises: [] })
  const catalog = useExerciseCatalog()
  const {
    accessToken,
    profileName,
    profilePicture,
    authStatus,
    isAuthenticated,
    authLoading,
    login,
    logout,
    clearAuthState,
  } = useAuth()

  function handleSessionExpired() {
    clearAuthState()
    setFileIds({ history: '', exercises: '' })
    localStorage.removeItem('lifti_file_ids')
    handleToast('info', 'Session expired. Please sign in again.')
    navigate('/')
  }

  const {
    plans,
    driveStatus,
    driveError,
    loadPlans,
    createPlan,
    deletePlan,
    upsertPlan,
    setPlans,
  } = usePlans({
    accessToken,
    authStatus,
    onAuthExpired: handleSessionExpired,
  })

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

  const handleDriveError = (error, fallbackMessage = 'Something went wrong.') => {
    if (isAuthExpiredError(error)) {
      handleSessionExpired()
      return
    }

    handleToast('info', error?.message || fallbackMessage)
  }

  useEffect(() => {
    let mounted = true

    const ensureAppFiles = async () => {
      if (!isAuthenticated || !accessToken) {
        setFileIds({ history: '', exercises: '' })
        localStorage.removeItem('lifti_file_ids')
        return
      }

      try {
        const exerciseSeedResponse = await fetch(getPublicAssetUrl('data/exercises.seed.json'))
        const exercisesSeed = exerciseSeedResponse.ok
          ? await exerciseSeedResponse.json()
          : { schemaVersion: 1, updatedAt: new Date().toISOString(), exercises: [] }

        const [history, exercises] = await Promise.all([
          upsertJsonByName(accessToken, HISTORY_FILE, DEFAULT_HISTORY),
          upsertJsonByName(accessToken, EXERCISES_FILE, exercisesSeed),
        ])

        if (!mounted) {
          return
        }

        const ids = {
          history: history.fileId,
          exercises: exercises.fileId,
        }

        setFileIds(ids)
        localStorage.setItem('lifti_file_ids', JSON.stringify(ids))
      } catch (error) {
        if (mounted) {
          handleDriveError(error, 'Failed to initialize account files.')
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
      const token = await login()
      await ensureDriveClientReady(token)
      await loadPlans()
      handleToast('success', 'Signed in successfully.')
    } catch (error) {
      console.warn('Login failed.', error)
      handleToast('info', error?.message || 'Google Sign-in unavailable.')
    }
  }

  const handleLogout = () => {
    logout()
    setFileIds({ history: '', exercises: '' })
    setPlans([])
    localStorage.removeItem('lifti_file_ids')
    handleToast('success', 'Signed out')
    navigate('/')
  }

  const homePlans = useMemo(() => plans.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [plans])

  return (
    <div className="app-shell select-none">
      <header className="top-bar glass select-none">
        <h1>Lifti</h1>
        <div className="top-bar-actions">
          {isAuthenticated ? (
            <AvatarMenu
              profileName={profileName}
              profilePicture={profilePicture}
              onSettings={() => navigate('/settings')}
              onSignOut={handleLogout}
            />
          ) : (
            <button type="button" className="ghost select-none" onClick={handleLogin}>Sign in</button>
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
                  authStatus={authStatus}
                  plans={homePlans}
                  allExercises={catalog}
                  driveStatus={authLoading ? 'loading' : driveStatus}
                  driveError={driveError}
                  onRetry={loadPlans}
                  onSignIn={handleLogin}
                  onCreatePlan={async () => {
                    try {
                      const newPlan = await createPlan('New Plan')
                      setDraftPlan(newPlan)
                      navigate('/planner')
                    } catch (error) {
                      handleDriveError(error)
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
                      handleDriveError(error)
                    }
                  }}
                />
              )}
            />
            <Route path="/settings" element={<Settings accessToken={accessToken} onResetPlans={() => setPlans([])} />} />
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
                      handleDriveError(error)
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
