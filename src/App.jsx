import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { signIn, signOut } from './services/googleAuth'
import { upsertJsonByName } from './services/driveAppData'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import PlanBuilder from './pages/PlanBuilder'
import Home from './pages/Home'
import Planner from './pages/Planner'
import ExerciseEditor from './pages/ExerciseEditor'
import { fetchExerciseCatalog, getPublicAssetUrl } from './services/exerciseCatalog'
import { loadSavedExercises, saveWorkoutPlan } from './lib/firestore'

const HISTORY_FILE = 'lifti_history.json'
const PLANS_FILE = 'lifti_plans.json'
const EXERCISES_FILE = 'lifti_exercises.json'

const DEFAULT_HISTORY = { entries: [] }
const DEFAULT_PLANS = { plans: [] }

const primaryTabs = [
  { to: '/', label: 'Home' },
  { to: '/exercises', label: 'Exercises' },
  { to: '/plans', label: 'Plans' },
  { to: '/history', label: 'History' },
]

function makeId(prefix) {
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

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem('lifti_install_prompt_dismissed') === '1')
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 899px)').matches)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

    if (isIos && !isStandalone) {
      setShowIosHelp(true)
    }

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setShowIosHelp(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    const mediaQuery = window.matchMedia('(max-width: 899px)')
    const onResize = (event) => setIsMobile(event.matches)
    mediaQuery.addEventListener('change', onResize)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      mediaQuery.removeEventListener('change', onResize)
    }
  }, [])

  if (!isMobile || isDismissed || (!deferredPrompt && !showIosHelp)) {
    return null
  }

  const dismiss = () => {
    localStorage.setItem('lifti_install_prompt_dismissed', '1')
    setIsDismissed(true)
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return
    }

    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  return (
    <section className="card install-card">
      <h2>Install Lifti</h2>
      {deferredPrompt ? <p>Get the full-screen app experience on your phone.</p> : <p>To install on iPhone: Share → Add to Home Screen.</p>}
      <div className="install-actions">
        {deferredPrompt ? <button type="button" onClick={handleInstall}>Install</button> : null}
        <button type="button" className="ghost" onClick={dismiss}>Not now</button>
      </div>
    </section>
  )
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

function PlannerEditorRoute({ plan, onSaveItemSets, onCancel }) {
  const { planItemId } = useParams()
  const item = plan.items.find((entry) => entry.id === planItemId)

  return <ExerciseEditor planItem={item} onSave={(sets) => onSaveItemSets(planItemId, sets)} onCancel={onCancel} />
}

function HomeRoute({ onStartNewPlan, ...props }) {
  const navigate = useNavigate()
  return <Home {...props} onOpenPlanner={() => { onStartNewPlan(); navigate('/planner') }} />
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
  const [savedExercises, setSavedExercises] = useState([])
  const [draftPlan, setDraftPlan] = useState({ id: '', name: 'New Plan', items: [] })
  const catalog = useExerciseCatalog()

  useEffect(() => {
    if (!toast) {
      return undefined
    }

    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    let isMounted = true

    if (!accessToken || !fileIds?.exercises) {
      setSavedExercises([])
      return () => {
        isMounted = false
      }
    }

    loadSavedExercises(accessToken, fileIds)
      .then((items) => {
        if (isMounted) {
          setSavedExercises(items)
        }
      })
      .catch(() => {
        if (isMounted) {
          setSavedExercises([])
        }
      })

    return () => {
      isMounted = false
    }
  }, [accessToken, fileIds])

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

  const startNewPlan = () => {
    setDraftPlan({ id: makeId('plan'), name: 'New Plan', items: [] })
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
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
              end={item.to === '/'}
              onClick={item.to === '/planner' ? startNewPlan : undefined}
            >
              {item.label}
            </NavLink>
          ))}
        </aside>

        <main>
          <InstallPrompt />
          <p className="status">{accountLabel}</p>
          <Routes>
            <Route path="/" element={<HomeRoute accessToken={accessToken} fileIds={fileIds} onToast={handleToast} onStartNewPlan={startNewPlan} />} />
            <Route
              path="/login"
              element={<LoginScreen onSignedIn={handleSignedIn} status={status} onToast={handleToast} />}
            />
            <Route
              path="/exercises"
              element={<Exercises exercises={catalog} selectedGroups={selectedGroups} onSelectedGroupsChange={setSelectedGroups} />}
            />
            <Route path="/exercises/:id" element={<ExerciseDetail exercises={catalog} />} />
            <Route path="/plans" element={<PlanBuilder />} />
            <Route
              path="/planner"
              element={(
                <Planner
                  plan={draftPlan}
                  allExercises={catalog}
                  onPlanNameChange={(name) => setDraftPlan((current) => ({ ...current, name }))}
                  onAddExercise={(exercise) => setDraftPlan((current) => ({
                    ...current,
                    items: [...current.items, {
                      id: makeId('item'),
                      exerciseId: exercise.id,
                      exerciseName: exercise.name,
                      exerciseType: exercise.type || 'weights',
                      sets: (exercise.type || 'weights') === 'weights' ? [
                        { reps: '', weight: '', restSec: '' },
                        { reps: '', weight: '', restSec: '' },
                        { reps: '', weight: '', restSec: '' },
                      ] : undefined,
                    }],
                  }))}
                  onDeleteItem={(itemId) => setDraftPlan((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }))}
                  onEditItem={(itemId) => navigate(`/planner/edit/${itemId}`)}
                  onDone={async () => {
                    try {
                      const planToSave = {
                        ...draftPlan,
                        id: draftPlan.id || makeId('plan'),
                      }
                      const savedPlan = await saveWorkoutPlan(accessToken, fileIds, planToSave)
                      setDraftPlan(savedPlan)
                      handleToast('success', 'Plan saved')
                      navigate('/')
                    } catch (error) {
                      handleToast('error', error.message)
                    }
                  }}
                />
              )}
            />
            <Route
              path="/planner/edit/:planItemId"
              element={(
                <PlannerEditorRoute
                  plan={draftPlan}
                  onCancel={() => navigate('/planner')}
                  onSaveItemSets={(itemId, sets) => {
                    setDraftPlan((current) => ({
                      ...current,
                      items: current.items.map((item) => (item.id === itemId ? { ...item, sets } : item)),
                    }))
                    navigate('/planner')
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
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
            end={item.to === '/'}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Toast toast={toast} />
    </div>
  )
}
