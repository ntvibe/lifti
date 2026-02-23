import { useCallback, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  createJson,
  deleteDriveFile,
  ensureDriveClientReady,
  findFileIdByName,
  isAuthExpiredError,
  listDriveFiles,
  readJson,
  readFileJson,
  readPlanFiles,
  updateJson,
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
const PLAN_SNAPSHOT_FILE = 'lifti_sync_snapshot.json'
const ACTIVE_SESSION_KEY = 'lifti_active_session'
const PLAN_FILE_INDEX_KEY = 'lifti_plan_file_index'

const DEFAULT_HISTORY = { entries: [] }
const SESSION_FILES_QUERY = "name contains 'lifti_session_' and mimeType='application/json'"

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

function hydratePlanFileIndex() {
  const raw = localStorage.getItem(PLAN_FILE_INDEX_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    localStorage.removeItem(PLAN_FILE_INDEX_KEY)
    return {}
  }
}

function persistPlanFileIndex(index) {
  localStorage.setItem(PLAN_FILE_INDEX_KEY, JSON.stringify(index))
}

function mapSessionFromDrive(file, payload = {}) {
  return {
    id: payload.id || file.name.replace('lifti_session_', '').replace('.json', '') || file.id,
    fileId: file.id,
    fileName: file.name,
    modifiedTime: file.modifiedTime,
    planId: payload.planId || '',
    planName: payload.planName || 'Workout Session',
    startedAt: payload.startedAt || '',
    endedAt: payload.endedAt || '',
    totalPausedMs: Number.isFinite(payload.totalPausedMs) ? payload.totalPausedMs : 0,
    exerciseStates: Array.isArray(payload.exerciseStates) ? payload.exerciseStates : [],
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
  const location = useLocation()
  const [, setFileIds] = useState(() => {
    const raw = localStorage.getItem('lifti_file_ids')
    return raw ? JSON.parse(raw) : { history: '', exercises: '' }
  })
  const [toast, setToast] = useState(null)
  const [draftPlan, setDraftPlan] = useState({ id: '', name: 'New Plan', createdAt: '', updatedAt: '', exercises: [] })
  const [activeSession, setActiveSession] = useState(() => hydrateSession())
  const [historySessions, setHistorySessions] = useState([])
  const [planFileIndex, setPlanFileIndex] = useState(() => hydratePlanFileIndex())
  const [historyStatus, setHistoryStatus] = useState('idle')
  const [historyError, setHistoryError] = useState('')
  const [isDriveSynced, setIsDriveSynced] = useState(false)
  const [isSyncingDrive, setIsSyncingDrive] = useState(false)
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
    setPlanFileIndex({})
    localStorage.removeItem(PLAN_FILE_INDEX_KEY)
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
    replacePlans,
    getPlansSnapshot,
    getPlanWithDetails,
  } = usePlans()

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

  const loadHistorySessions = useCallback(async () => {
    if (!accessToken) {
      setHistorySessions([])
      setHistoryStatus('idle')
      setHistoryError('')
      return
    }

    setHistoryStatus('loading')
    setHistoryError('')

    try {
      const files = await listDriveFiles(accessToken, SESSION_FILES_QUERY)

      const sessions = await Promise.all(
        files.map(async (file) => {
          try {
            const payload = await readFileJson(accessToken, file.id)
            return mapSessionFromDrive(file, payload)
          } catch {
            return null
          }
        }),
      )

      const sorted = sessions
        .filter(Boolean)
        .sort((a, b) => {
          const aTime = new Date(a.endedAt || a.modifiedTime || a.startedAt || 0).getTime()
          const bTime = new Date(b.endedAt || b.modifiedTime || b.startedAt || 0).getTime()
          return bTime - aTime
        })

      setHistorySessions(sorted)
      setHistoryStatus('ready')
    } catch (error) {
      if (isAuthExpiredError(error)) {
        handleSessionExpired()
        return
      }

      setHistoryStatus('error')
      setHistoryError(error?.message?.slice(0, 180) || 'Couldn’t load your workout history.')
    }
  }, [accessToken])

  useEffect(() => {
    loadHistorySessions()
  }, [loadHistorySessions])

  const handleDeleteHistorySession = useCallback(async (session) => {
    if (!accessToken) {
      throw new Error('Missing account connection for workout history.')
    }

    await deleteDriveFile(accessToken, session.fileId)
    setHistorySessions((current) => current.filter((entry) => entry.fileId !== session.fileId))
  }, [accessToken])

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

      const snapshotFileId = await findFileIdByName(token, PLAN_SNAPSHOT_FILE)
      let remotePlans = []

      const { plans: drivePlans } = await readPlanFiles(token)
      const nextPlanFileIndex = drivePlans.reduce((accumulator, plan) => {
        if (plan?.id && plan?._fileId) {
          accumulator[plan.id] = plan._fileId
        }

        return accumulator
      }, {})

      if (snapshotFileId) {
        const snapshot = await readJson(token, snapshotFileId)
        remotePlans = Array.isArray(snapshot?.plans) ? snapshot.plans : []
      } else {
        remotePlans = Array.isArray(drivePlans) ? drivePlans : []
      }

      if (remotePlans.length > 0) {
        await replacePlans(remotePlans)
      }

      setPlanFileIndex(nextPlanFileIndex)
      persistPlanFileIndex(nextPlanFileIndex)

      await loadPlans()
      handleToast('success', 'Signed in and pulled latest plans from Google Drive.')
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
    setPlanFileIndex({})
    setIsDriveSynced(false)
    localStorage.removeItem('lifti_file_ids')
    localStorage.removeItem(PLAN_FILE_INDEX_KEY)
    handleToast('success', 'Signed out')
    navigate('/')
  }

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

  const handleCreatePlan = async () => {
    try {
      const newPlan = await createPlan('New Plan')
      setIsDriveSynced(false)
      setDraftPlan(newPlan)
      navigate('/planner')
    } catch (error) {
      handleDriveError(error)
    }
  }

  const shouldShowHomeFab = isAuthenticated && location.pathname === '/'

  const handleDraftPlanChange = async (nextPlan) => {
    setDraftPlan(nextPlan)
    try {
      await upsertPlan(nextPlan)
      setIsDriveSynced(false)
    } catch (error) {
      handleDriveError(error)
    }
  }


  const handleSyncNow = async () => {
    if (!accessToken || isSyncingDrive) {
      return
    }

    setIsSyncingDrive(true)
    try {
      const latestPlans = await getPlansSnapshot()

      const nextPlanFileIndex = { ...planFileIndex }

      for (const plan of latestPlans) {
        const existingFileId = nextPlanFileIndex[plan.id]
        if (existingFileId) {
          // eslint-disable-next-line no-await-in-loop
          await updateJson(accessToken, existingFileId, plan)
          continue
        }

        // eslint-disable-next-line no-await-in-loop
        const created = await createJson(accessToken, `lifti_plan_${plan.id}.json`, plan)
        if (created?.id) {
          nextPlanFileIndex[plan.id] = created.id
        }
      }

      persistPlanFileIndex(nextPlanFileIndex)
      setPlanFileIndex(nextPlanFileIndex)

      const snapshotFileId = await findFileIdByName(accessToken, PLAN_SNAPSHOT_FILE)
      const snapshotPayload = {
        updatedAt: new Date().toISOString(),
        plans: latestPlans,
      }

      if (snapshotFileId) {
        await updateJson(accessToken, snapshotFileId, snapshotPayload)
      } else {
        await createJson(accessToken, PLAN_SNAPSHOT_FILE, snapshotPayload)
      }

      setIsDriveSynced(true)
      handleToast('success', 'Synced latest local changes to Google Drive.')
    } catch (error) {
      setIsDriveSynced(false)
      handleDriveError(error, 'Couldn’t sync latest local changes.')
    } finally {
      setIsSyncingDrive(false)
    }
  }

  const handleSyncFromDriveFile = async (fileId) => {
    if (!accessToken || !fileId) {
      return
    }

    try {
      const payload = await readFileJson(accessToken, fileId)
      const remotePlans = Array.isArray(payload?.plans)
        ? payload.plans
        : payload
          ? [payload]
          : []

      await replacePlans(remotePlans)

      if (Array.isArray(payload?.plans)) {
        const snapshotFileId = await findFileIdByName(accessToken, PLAN_SNAPSHOT_FILE)
        if (snapshotFileId) {
          await updateJson(accessToken, snapshotFileId, {
            updatedAt: new Date().toISOString(),
            plans: remotePlans,
          })
        }
      } else if (remotePlans[0]?.id) {
        const nextPlanFileIndex = { ...planFileIndex, [remotePlans[0].id]: fileId }
        setPlanFileIndex(nextPlanFileIndex)
        persistPlanFileIndex(nextPlanFileIndex)
      }

      setIsDriveSynced(true)
      handleToast('success', 'Pulled plans from selected Google Drive file.')
    } catch (error) {
      handleDriveError(error, 'Couldn’t sync from selected Drive file.')
    }
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
        <button type="button" className="brand-home" onClick={() => navigate('/')} aria-label="Open home">
          <img src={getPublicAssetUrl('icons/icon-192.png')} alt="" />
        </button>
        <div className="top-bar-actions">
          {isAuthenticated ? (
            <AvatarMenu
              profileName={profileName}
              profilePicture={profilePicture}
              onSettings={() => navigate('/settings')}
              onSync={handleSyncNow}
              syncing={isSyncingDrive}
              isSynced={isDriveSynced}
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
                  plans={plans}
                  allExercises={catalog}
                  driveStatus={authLoading ? 'loading' : driveStatus}
                  driveError={driveError}
                  onRetry={loadPlans}
                  onSignIn={handleLogin}
                  onOpenPlan={async (planId) => {
                    const details = await getPlanWithDetails(planId)
                    if (details?.uiPlan) {
                      setDraftPlan(details.uiPlan)
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
                      setIsDriveSynced(false)
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
                      const file = await createJson(accessToken, `lifti_session_${session.id}.json`, session)
                      const nextSession = mapSessionFromDrive(
                        {
                          id: file.id,
                          name: file.name || `lifti_session_${session.id}.json`,
                          modifiedTime: file.modifiedTime || new Date().toISOString(),
                        },
                        session,
                      )
                      setHistorySessions((current) => [nextSession, ...current.filter((entry) => entry.fileId !== nextSession.fileId)])
                      setHistoryStatus('ready')
                      setIsDriveSynced(false)
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
            <Route
              path="/settings"
              element={<Settings accessToken={accessToken} onFilesChanged={loadPlans} onSyncFromFile={handleSyncFromDriveFile} />}
            />
            <Route path="/planner" element={(
              <WorkoutPlanner
                plan={draftPlan}
                allExercises={catalog}
                onPlanChange={handleDraftPlanChange}
                onStartWorkout={handleStartSession}
              />
            )}
            />
            <Route path="/planner/exercise/:exerciseItemId" element={(
              <WorkoutPlanner
                plan={draftPlan}
                allExercises={catalog}
                onPlanChange={handleDraftPlanChange}
                onStartWorkout={handleStartSession}
              />
            )}
            />
            <Route path="/plan-builder" element={<PlanBuilder />} />
            <Route
              path="/history"
              element={(
                <History
                  authStatus={authStatus}
                  sessions={historySessions}
                  status={historyStatus}
                  error={historyError}
                  onRetry={loadHistorySessions}
                  onDeleteSession={async (session) => {
                    try {
                      await handleDeleteHistorySession(session)
                      handleToast('success', 'Session deleted')
                    } catch (error) {
                      handleDriveError(error, 'Couldn’t delete that session.')
                    }
                  }}
                />
              )}
            />
          </Routes>
        </main>
      </div>

      {shouldShowHomeFab ? (
        <button type="button" className="fab select-none" onClick={handleCreatePlan} aria-label="Create workout plan">
          <span className="material-symbols-rounded app-icon">add</span>
        </button>
      ) : null}

      <BottomNav isAuthenticated={isAuthenticated} activeSession={activeSession} onTogglePauseResume={handleTogglePauseResume} />

      <Toast toast={toast} />
    </div>
  )
}
