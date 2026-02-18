import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { signIn, signOut } from './services/googleAuth'
import { upsertJsonByName } from './services/driveAppData'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import PlanBuilder from './pages/PlanBuilder'
import { fetchExerciseCatalog, getPublicAssetUrl } from './services/exerciseCatalog'
import usePlans from './hooks/usePlans'
import Home from './screens/Home'
import WorkoutPlanner from './screens/WorkoutPlanner'

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

function LoginScreen({ onSignedIn, status, onToast }) {
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  const handleSignIn = async () => {
    setError('')
    setIsBusy(true)

    try {
      const accessToken = await signIn()
      const exerciseSeedResponse = await fetch(getPublicAssetUrl('data/exercises.seed.json'))
      const exercisesSeed = exerciseSeedResponse.ok ? await exerciseSeedResponse.json() : { schemaVersion: 1, updatedAt: new Date().toISOString(), exercises: [] }

      const [history, plans, exercises] = await Promise.all([
        upsertJsonByName(accessToken, HISTORY_FILE, DEFAULT_HISTORY),
        upsertJsonByName(accessToken, PLANS_FILE, DEFAULT_PLANS),
        upsertJsonByName(accessToken, EXERCISES_FILE, exercisesSeed),
      ])

      let email = ''
      try {
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (profileResponse.ok) {
          const profile = await profileResponse.json()
          email = profile.email || ''
        }
      } catch {
        email = ''
      }

      onSignedIn({
        accessToken,
        email,
        fileIds: {
          history: history.fileId,
          plans: plans.fileId,
          exercises: exercises.fileId,
        },
      })
      onToast('success', 'Signed in successfully.')
    } catch (signInError) {
      setError(signInError.message)
      onToast('error', 'Sign in failed.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="screen">
      <h1>Login</h1>
      <p>Sign in to access your Lifti account.</p>
      <button type="button" onClick={handleSignIn} disabled={isBusy}>
        {isBusy ? 'Signing in...' : 'Sign in with Google'}
      </button>
      {status ? <p className="status">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}

export default function App() {
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('lifti_access_token') || '')
  const [email, setEmail] = useState(() => sessionStorage.getItem('lifti_email') || '')
  const [fileIds, setFileIds] = useState(() => {
    const raw = sessionStorage.getItem('lifti_file_ids')
    return raw ? JSON.parse(raw) : { history: '', plans: '', exercises: '' }
  })
  const [status, setStatus] = useState('')
  const [toast, setToast] = useState(null)
  const [selectedGroups, setSelectedGroups] = useState([])
  const [draftPlan, setDraftPlan] = useState({ id: '', name: 'New Plan', createdAt: '', updatedAt: '', items: [] })
  const catalog = useExerciseCatalog()
  const { plans, loading, createPlan, updatePlan, deletePlan, upsertPlan } = usePlans({ accessToken, fileIds })

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

  const handleSignedIn = ({ accessToken: nextToken, email: nextEmail, fileIds: nextIds }) => {
    sessionStorage.setItem('lifti_access_token', nextToken)
    sessionStorage.setItem('lifti_email', nextEmail || '')
    sessionStorage.setItem('lifti_file_ids', JSON.stringify(nextIds))

    setAccessToken(nextToken)
    setEmail(nextEmail || '')
    setFileIds(nextIds)
    setStatus('Google sign-in complete. appData files are ready.')
  }

  const logout = () => {
    signOut()
    sessionStorage.removeItem('lifti_access_token')
    sessionStorage.removeItem('lifti_email')
    sessionStorage.removeItem('lifti_file_ids')
    setAccessToken('')
    setEmail('')
    setFileIds({ history: '', plans: '', exercises: '' })
    setStatus('Signed out.')
    handleToast('success', 'Signed out')
  }

  const accountLabel = useMemo(() => {
    if (!accessToken) {
      return 'Not signed in'
    }

    return email ? `Signed in as ${email}` : 'Signed in'
  }, [accessToken, email])

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Lifti</h1>
        <div className="top-bar-actions">
          <span className={`status-chip ${accessToken ? 'signed-in' : 'signed-out'}`}>{accessToken ? 'Signed in' : 'Signed out'}</span>
          {accessToken ? <button type="button" className="ghost" onClick={logout}>Sign out</button> : <NavLink to="/login" className="ghost action-link">Login</NavLink>}
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
          <p className="status">{accountLabel}</p>
          <Routes>
            <Route
              path="/"
              element={(
                <Home
                  plans={plans}
                  loading={loading}
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
                  onRenamePlan={async (planId, name) => {
                    try {
                      await updatePlan(planId, { name })
                      handleToast('success', 'Plan renamed')
                    } catch (error) {
                      handleToast('error', error.message)
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
            <Route path="/login" element={<LoginScreen onSignedIn={handleSignedIn} status={status} onToast={handleToast} />} />
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

      <nav className="bottom-tabs" aria-label="Mobile tabs">
        {primaryTabs.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`} end={item.to === '/'}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Toast toast={toast} />
    </div>
  )
}
