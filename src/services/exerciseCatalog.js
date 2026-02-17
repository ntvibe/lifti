import { MUSCLE_GROUPS } from '../constants/muscles'

const CATALOG_PATH = '/data/exercises.seed.json'

export async function fetchExerciseCatalog() {
  const response = await fetch(CATALOG_PATH)
  if (!response.ok) {
    throw new Error('Failed to load exercise catalog.')
  }

  const payload = await response.json()
  return {
    schemaVersion: payload.schemaVersion,
    updatedAt: payload.updatedAt,
    exercises: payload.exercises ?? [],
  }
}

export function listEquipmentOptions(exercises) {
  return [...new Set(exercises.flatMap((exercise) => exercise.equipment))].sort()
}

export const MUSCLE_OPTIONS = MUSCLE_GROUPS.flatMap((group) => group.muscles)

export function formatLabel(value) {
  return value.replaceAll('_', ' ')
}
