import { useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { signIn, signOut } from './services/googleAuth'
import { readJson, upsertJsonByName, updateJson } from './services/driveAppData'

const HISTORY_FILE = 'lifti_history.json'
const PLANS_FILE = 'lifti_plans.json'

const DEFAULT_HISTORY = { entries: [] }
const DEFAULT_PLANS = { plans: [] }

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/login', label: 'Login' },
  { to: '/plan-builder', label: 'PlanBuilder' },
  { to: '/workout-player', label: 'WorkoutPlayer' },
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

function LoginScreen({ onSignedIn, status }) {
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  const handleSignIn = async () => {
    setError('')
    setIsBusy(true)

    try {
      const accessToken = await signIn()
      const [history, plans] = await Promise.all([
        upsertJsonByName(accessToken, HISTORY_FILE, DEFAULT_HISTORY),
        upsertJsonByName(accessToken, PLANS_FILE, DEFAULT_PLANS),
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
        },
      })
    } catch (signInError) {
      setError(signInError.message)
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

function HomeScreen({ accessToken, email, fileIds }) {
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
    } catch (error) {
      setMessage(`Failed to write entry: ${error.message}`)
    }
  }

  const reloadFromDrive = async () => {
    if (!accessToken || !fileIds.history) {
      setMessage('Please sign in first.')
      return
    }

    try {
      const history = await readJson(accessToken, fileIds.history)
      const lastEntry = history.entries?.[history.entries.length - 1]
      setLastTimestamp(lastEntry?.timestamp || 'No entries yet')
      setMessage('Reloaded from Drive.')
    } catch (error) {
      setMessage(`Failed to reload: ${error.message}`)
    }
  }

  return (
    <section className="screen">
      <h1>Home</h1>
      <p>Welcome to Lifti. Start a plan or jump into today&apos;s workout.</p>

      <div className="sync-box">
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
    return raw ? JSON.parse(raw) : { history: '', plans: '' }
  })
  const [status, setStatus] = useState('')

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
    setFileIds({ history: '', plans: '' })
    setStatus('Signed out.')
  }

  return (
    <div className="app-shell">
      <header>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {accessToken ? (
          <button type="button" className="signout" onClick={logout}>Sign out</button>
        ) : null}
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomeScreen accessToken={accessToken} email={email} fileIds={fileIds} />} />
          <Route
            path="/login"
            element={<LoginScreen onSignedIn={handleSignedIn} status={status} />}
          />
          <Route path="/plan-builder" element={<Page title="Plan Builder" description="Create and customize your weekly lifting plan." />} />
          <Route path="/workout-player" element={<Page title="Workout Player" description="Follow your workout step-by-step with timers and logging." />} />
          <Route path="/history" element={<Page title="History" description="Review completed workouts, trends, and personal records." />} />
        </Routes>
      </main>
    </div>
  )
}
