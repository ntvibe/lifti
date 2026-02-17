import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom'
import { MuscleFilter } from './components/MuscleFilter'
import { signIn, signOut } from './services/googleAuth'
import { readJson, upsertJsonByName, updateJson } from './services/driveAppData'
import { filterExercisesByMuscles } from './utils/filterExercisesByMuscles'

const HISTORY_FILE = 'lifti_history.json'
const PLANS_FILE = 'lifti_plans.json'
const EXERCISES_FILE = 'lifti_exercises.json'

const DEFAULT_HISTORY = { entries: [] }
const DEFAULT_PLANS = { plans: [] }

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/login', label: 'Login' },
  { to: '/exercises', label: 'Exercises' },
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

function useExerciseCatalog() {
  const [catalog, setCatalog] = useState([])

  useEffect(() => {
    let cancelled = false

    const loadCatalog = async () => {
      try {
        const response = await fetch('/data/exercises.seed.json')
        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (!cancelled) {
          setCatalog(data)
        }
      } catch {
        if (!cancelled) {
          setCatalog([])
        }
      }
    }

    loadCatalog()

    return () => {
      cancelled = true
    }
  }, [])

  return catalog
}

function Chips({ items }) {
  return (
    <div className="chips">
      {items.map((item) => (
        <span key={item} className="chip">{item}</span>
      ))}
    </div>
  )
}

function ExercisesScreen({ catalog }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('all')
  const [selectedMuscles, setSelectedMuscles] = useState([])

  const allEquipment = useMemo(
    () => [...new Set(catalog.flatMap((exercise) => exercise.equipment))].sort(),
    [catalog],
  )

  const filteredCatalog = useMemo(() => {
    const byMuscles = filterExercisesByMuscles(catalog, selectedMuscles)

    return byMuscles.filter((exercise) => {
      const matchesName = exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesEquipment = equipmentFilter === 'all' || exercise.equipment.includes(equipmentFilter)
      return matchesName && matchesEquipment
    })
  }, [catalog, equipmentFilter, searchTerm, selectedMuscles])

  return (
    <section className="screen">
      <h1>Exercises</h1>
      <p>Search and filter the Lifti exercise library.</p>

      <div className="exercise-filters">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by exercise name"
        />
        <select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}>
          <option value="all">All equipment</option>
          {allEquipment.map((equipment) => (
            <option key={equipment} value={equipment}>{equipment}</option>
          ))}
        </select>
      </div>

      <MuscleFilter selectedMuscles={selectedMuscles} onChange={setSelectedMuscles} />

      <div className="exercise-grid">
        {filteredCatalog.map((exercise) => (
          <article key={exercise.id} className="exercise-card">
            <div className="pose-placeholder" aria-label={`${exercise.name} front pose placeholder`}>{exercise.poses.front}</div>
            <h2>{exercise.name}</h2>
            <Chips items={exercise.muscles} />
            <p>{exercise.equipment.join(' • ')}</p>
            <Link to={`/exercises/${exercise.id}`}>View details</Link>
          </article>
        ))}
      </div>

      {filteredCatalog.length === 0 ? <p className="status">No exercises found for this filter.</p> : null}
    </section>
  )
}

function ExerciseDetailScreen({ catalog }) {
  const { exerciseId } = useParams()
  const exercise = catalog.find((entry) => entry.id === exerciseId)

  if (!exercise) {
    return (
      <section className="screen">
        <h1>Exercise not found</h1>
        <p>Go back to the library and choose another exercise.</p>
        <Link to="/exercises">Back to Exercises</Link>
      </section>
    )
  }

  return (
    <section className="screen">
      <h1>{exercise.name}</h1>
      <p>Technique snapshots and coaching cues.</p>

      <div className="pose-grid">
        <figure>
          <div className="pose-placeholder" aria-label={`${exercise.name} front pose placeholder`}>{exercise.poses.front}</div>
          <figcaption>Front view</figcaption>
        </figure>
        <figure>
          <div className="pose-placeholder" aria-label={`${exercise.name} side pose placeholder`}>{exercise.poses.side}</div>
          <figcaption>Side view</figcaption>
        </figure>
      </div>

      <h2>Primary muscles</h2>
      <Chips items={exercise.muscles} />

      <h2>Equipment</h2>
      <Chips items={exercise.equipment} />

      <h2>Tips</h2>
      <ul>
        {exercise.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>

      <Link to="/exercises">Back to Exercises</Link>
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
      const exerciseSeedResponse = await fetch('/data/exercises.seed.json')
      const exercisesSeed = exerciseSeedResponse.ok ? await exerciseSeedResponse.json() : []

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
    return raw ? JSON.parse(raw) : { history: '', plans: '', exercises: '' }
  })
  const [status, setStatus] = useState('')
  const catalog = useExerciseCatalog()

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
          <Route path="/exercises" element={<ExercisesScreen catalog={catalog} />} />
          <Route path="/exercises/:exerciseId" element={<ExerciseDetailScreen catalog={catalog} />} />
          <Route path="/plan-builder" element={<Page title="Plan Builder" description="Create and customize your weekly lifting plan." />} />
          <Route path="/workout-player" element={<Page title="Workout Player" description="Follow your workout step-by-step with timers and logging." />} />
          <Route path="/history" element={<Page title="History" description="Review completed workouts, trends, and personal records." />} />
        </Routes>
      </main>
    </div>
  )
}
