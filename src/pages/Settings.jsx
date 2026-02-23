import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteAllLiftiFiles, deleteDriveFile, listLiftiFiles } from '../services/driveAppData'

function formatRelativeDate(value) {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day',
  )
}

function humanizeType(name) {
  if (name.startsWith('lifti_plan_')) {
    return 'Plan'
  }

  if (name === 'lifti_sync_snapshot.json') {
    return 'Plans Snapshot'
  }

  if (name.startsWith('lifti_session_')) {
    return 'Workout Session'
  }

  if (name === 'lifti_history.json') {
    return 'History'
  }

  if (name === 'lifti_exercises.json') {
    return 'Exercises'
  }

  if (name === 'lifti_index.json') {
    return 'Index'
  }

  return 'Unknown'
}

export default function Settings({ accessToken, onFilesChanged, onSyncFromFile }) {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [deleteAllState, setDeleteAllState] = useState('')
  const [syncFromFileId, setSyncFromFileId] = useState('')
  const [error, setError] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installState, setInstallState] = useState('')
  const [isStandalone, setIsStandalone] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

  const loadFiles = async () => {
    if (!accessToken) {
      setFiles([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await listLiftiFiles(accessToken)
      setFiles(response)
    } catch (err) {
      setError('Couldn’t load your Drive files right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [accessToken])

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)')
    const handleModeChange = () => {
      setIsStandalone(mediaQuery?.matches || window.navigator.standalone === true)
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }

    const handleInstalled = () => {
      setInstallPrompt(null)
      setInstallState('Installed')
      setIsStandalone(true)
    }

    mediaQuery?.addEventListener?.('change', handleModeChange)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      mediaQuery?.removeEventListener?.('change', handleModeChange)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const sortedFiles = useMemo(
    () => files.slice().sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()),
    [files],
  )

  return (
    <section className="screen select-none">
      <button type="button" className="ghost" onClick={() => navigate('/')}>← Back</button>
      <h1>Settings</h1>

      <article className="glass settings-card">
        <h2>Install app</h2>
        <p>{isStandalone ? 'Lifti is installed on this device.' : 'Install Lifti for full-screen launch and better offline behavior.'}</p>
        {installPrompt && !isStandalone ? (
          <button
            type="button"
            onClick={async () => {
              setInstallState('Opening prompt…')
              installPrompt.prompt()
              const choice = await installPrompt.userChoice
              setInstallState(choice.outcome === 'accepted' ? 'Install accepted' : 'Install dismissed')
              if (choice.outcome === 'accepted') {
                setInstallPrompt(null)
              }
            }}
          >
            Install Lifti
          </button>
        ) : null}
        {!installPrompt && !isStandalone ? <small>On iPhone/iPad use Safari Share → Add to Home Screen.</small> : null}
        {installState ? <small>{installState}</small> : null}
      </article>

      <article className="glass settings-card">
        <h2>Storage (Google Drive)</h2>
        <p>Scope: <strong>appDataFolder</strong></p>

        {loading ? <p>Loading files…</p> : null}
        {error ? <p>{error}</p> : null}

        {!loading && !sortedFiles.length ? <p>No Lifti files found.</p> : null}

        <div className="settings-file-list">
          {sortedFiles.map((file) => (
            <div key={file.id} className="settings-file-row glass">
              <div>
                <strong>{file.name.replace('lifti_plan_', 'Plan ').replace('.json', '')}</strong>
                <small>{formatRelativeDate(file.modifiedTime)} • {Math.max(1, Math.round((Number(file.size) || 0) / 1024))} KB • {humanizeType(file.name)}</small>
              </div>
              <div className="settings-file-actions">
                {file.mimeType === 'application/json' ? (
                  <button
                    type="button"
                    className="ghost"
                    disabled={busyId === file.id || syncFromFileId === file.id}
                    onClick={async () => {
                      setSyncFromFileId(file.id)
                      try {
                        await onSyncFromFile?.(file.id)
                        onFilesChanged?.()
                      } finally {
                        setSyncFromFileId('')
                      }
                    }}
                  >
                    {syncFromFileId === file.id ? 'Syncing…' : 'Sync from file'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost destructive"
                  disabled={busyId === file.id || syncFromFileId === file.id}
                  onClick={async () => {
                    setBusyId(file.id)
                    try {
                      await deleteDriveFile(accessToken, file.id)
                      setFiles((current) => current.filter((entry) => entry.id !== file.id))
                      onFilesChanged?.()
                    } finally {
                      setBusyId('')
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="settings-danger-zone">
          <button
            type="button"
            className="ghost destructive"
            disabled={Boolean(deleteAllState)}
            onClick={async () => {
              const approved = window.confirm('This will permanently remove all Lifti files from your Drive.')
              if (!approved) {
                return
              }

              setDeleteAllState('Deleting…')
              await deleteAllLiftiFiles(accessToken, (done, total) => {
                setDeleteAllState(`Deleting ${done}/${total}…`)
              })
              setDeleteAllState('')
              setFiles([])
              onFilesChanged?.()
              navigate('/')
            }}
          >
            {deleteAllState || 'Delete all Lifti data'}
          </button>
        </div>
      </article>
    </section>
  )
}
