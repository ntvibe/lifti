import { ExerciseRepo } from '../repositories/ExerciseRepo'
import { PlanRepo } from '../repositories/PlanRepo'

export async function getPlanWithDetails(planId: string) {
  const [plan, exercises] = await Promise.all([
    PlanRepo.get(planId),
    ExerciseRepo.list(),
  ])

  if (!plan) {
    return undefined
  }

  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const sets = plan.exercises.flatMap((item) => item.sets)

  return {
    plan,
    exercises: plan.exercises.map((item) => ({
      ...item,
      exercise: exerciseById.get(item.exerciseId),
    })),
    sets,
  }
}

