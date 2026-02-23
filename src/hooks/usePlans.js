import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExerciseRepo } from '../storage/repositories/ExerciseRepo'
import { PlanRepo } from '../storage/repositories/PlanRepo'
import { getPlanWithDetails } from '../storage/selectors/getPlanWithDetails'

function toUiExercise(planExercise, exercise) {
  return {
    id: planExercise.id,
    exerciseId: planExercise.exerciseId || '',
    exerciseName: exercise?.name || '',
    muscles: Array.isArray(exercise?.muscles) ? exercise.muscles : [],
    equipment: Array.isArray(exercise?.equipment) ? exercise.equipment : [],
    sets: Array.isArray(planExercise.sets) ? planExercise.sets : [],
  }
}

function toUiPlan(plan, exerciseById) {
  return {
    id: plan.id,
    name: plan.name || 'New Plan',
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    exercises: (plan.exercises || []).map((item) => toUiExercise(item, exerciseById.get(item.exerciseId))),
  }
}

function toRepoPlan(plan = {}) {
  return {
    id: plan.id,
    name: typeof plan.name === 'string' && plan.name.trim() ? plan.name : 'New Plan',
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    exercises: Array.isArray(plan.exercises)
      ? plan.exercises.map((item, index) => ({
        id: item.id,
        exerciseId: item.exerciseId || '',
        order: Number.isFinite(item.order) ? item.order : index,
        sets: Array.isArray(item.sets)
          ? item.sets.map((setRow, setIndex) => ({
            id: setRow.id,
            order: Number.isFinite(setRow.order) ? setRow.order : setIndex,
            reps: Number.isFinite(setRow.reps) ? Math.max(0, Math.round(setRow.reps)) : 0,
            weight: Number.isFinite(setRow.weight) ? Math.max(0, Number(setRow.weight)) : 0,
            restSec: Number.isFinite(setRow.restSec) ? Math.max(0, Math.round(setRow.restSec)) : 0,
          }))
          : [],
      }))
      : [],
  }
}

export default function usePlans() {
  const [plans, setPlans] = useState([])
  const [exerciseById, setExerciseById] = useState(new Map())
  const [driveStatus, setDriveStatus] = useState('loading')
  const [driveError, setDriveError] = useState(null)

  const hydratePlans = useCallback(async () => {
    setDriveError(null)

    try {
      const [loadedPlans, loadedExercises] = await Promise.all([PlanRepo.list(), ExerciseRepo.list()])
      const exerciseMap = new Map(loadedExercises.map((exercise) => [exercise.id, exercise]))
      setExerciseById(exerciseMap)
      setPlans(loadedPlans.map((plan) => toUiPlan(plan, exerciseMap)))
      setDriveStatus('ready')
    } catch (error) {
      console.warn('[plans] hydrate failed', error)
      setDriveStatus('error')
      setDriveError(error?.message?.slice(0, 180) || 'Couldn’t load your plans. Tap Retry.')
    }
  }, [])

  useEffect(() => {
    hydratePlans()
  }, [hydratePlans])

  const loadPlans = useCallback(async () => {
    await hydratePlans()
  }, [hydratePlans])

  const createPlan = useCallback(async (name = 'New Plan') => {
    const created = await PlanRepo.upsert({ name, exercises: [] })
    const nextPlan = toUiPlan(created, exerciseById)
    setPlans((current) => [nextPlan, ...current])
    setDriveStatus('ready')
    return nextPlan
  }, [exerciseById])

  const upsertPlan = useCallback(async (plan) => {
    const persisted = await PlanRepo.upsert(toRepoPlan(plan))
    const nextPlan = toUiPlan(persisted, exerciseById)

    setPlans((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === nextPlan.id)
      if (existingIndex < 0) {
        return [nextPlan, ...current]
      }

      const updated = [...current]
      updated[existingIndex] = nextPlan
      return updated
    })

    return nextPlan
  }, [exerciseById])

  const updatePlan = useCallback(async (planId, patch) => {
    const current = plans.find((entry) => entry.id === planId)
    if (!current) {
      throw new Error('Plan not found.')
    }

    return upsertPlan({ ...current, ...patch, id: current.id, createdAt: current.createdAt })
  }, [plans, upsertPlan])

  const deletePlan = useCallback(async (planId) => {
    await PlanRepo.delete(planId)
    setPlans((current) => current.filter((plan) => plan.id !== planId))
  }, [])

  const fetchPlanWithDetails = useCallback(async (planId) => {
    const details = await getPlanWithDetails(planId)
    if (!details) {
      return undefined
    }

    const uiPlan = {
      id: details.plan.id,
      name: details.plan.name,
      createdAt: details.plan.createdAt,
      updatedAt: details.plan.updatedAt,
      exercises: details.exercises.map((item) => ({
        id: item.id,
        exerciseId: item.exerciseId,
        exerciseName: item.exercise?.name || '',
        muscles: Array.isArray(item.exercise?.muscles) ? item.exercise.muscles : [],
        equipment: Array.isArray(item.exercise?.equipment) ? item.exercise.equipment : [],
        sets: item.sets || [],
      })),
    }

    return { ...details, uiPlan }
  }, [])

  const sortedPlans = useMemo(
    () => plans.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [plans],
  )

  return {
    plans: sortedPlans,
    driveStatus,
    driveError,
    loadPlans,
    createPlan,
    updatePlan,
    deletePlan,
    upsertPlan,
    setPlans,
    getPlanWithDetails: fetchPlanWithDetails,
  }
}
