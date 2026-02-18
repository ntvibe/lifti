import { readJson, updateJson } from '../services/driveAppData'

const DEFAULT_PLANS_PAYLOAD = { plans: [] }

function normalizeExerciseType(exercise = {}) {
  if (exercise.type) {
    return exercise.type
  }

  if (exercise.trackMode === 'reps_load') {
    return 'weights'
  }

  return 'bodyweight'
}

export async function loadSavedExercises(accessToken, fileIds) {
  if (!accessToken || !fileIds?.exercises) {
    return []
  }

  const data = await readJson(accessToken, fileIds.exercises)
  const list = Array.isArray(data?.exercises) ? data.exercises : []

  return list.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    primaryMuscles: exercise.primaryMuscles || [],
    equipment: exercise.equipment || [],
    type: normalizeExerciseType(exercise),
  }))
}

export async function saveWorkoutPlan(accessToken, fileIds, plan) {
  if (!accessToken || !fileIds?.plans) {
    throw new Error('Missing account connection for plans.')
  }

  const payload = await readJson(accessToken, fileIds.plans).catch(() => DEFAULT_PLANS_PAYLOAD)
  const plans = Array.isArray(payload?.plans) ? payload.plans : []
  const updatedAt = new Date().toISOString()
  const nextPlan = {
    ...plan,
    updatedAt,
  }

  const nextPlans = plans.some((entry) => entry.id === nextPlan.id)
    ? plans.map((entry) => (entry.id === nextPlan.id ? nextPlan : entry))
    : [...plans, nextPlan]

  await updateJson(accessToken, fileIds.plans, {
    ...payload,
    plans: nextPlans,
  })

  return nextPlan
}
