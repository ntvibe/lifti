import Dexie, { type EntityTable } from 'dexie'
import type {
  AppMeta,
  Exercise,
  Plan,
  PlanExercise,
  PlanSet,
  SessionSet,
  WorkoutSession,
} from '../domain/models'

export class LiftiDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  plans!: EntityTable<Plan, 'id'>
  planExercises!: EntityTable<PlanExercise, 'id'>
  planSets!: EntityTable<PlanSet, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  sessionSets!: EntityTable<SessionSet, 'id'>
  meta!: EntityTable<AppMeta, 'id'>

  constructor() {
    super('lifti')

    this.version(1).stores({
      exercises: 'id, name, updatedAt',
      plans: 'id, updatedAt, createdAt',
      planExercises: 'id, planId, exerciseId, order, updatedAt',
      planSets: 'id, planExerciseId, order, updatedAt',
      workoutSessions: 'id, date, startedAt, updatedAt',
      sessionSets: 'id, workoutSessionId, exerciseId, order, updatedAt',
      meta: 'id, key, updatedAt',
    })

    this.version(2).stores({
      exercises: 'id, name, updatedAt',
      plans: 'id, updatedAt, createdAt',
      planExercises: 'id, planId, exerciseId, order, updatedAt',
      planSets: 'id, planExerciseId, order, updatedAt',
      workoutSessions: 'id, date, startedAt, updatedAt',
      sessionSets: 'id, workoutSessionId, exerciseId, order, updatedAt',
      meta: 'id, key, updatedAt',
    }).upgrade((_tx) => {
      // Placeholder for future schema/data migration.
    })
  }
}

export const db = new LiftiDb()

export function createEntityId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
}

export function withTimestamps(entity = {}) {
  const now = new Date().toISOString()
  return {
    ...entity,
    id: entity.id || createEntityId(),
    createdAt: entity.createdAt || now,
    updatedAt: now,
  }
}
