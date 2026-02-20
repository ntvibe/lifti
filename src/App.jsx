import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  createJson,
  ensureDriveClientReady,
  isAuthExpiredError,
  upsertJsonByName,
} from './services/driveAppData'
import PlanBuilder from './pages/PlanBuilder'
import Settings from './pages/Settings'
import { fetchExerciseCatalog, getPublicAssetUrl } from './services/exerciseCatalog'
import usePlans from './hooks/usePlans'
import Home from './screens/Home'
import WorkoutPlanner from './screens/WorkoutPlanner'
import BottomNav from './components/BottomNav'
import AvatarMenu from './components/AvatarMenu'
import useAuth from './hooks/useAuth'
import Training from './screens/Training'
import History from './screens/History'

const HISTORY_FILE = 'lifti_history.json'
const EXERCISES_FILE = 'lifti_exercises.json'
const ACTIVE_SESSION_KEY = 'lifti_active_session'

const DEFAULT_HISTORY = { entries: [] }

const primaryTabs = [
  { to: '/', label: 'Plans' },
  { to: '/history', label: 'History' },
]

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}`
}

function hydrateSession() {
  const raw = localStorage.getItem(ACTIVE_SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    return null
  }
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
  const [draftPlan, setDraftPlan] = useState({ id: '', name: 'New Plan', createdAt: '', updatedAt: '', exercises: [] })
  const [activeSession, setActiveSession] = useState(() => hydrateSession())
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

  const persistActiveSession = (session) => {
    setActiveSession(session)
    if (session) {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session))
      return
    }

    localStorage.removeItem(ACTIVE_SESSION_KEY)
  }

  function handleSessionExpired() {
    clearAuthState()
    setFileIds({ history: '', exercises: '' })
    localStorage.removeItem('lifti_file_ids')
    persistActiveSession(null)
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
    persistActiveSession(null)
    localStorage.removeItem('lifti_file_ids')
    handleToast('success', 'Signed out')
    navigate('/')
  }

  const homePlans = useMemo(() => plans.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [plans])

  const handleStartSession = (plan) => {
    const now = new Date().toISOString()
    const nextSession = {
      id: createId('session'),
      planId: plan.id,
      planName: plan.name,
      startedAt: now,
      paused: false,
      pausedAt: '',
      totalPausedMs: 0,
      activeExerciseIndex: 0,
      exerciseStates: (plan.exercises || []).map((exercise, index) => ({
        exerciseId: exercise.exerciseId || exercise.id || createId('exercise'),
        name: exercise.exerciseName || exercise.name || `Exercise ${index + 1}`,
        status: index === 0 ? 'in_progress' : 'not_started',
      })),
    }

    persistActiveSession(nextSession)
    navigate('/training')
  }

  const handleTogglePauseResume = () => {
    if (!activeSession) {
      return
    }

    const now = Date.now()
    const isPaused = Boolean(activeSession.paused)
    const totalPausedMs = isPaused && activeSession.pausedAt
      ? activeSession.totalPausedMs + Math.max(0, now - new Date(activeSession.pausedAt).getTime())
      : activeSession.totalPausedMs

    persistActiveSession({
      ...activeSession,
      paused: !isPaused,
      pausedAt: isPaused ? '' : new Date(now).toISOString(),
      totalPausedMs,
    })
    navigate('/training')
  }

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
                  onPlayPlan={(planId) => {
                    const existing = plans.find((entry) => entry.id === planId)
                    if (existing) {
                      handleStartSession(existing)
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
            <Route
              path="/training"
              element={(
                <Training
                  activeSession={activeSession}
                  onSessionChange={persistActiveSession}
                  onTogglePauseResume={handleTogglePauseResume}
                  onFinish={async (session) => {
                    try {
                      await createJson(accessToken, `lifti_session_${session.id}.json`, session)
                      persistActiveSession(null)
                      handleToast('success', 'Session saved')
                      navigate('/')
                    } catch (error) {
                      handleDriveError(error, 'Couldn’t save this training session.')
                    }
                  }}
                  onDiscard={() => {
                    persistActiveSession(null)
                    navigate('/')
                  }}
                />
              )}
            />
            <Route path="/settings" element={<Settings accessToken={accessToken} onFilesChanged={loadPlans} />} />
            <Route path="/planner" element={(
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
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>

      <BottomNav isAuthenticated={isAuthenticated} activeSession={activeSession} onTogglePauseResume={handleTogglePauseResume} />

      <Toast toast={toast} />
    </div>
  )
}
