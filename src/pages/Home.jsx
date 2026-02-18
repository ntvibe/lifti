import { useEffect, useState } from 'react'
import { toTitleCase } from '../utils/label'
import { loadSavedExercises } from '../lib/firestore'

export default function Home({ accessToken, fileIds, onToast, onOpenPlanner }) {
  const [savedExercises, setSavedExercises] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (!accessToken || !fileIds?.exercises) {
        setSavedExercises([])
        return
      }

      setIsLoading(true)
      try {
        const items = await loadSavedExercises(accessToken, fileIds)
        if (isMounted) {
          setSavedExercises(items)
        }
      } catch (error) {
        if (isMounted) {
          onToast('error', `Failed to load exercises: ${error.message}`)
          setSavedExercises([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [accessToken, fileIds, onToast])

  return (
    <section className="screen">
      <h1>Home</h1>
      <p>Saved exercises from your account.</p>

      <div className="planner-results home-list">
        {isLoading ? <p>Loading…</p> : null}
        {!isLoading && savedExercises.map((exercise) => (
          <button key={exercise.id} type="button" className="planner-list-item">
            <span>{toTitleCase(exercise.name)}</span>
            <small>{exercise.primaryMuscles.map(toTitleCase).join(', ')}</small>
          </button>
        ))}
        {!isLoading && !savedExercises.length ? <p>No saved exercises yet.</p> : null}
      </div>

      <button type="button" className="fab" onClick={onOpenPlanner} aria-label="Create Workout Plan">+</button>
    </section>
  )
}
