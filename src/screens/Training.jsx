import { Navigate } from 'react-router-dom'

export default function Training({ activeSession, onSessionChange, onTogglePauseResume, onFinish, onDiscard }) {
  if (!activeSession) {
    return <Navigate to="/" replace />
  }

  const handleExerciseTap = (index) => {
    if (index === activeSession.activeExerciseIndex) {
      return
    }

    const nextStates = activeSession.exerciseStates.map((exercise, currentIndex) => {
      if (currentIndex === activeSession.activeExerciseIndex && exercise.status === 'in_progress') {
        return { ...exercise, status: 'done' }
      }

      if (currentIndex === index) {
        return { ...exercise, status: 'in_progress' }
      }

      return exercise
    })

    onSessionChange({
      ...activeSession,
      activeExerciseIndex: index,
      exerciseStates: nextStates,
    })
  }

  return (
    <section className="screen select-none training-screen">
      <h1>{activeSession.planName}</h1>
      {activeSession.paused ? <article className="glass paused-banner">Session paused</article> : null}

      <div className="training-list">
        {activeSession.exerciseStates.map((exercise, index) => (
          <button
            key={`${exercise.exerciseId}-${index}`}
            type="button"
            className={`planner-list-item glass training-item ${exercise.status}`}
            onClick={() => handleExerciseTap(index)}
          >
            <strong>{exercise.name}</strong>
            <small>{exercise.status.replace('_', ' ')}</small>
          </button>
        ))}
      </div>

      <div className="training-actions">
        <button type="button" className="ghost" onClick={onTogglePauseResume}>
          {activeSession.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const finalized = {
              ...activeSession,
              endedAt: new Date().toISOString(),
            }
            onFinish(finalized)
          }}
        >
          Finish
        </button>
        <button
          type="button"
          className="ghost destructive"
          onClick={() => {
            if (window.confirm('Discard this active training session?')) {
              onDiscard()
            }
          }}
        >
          Discard
        </button>
      </div>
    </section>
  )
}
