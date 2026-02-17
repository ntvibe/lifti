import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { signIn, signOut } from './services/googleAuth'
import { readJson, upsertJsonByName, updateJson } from './services/driveAppData'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import { fetchExerciseCatalog, getPublicAssetUrl } from './services/exerciseCatalog'

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

function HomeScreen({ accessToken, email, fileIds, onToast }) {
  const [message, setMessage] = useState('')
  const [lastTimestamp, setLastTimestamp] = useState('No entries yet')

  const accountLabel = useMemo(() => {
    if (!accessToken) {
      return 'Not signed in'
    }

    return email ? `Signed in as ${email}` : 'Signed in (email unavailable)'
  }, [accessToken, email])

  const writeTestEntry = async () => {
    if (!accessToken || !fileIds.history) {
      setMessage('Please sign in first.')
      onToast('error', 'Please sign in first.')
      return
    }

    try {
      const history = await readJson(accessToken, fileIds.history)
      const entry = {
        id: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        note: 'Sync test entry',
      }

      const nextHistory = {
        ...history,
        entries: [...(history.entries || []), entry],
      }

      await updateJson(accessToken, fileIds.history, nextHistory)
      setLastTimestamp(entry.timestamp)
      setMessage('Test entry written to Drive appDataFolder.')
      onToast('success', 'Saved')
    } catch (error) {
      setMessage(`Failed to write entry: ${error.message}`)
      onToast('error', 'Sync failed')
    }
  }

  const reloadFromDrive = async () => {
    if (!accessToken || !fileIds.history) {
      setMessage('Please sign in first.')
      onToast('error', 'Please sign in first.')
      return
    }

    try {
      const history = await readJson(accessToken, fileIds.history)
      const lastEntry = history.entries?.[history.entries.length - 1]
      setLastTimestamp(lastEntry?.timestamp || 'No entries yet')
      setMessage('Reloaded from Drive.')
      onToast('success', 'Reloaded')
    } catch (error) {
      setMessage(`Failed to reload: ${error.message}`)
      onToast('error', 'Sync failed')
    }
  }

  return (
    <section className="screen">
      <h1>Home</h1>
      <p>Welcome to Lifti. Start a plan or jump into today&apos;s workout.</p>

      <div className="card">
        <h2>Sync Test</h2>
        <p>{accountLabel}</p>
        <div className="sync-actions">
          <button type="button" onClick={writeTestEntry}>Write test entry</button>
          <button type="button" onClick={reloadFromDrive}>Reload from Drive</button>
        </div>
        <p>Last entry timestamp: {lastTimestamp}</p>
        {message ? <p className="status">{message}</p> : null}
      </div>
    </section>
  )
}

export default function App() {
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('lifti_access_token') || '')
  const [email, setEmail] = useState(() => sessionStorage.getItem('lifti_email') || '')
  const [fileIds, setFileIds] = useState(() => {
    const raw = sessionStorage.getItem('lifti_file_ids')
    return raw ? JSON.parse(raw) : { history: '', plans: '', exercises: '' }
  })
  const [status, setStatus] = useState('')
  const [toast, setToast] = useState(null)
  const catalog = useExerciseCatalog()

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

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Lifti</h1>
        {accessToken ? <button type="button" className="ghost" onClick={logout}>Sign out</button> : <NavLink to="/login" className="ghost action-link">Login</NavLink>}
      </header>

      <div className="app-layout">
        <aside className="sidebar-tabs" aria-label="Primary">
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
        </aside>

        <main>
          <InstallPrompt />
          <Routes>
            <Route path="/" element={<HomeScreen accessToken={accessToken} email={email} fileIds={fileIds} onToast={handleToast} />} />
            <Route
              path="/login"
              element={<LoginScreen onSignedIn={handleSignedIn} status={status} onToast={handleToast} />}
            />
            <Route path="/exercises" element={<Exercises exercises={catalog} />} />
            <Route path="/exercises/:id" element={<ExerciseDetail exercises={catalog} />} />
            <Route path="/plans" element={<Page title="Plans" description="Create and customize your weekly lifting plan." />} />
            <Route path="/plan-builder" element={<Page title="Plans" description="Create and customize your weekly lifting plan." />} />
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
