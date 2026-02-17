const KNOWN_TRACK_MODES = new Set(['reps_load', 'reps_only', 'time', 'distance'])

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDevMode() {
  return import.meta.env.DEV
}

export function validateExercisesPayload(payload) {
  const errors = []

  if (!isObject(payload)) {
    errors.push('catalog payload must be an object')
    return errors
  }

  if (!Array.isArray(payload.exercises)) {
    errors.push('exercises must be an array')
    return errors
  }

  const seenIds = new Set()

  payload.exercises.forEach((exercise, index) => {
    const label = `exercise[${index}]`

    if (!isObject(exercise)) {
      errors.push(`${label} must be an object`)
      return
    }

    const requiredFields = ['id', 'name', 'equipment', 'primaryMuscles', 'secondaryMuscles', 'trackMode']
    requiredFields.forEach((field) => {
      if (exercise[field] === undefined || exercise[field] === null || exercise[field] === '') {
        errors.push(`${label} missing required field: ${field}`)
      }
    })

    if (exercise.id) {
      if (seenIds.has(exercise.id)) {
        errors.push(`duplicate exercise id: ${exercise.id}`)
      }
      seenIds.add(exercise.id)
    }

    if (!Array.isArray(exercise.equipment)) {
      errors.push(`${label}.equipment must be an array`)
    }

    if (!Array.isArray(exercise.primaryMuscles)) {
      errors.push(`${label}.primaryMuscles must be an array`)
    }

    if (!Array.isArray(exercise.secondaryMuscles)) {
      errors.push(`${label}.secondaryMuscles must be an array`)
    }

    if (!KNOWN_TRACK_MODES.has(exercise.trackMode)) {
      errors.push(`${label}.trackMode must be one of: ${[...KNOWN_TRACK_MODES].join(', ')}`)
    }
  })

  return errors
}

export function logExerciseValidationErrors(payload) {
  if (!isDevMode()) {
    return
  }

  const errors = validateExercisesPayload(payload)
  if (!errors.length) {
    return
  }

  console.error('[Lifti] Exercise seed validation failed:\n- ' + errors.join('\n- '))
}
