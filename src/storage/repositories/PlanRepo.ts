import type { Plan, PlanExercise, PlanSet } from '../../domain/models'
import { db, withTimestamps } from '../db'

export type HydratedPlan = Plan & {
  exercises: (PlanExercise & { sets: PlanSet[] })[]
}

async function listPlanExercises(planId: string) {
  const planExercises = await db.planExercises.where('planId').equals(planId).sortBy('order')
  if (!planExercises.length) {
    return []
  }

  const sets = await db.planSets.where('planExerciseId').anyOf(planExercises.map((item) => item.id)).toArray()

  return planExercises.map((item) => ({
    ...item,
    sets: sets
      .filter((setRow) => setRow.planExerciseId === item.id)
      .sort((a, b) => a.order - b.order),
  }))
}

export const PlanRepo = {
  async get(id: string): Promise<HydratedPlan | undefined> {
    const plan = await db.plans.get(id)
    if (!plan) {
      return undefined
    }

    return {
      ...plan,
      exercises: await listPlanExercises(plan.id),
    }
  },

  async list(): Promise<HydratedPlan[]> {
    const plans = await db.plans.orderBy('updatedAt').reverse().toArray()

    return Promise.all(plans.map(async (plan) => ({
      ...plan,
      exercises: await listPlanExercises(plan.id),
    })))
  },

  async upsert(entity: Partial<HydratedPlan> & Pick<Plan, 'name'>): Promise<HydratedPlan> {
    const nextPlan = withTimestamps(entity) as Plan

    await db.transaction('rw', db.plans, db.planExercises, db.planSets, async () => {
      await db.plans.put(nextPlan)

      if (Array.isArray(entity.exercises)) {
        const nextExerciseIds = entity.exercises.map((item) => item.id)
        const existingExercises = await db.planExercises.where('planId').equals(nextPlan.id).toArray()
        const staleExerciseIds = existingExercises
          .filter((item) => !nextExerciseIds.includes(item.id))
          .map((item) => item.id)

        if (staleExerciseIds.length) {
          await db.planSets.where('planExerciseId').anyOf(staleExerciseIds).delete()
          await db.planExercises.bulkDelete(staleExerciseIds)
        }

        for (const [index, item] of entity.exercises.entries()) {
          const nextExercise = withTimestamps({ ...item, planId: nextPlan.id, order: index }) as PlanExercise
          await db.planExercises.put(nextExercise)

          const nextSets = Array.isArray(item.sets) ? item.sets : []
          const setIds = nextSets.map((setRow) => setRow.id)
          const existingSets = await db.planSets.where('planExerciseId').equals(nextExercise.id).toArray()
          const staleSetIds = existingSets.filter((setRow) => !setIds.includes(setRow.id)).map((setRow) => setRow.id)
          if (staleSetIds.length) {
            await db.planSets.bulkDelete(staleSetIds)
          }

          for (const [setIndex, setRow] of nextSets.entries()) {
            const nextSet = withTimestamps({
              ...setRow,
              planExerciseId: nextExercise.id,
              order: setIndex,
            }) as PlanSet
            await db.planSets.put(nextSet)
          }
        }
      }
    })

    return {
      ...nextPlan,
      exercises: await listPlanExercises(nextPlan.id),
    }
  },

  async delete(id: string) {
    await db.transaction('rw', db.plans, db.planExercises, db.planSets, async () => {
      const exercises = await db.planExercises.where('planId').equals(id).toArray()
      const exerciseIds = exercises.map((item) => item.id)
      if (exerciseIds.length) {
        await db.planSets.where('planExerciseId').anyOf(exerciseIds).delete()
        await db.planExercises.bulkDelete(exerciseIds)
      }

      await db.plans.delete(id)
    })
  },
}
