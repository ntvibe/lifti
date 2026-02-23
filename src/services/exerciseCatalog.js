import { MUSCLE_GROUPS } from '../constants/muscles'
import { toTitleCase } from '../utils/label'
import { normalizeKey } from '../utils/normalize'
import { logExerciseValidationErrors } from './validateExercises'
import { db } from '../storage/db'
import { ExerciseRepo } from '../storage/repositories/ExerciseRepo'

export function getPublicAssetUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`
}

const CATALOG_PATH = getPublicAssetUrl('data/exercises.seed.json')

function mapSeedExercise(exercise = {}) {
  return {
    ...exercise,
    id: exercise.id,
    name: exercise.name || 'Unnamed Exercise',
    muscles: [
      ...(Array.isArray(exercise.primaryMuscles) ? exercise.primaryMuscles : []),
      ...(Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles : []),
    ],
    equipment: Array.isArray(exercise.equipment) ? exercise.equipment : [],
  }
}

export async function seedExercises() {
  const count = await db.exercises.count()
  if (count > 0) {
    return
  }

  const response = await fetch(CATALOG_PATH)
  if (!response.ok) {
    throw new Error('Failed to load exercise catalog.')
  }

  const payload = await response.json()
  logExerciseValidationErrors(payload)

  for (const seed of payload.exercises ?? []) {
    await ExerciseRepo.upsert(mapSeedExercise(seed))
  }
}

export async function fetchExerciseCatalog() {
  await seedExercises()
  const exercises = await ExerciseRepo.list()

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    exercises,
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
