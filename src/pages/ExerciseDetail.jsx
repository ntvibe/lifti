import { Link, useParams } from 'react-router-dom'
import { formatLabel } from '../services/exerciseCatalog'

export default function ExerciseDetail({ exercises }) {
  const { id } = useParams()
  const exercise = exercises.find((entry) => entry.id === id)

  if (!exercise) {
    return (
      <section className="screen">
        <h1>Exercise not found</h1>
        <Link to="/exercises">Back to exercises</Link>
      </section>
    )
  }

  return (
    <section className="screen">
      <h1>{exercise.name}</h1>
      <div className="pose-grid">
        <figure>
          <div className="pose-placeholder">placeholder</div>
          <figcaption>Front</figcaption>
        </figure>
        <figure>
          <div className="pose-placeholder">placeholder</div>
          <figcaption>Side</figcaption>
        </figure>
      </div>

      <p><strong>Track mode:</strong> {exercise.trackMode}</p>
      <p><strong>Primary muscles:</strong> {exercise.primaryMuscles.map(formatLabel).join(', ')}</p>
      <p><strong>Secondary muscles:</strong> {exercise.secondaryMuscles.map(formatLabel).join(', ')}</p>

      <h2>Default prescription</h2>
      <p>{exercise.defaultPrescription.sets} sets × {exercise.defaultPrescription.reps} · Rest {exercise.defaultPrescription.restSec}s</p>

      <h2>Cues</h2>
      <ul>
        {exercise.cues.map((cue) => <li key={cue}>{cue}</li>)}
      </ul>

      <h2>Common mistakes</h2>
      <ul>
        {exercise.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
      </ul>

      <Link to="/exercises">Back to exercises</Link>
    </section>
  )
}
