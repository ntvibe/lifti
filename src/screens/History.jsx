import { useState } from 'react'

function formatDateTime(value) {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(startedAt, endedAt, pausedMs = 0) {
  const startMs = new Date(startedAt).getTime()
  const endMs = new Date(endedAt).getTime()

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 'Unknown duration'
  }

  const activeMs = Math.max(0, endMs - startMs - pausedMs)
  const totalMinutes = Math.max(1, Math.round(activeMs / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (!hours) {
    return `${minutes} min`
  }

  return `${hours} hr ${minutes} min`
}

export default function History({ authStatus, sessions, status, error, onRetry, onDeleteSession }) {
  const [busyId, setBusyId] = useState('')

  if (authStatus !== 'signed_in') {
    return (
      <section className="screen select-none">
        <h1>History</h1>
        <article className="glass card minimal-card">
          <p>Sign in to view your completed workout sessions.</p>
        </article>
      </section>
    )
  }

  return (
    <section className="screen select-none">
      <h1>History</h1>

      {status === 'loading' ? (
        <article className="glass card minimal-card">
          <p>Loading completed sessions…</p>
        </article>
      ) : null}

      {status === 'error' ? (
        <article className="glass card minimal-card">
          <p>{error || 'Couldn’t load workout history.'}</p>
          <button type="button" className="ghost" onClick={onRetry}>Retry</button>
        </article>
      ) : null}

      {status === 'ready' && !sessions.length ? (
        <article className="glass card minimal-card">
          <p>No completed sessions yet.</p>
        </article>
      ) : null}

      {sessions.length ? (
        <div className="history-list scroll-safe-list">
          {sessions.map((session) => {
            const completedExercises = session.exerciseStates.filter((entry) => entry.status === 'done').length
            return (
              <article key={session.fileId} className="history-item glass">
                <div>
                  <strong>{session.planName || 'Workout Session'}</strong>
                  <small>
                    {completedExercises}/{session.exerciseStates.length || 0} exercises • {formatDuration(session.startedAt, session.endedAt, session.totalPausedMs)}
                  </small>
                  <small>Finished {formatDateTime(session.endedAt || session.modifiedTime)}</small>
                </div>
                <button
                  type="button"
                  className="ghost destructive"
                  disabled={busyId === session.fileId}
                  onClick={async () => {
                    const approved = window.confirm(`Delete this ${session.planName || 'session'} from history?`)
                    if (!approved) {
                      return
                    }

                    setBusyId(session.fileId)
                    try {
                      await onDeleteSession(session)
                    } finally {
                      setBusyId('')
                    }
                  }}
                >
                  Delete
                </button>
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
