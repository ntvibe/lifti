import { MUSCLE_GROUPS } from '../constants/muscles'
import { toTitleCase } from '../utils/label'
import { normalizeKey } from '../utils/normalize'
import { logExerciseValidationErrors } from './validateExercises'

export function getPublicAssetUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`
}

const CATALOG_PATH = getPublicAssetUrl('data/exercises.seed.json')

export async function fetchExerciseCatalog() {
  const response = await fetch(CATALOG_PATH)
  if (!response.ok) {
    throw new Error('Failed to load exercise catalog.')
  }

  const payload = await response.json()
  logExerciseValidationErrors(payload)

  return {
    schemaVersion: payload.schemaVersion,
    updatedAt: payload.updatedAt,
    exercises: payload.exercises ?? [],
  }
}

export function listEquipmentOptions(exercises) {
  return [...new Set(exercises.flatMap((exercise) => {
    const equipment = exercise.equipment ?? exercise.equipments ?? exercise.gear ?? exercise.machine ?? []
    return (Array.isArray(equipment) ? equipment : [equipment])
      .map((item) => normalizeKey(item))
      .filter(Boolean)
  }))].sort((a, b) => a.localeCompare(b))
}

export const MUSCLE_OPTIONS = MUSCLE_GROUPS.flatMap((group) => group.muscles)

export function formatLabel(value = '') {
  return toTitleCase(value)
}
