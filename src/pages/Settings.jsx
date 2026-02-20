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

  if (name === 'lifti_index.json') {
    return 'Index'
  }

  return 'Unknown'
}

export default function Settings({ accessToken, onFilesChanged }) {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [deleteAllState, setDeleteAllState] = useState('')
  const [error, setError] = useState('')

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

  const sortedFiles = useMemo(
    () => files.slice().sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()),
    [files],
  )

  return (
    <section className="screen select-none">
      <button type="button" className="ghost" onClick={() => navigate('/')}>← Back</button>
      <h1>Settings</h1>
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
              <button
                type="button"
                className="ghost destructive"
                disabled={busyId === file.id}
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
