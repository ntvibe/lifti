import type { Exercise } from '../../domain/models'
import { db, withTimestamps } from '../db'

export const ExerciseRepo = {
  async get(id: string) {
    return db.exercises.get(id)
  },

  async list() {
    return db.exercises.orderBy('name').toArray()
  },

  async upsert(entity: Partial<Exercise> & Pick<Exercise, 'name'>) {
    const nextEntity = withTimestamps(entity) as Exercise
    await db.exercises.put(nextEntity)
    return nextEntity
  },

  async delete(id: string) {
    await db.exercises.delete(id)
  },
}
