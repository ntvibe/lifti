import { MUSCLE_GROUPS } from '../constants/muscles'
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
  return [...new Set(exercises.flatMap((exercise) => exercise.equipment))].sort()
}

export const MUSCLE_OPTIONS = MUSCLE_GROUPS.flatMap((group) => group.muscles)

const KNOWN_ACRONYMS = new Set(['AMRAP', 'EMOM', 'HIIT', 'RPE', 'RM'])

export function formatLabel(value = '') {
  const normalized = String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const uppercaseWord = word.toUpperCase()
      if (KNOWN_ACRONYMS.has(uppercaseWord)) {
        return uppercaseWord
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`
    })
    .join(' ')
}
