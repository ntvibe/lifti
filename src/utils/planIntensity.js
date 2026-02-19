import { normalizeKey } from './normalize'

function parseRepsValue(value, fallback = 1) {
  if (Number.isFinite(value)) {
    return Math.max(0, Number(value))
  }

  if (typeof value === 'string') {
    const match = value.match(/\d+(?:\.\d+)?/)
    if (match) {
      return Math.max(0, Number(match[0]))
    }
  }

  return fallback
}

function resolveMuscleGroups(planItem = {}, catalogExercise = null) {
  const fromItem = Array.isArray(planItem.muscles)
    ? planItem.muscles
    : Array.isArray(planItem.muscleGroups)
      ? planItem.muscleGroups
      : []

  if (fromItem.length) {
    return fromItem.map((entry) => normalizeKey(entry)).filter(Boolean)
  }

  if (!catalogExercise) {
    return []
  }

  const merged = [
    ...(Array.isArray(catalogExercise.primaryMuscles) ? catalogExercise.primaryMuscles : []),
    ...(Array.isArray(catalogExercise.secondaryMuscles) ? catalogExercise.secondaryMuscles : []),
    ...(Array.isArray(catalogExercise.muscleGroups) ? catalogExercise.muscleGroups : []),
  ]

  return merged.map((entry) => normalizeKey(entry)).filter(Boolean)
}

function buildDefaultSets(catalogExercise = {}) {
  if (Array.isArray(catalogExercise.defaultSets) && catalogExercise.defaultSets.length) {
    return catalogExercise.defaultSets
  }

  if (Array.isArray(catalogExercise.defaults?.sets) && catalogExercise.defaults.sets.length) {
    return catalogExercise.defaults.sets
  }

  const totalSets = Number.isFinite(catalogExercise.defaultSets)
    ? Math.max(1, Math.round(catalogExercise.defaultSets))
    : Number.isFinite(catalogExercise.defaultPrescription?.sets)
      ? Math.max(1, Math.round(catalogExercise.defaultPrescription.sets))
      : 3

  const defaultReps = parseRepsValue(
    catalogExercise.defaultReps ?? catalogExercise.defaultPrescription?.reps,
    1,
  )

  return Array.from({ length: totalSets }, () => ({ reps: defaultReps }))
}

function getExerciseVolume(planItem = {}, catalogExercise = null) {
  const sourceSets = Array.isArray(planItem.sets) && planItem.sets.length
    ? planItem.sets
    : buildDefaultSets(catalogExercise)

  return sourceSets.reduce((sum, setRow) => {
    const reps = parseRepsValue(
      setRow?.reps,
      parseRepsValue(catalogExercise?.defaultReps ?? catalogExercise?.defaultPrescription?.reps, 1),
    )
    return sum + (reps || 1)
  }, 0)
}

export function computePlanMuscleIntensities(planExercises = [], allExercises = []) {
  const catalogById = new Map(allExercises.map((exercise) => [exercise.id, exercise]))
  const contributions = {}

  for (const item of planExercises) {
    const catalogExercise = catalogById.get(item.exerciseId) || null
    const groups = resolveMuscleGroups(item, catalogExercise)
    if (!groups.length) {
      continue
    }

    const volume = getExerciseVolume(item, catalogExercise)
    if (volume <= 0) {
      continue
    }

    const perMuscleContribution = volume / groups.length
    groups.forEach((group) => {
      contributions[group] = (contributions[group] || 0) + perMuscleContribution
    })
  }

  const maxContribution = Math.max(0, ...Object.values(contributions))
  if (maxContribution <= 0) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(contributions).map(([group, value]) => {
      const normalized = value / maxContribution
      const intensity = normalized > 0 ? Math.max(0.2, normalized) : 0
      return [group, Math.min(1, Math.max(0, intensity))]
    }),
  )
}
