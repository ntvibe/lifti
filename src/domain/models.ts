export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface Exercise extends BaseEntity {
  name: string
  muscles: string[]
  equipment: string[]
  instructions?: string[]
  aliases?: string[]
}

export interface Plan extends BaseEntity {
  name: string
  notes?: string
}

export interface PlanExercise extends BaseEntity {
  planId: string
  exerciseId: string
  order: number
}

export interface PlanSet extends BaseEntity {
  planExerciseId: string
  order: number
  reps: number
  weight: number
  restSec: number
}

// Workout sessions are immutable snapshots of a plan template at run time.
export interface WorkoutSession extends BaseEntity {
  planId: string
  planName: string
  date: string
  startedAt: string
  endedAt?: string
  totalPausedMs: number
}

export interface SessionSet extends BaseEntity {
  workoutSessionId: string
  exerciseId: string
  exerciseName: string
  order: number
  reps: number
  weight: number
  restSec: number
  completedAt?: string
}

export interface AppMeta extends BaseEntity {
  key: string
  value: unknown
}
