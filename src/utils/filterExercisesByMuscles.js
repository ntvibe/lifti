import { MUSCLE_ALIASES_BY_ID } from '../constants/muscles'

export function filterExercisesByMuscles(exercises, selectedMuscles) {
  if (!selectedMuscles.length) {
    return exercises
  }

  const selectedAliases = selectedMuscles.flatMap((id) => MUSCLE_ALIASES_BY_ID[id] ?? [id])

  return exercises.filter((exercise) => {
    const normalizedMuscles = exercise.muscles.map((muscle) => muscle.toLowerCase())
    return selectedAliases.some((alias) => normalizedMuscles.includes(alias))
  })
}
