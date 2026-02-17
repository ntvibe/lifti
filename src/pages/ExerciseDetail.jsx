import { Link, useParams } from 'react-router-dom'
import { formatLabel } from '../services/exerciseCatalog'

export default function ExerciseDetail({ exercises }) {
  const { id } = useParams()
  const exercise = exercises.find((entry) => entry.id === id)

  if (!exercise) {
    return (
      <section className="screen">
        <h1>Exercise not found</h1>
        <Link to="/exercises" className="exercise-detail-back">Back to exercises</Link>
      </section>
    )
  }

  return (
    <section className="screen">
      <h1>{exercise.name}</h1>
      <div className="pose-grid">
        <figure className="card">
          <img src={exercise.poses.front} className="pose-image" alt={`${exercise.name} front pose`} />
          <figcaption>Front</figcaption>
        </figure>
        <figure className="card">
          <img src={exercise.poses.side} className="pose-image" alt={`${exercise.name} side pose`} />
          <figcaption>Side</figcaption>
        </figure>
      </div>

      <div className="card">
        <p><strong>Track mode:</strong> {exercise.trackMode}</p>
        <div className="badges">
          {exercise.equipment.map((item) => <span key={`equipment-${item}`} className="badge">{formatLabel(item)}</span>)}
        </div>
        <p><strong>Primary muscles:</strong> {exercise.primaryMuscles.map(formatLabel).join(', ')}</p>
        <p><strong>Secondary muscles:</strong> {exercise.secondaryMuscles.map(formatLabel).join(', ')}</p>
      </div>

      <div className="card">
        <h2>Default prescription</h2>
        <p>{exercise.defaultPrescription.sets} sets × {exercise.defaultPrescription.reps} · Rest {exercise.defaultPrescription.restSec}s</p>
      </div>

      <div className="card">
        <h2>Cues</h2>
        <ul>
          {exercise.cues.map((cue) => <li key={cue}>{cue}</li>)}
        </ul>
      </div>

      <div className="card">
        <h2>Common mistakes</h2>
        <ul>
          {exercise.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
        </ul>
      </div>

      <Link to="/exercises" className="exercise-detail-back">Back to exercises</Link>
    </section>
  )
}
