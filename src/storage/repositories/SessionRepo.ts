import type { SessionSet, WorkoutSession } from '../../domain/models'
import { db, withTimestamps } from '../db'

export type HydratedSession = WorkoutSession & {
  sets: SessionSet[]
}

async function listSessionSets(workoutSessionId: string) {
  return db.sessionSets.where('workoutSessionId').equals(workoutSessionId).sortBy('order')
}

export const SessionRepo = {
  async get(id: string): Promise<HydratedSession | undefined> {
    const session = await db.workoutSessions.get(id)
    if (!session) {
      return undefined
    }

    return {
      ...session,
      sets: await listSessionSets(session.id),
    }
  },

  async list(): Promise<HydratedSession[]> {
    const sessions = await db.workoutSessions.orderBy('date').reverse().toArray()

    return Promise.all(sessions.map(async (session) => ({
      ...session,
      sets: await listSessionSets(session.id),
    })))
  },

  async upsert(entity: Partial<HydratedSession> & Pick<WorkoutSession, 'planName' | 'date' | 'startedAt'>): Promise<HydratedSession> {
    const nextSession = withTimestamps({ ...entity, totalPausedMs: entity.totalPausedMs ?? 0 }) as WorkoutSession

    await db.transaction('rw', db.workoutSessions, db.sessionSets, async () => {
      await db.workoutSessions.put(nextSession)

      if (Array.isArray(entity.sets)) {
        const nextSetIds = entity.sets.map((setRow) => setRow.id)
        const existingSets = await db.sessionSets.where('workoutSessionId').equals(nextSession.id).toArray()
        const staleSetIds = existingSets.filter((setRow) => !nextSetIds.includes(setRow.id)).map((setRow) => setRow.id)

        if (staleSetIds.length) {
          await db.sessionSets.bulkDelete(staleSetIds)
        }

        for (const [index, setRow] of entity.sets.entries()) {
          const nextSet = withTimestamps({
            ...setRow,
            workoutSessionId: nextSession.id,
            order: index,
          }) as SessionSet
          await db.sessionSets.put(nextSet)
        }
      }
    })

    return {
      ...nextSession,
      sets: await listSessionSets(nextSession.id),
    }
  },

  async delete(id: string) {
    await db.transaction('rw', db.workoutSessions, db.sessionSets, async () => {
      const sets = await db.sessionSets.where('workoutSessionId').equals(id).toArray()
      if (sets.length) {
        await db.sessionSets.bulkDelete(sets.map((setRow) => setRow.id))
      }

      await db.workoutSessions.delete(id)
    })
  },
}
