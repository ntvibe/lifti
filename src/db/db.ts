import Dexie, { type Table } from 'dexie';
import type {
    ExerciseTemplate, Plan, PlanExercise, PlanSet,
    WorkoutSession,
} from '../types/domain';
import { createDefaultSet, deepClone } from '../types/helpers';

export interface SyncMetaRecord {
    key: string;
    value: string;
}

export interface SyncQueueRecord {
    id: string;
    entityType: 'plan' | 'session' | 'exercise';
    entityId: string;
    updatedAt: number;
}

// ── Schema ──

class LiftiDB extends Dexie {
    exercises!: Table<ExerciseTemplate>;
    plans!: Table<Plan>;
    sessions!: Table<WorkoutSession>;
    syncMeta!: Table<SyncMetaRecord>;
    syncQueue!: Table<SyncQueueRecord>;

    constructor() {
        super('LiftiDB');
        this.version(1).stores({
            exercises: 'id, name, mode, isCustom',
            plans: 'id, updatedAt',
            sessions: 'id, planId, startedAt, updatedAt',
        });
        this.version(2).stores({
            exercises: 'id, name, mode, isCustom',
            plans: 'id, updatedAt',
            sessions: 'id, planId, startedAt, updatedAt',
            syncMeta: 'key',
            syncQueue: 'id, entityType, entityId, updatedAt',
        });
    }
}

export const db = new LiftiDB();

async function trackSyncChange(entityType: SyncQueueRecord['entityType'], entityId: string, updatedAt: number) {
    await db.syncQueue.put({
        id: `${entityType}:${entityId}`,
        entityType,
        entityId,
        updatedAt,
    });
}

export const syncMetaRepo = {
    async get(key: string): Promise<string | undefined> {
        const row = await db.syncMeta.get(key);
        return row?.value;
    },

    async set(key: string, value: string) {
        await db.syncMeta.put({ key, value });
    },

    async remove(key: string) {
        await db.syncMeta.delete(key);
    },
};

export const syncQueueRepo = {
    async count() {
        return db.syncQueue.count();
    },

    async clear() {
        await db.syncQueue.clear();
    },
};

export const exerciseRepo = {
    async bulkAdd(exercises: ExerciseTemplate[]) {
        const updatedAt = Date.now();
        await db.exercises.bulkPut(exercises);
        await Promise.all(
            exercises.map(exercise => trackSyncChange('exercise', exercise.id, updatedAt)),
        );
    },
};

// ── Plan Repository (type-safe, full-object puts) ──

export const planRepo = {
    async create(name: string): Promise<Plan> {
        const now = Date.now();
        const plan: Plan = {
            id: crypto.randomUUID(),
            name,
            exercises: [],
            createdAt: now,
            updatedAt: now,
        };
        await db.plans.add(plan);
        await trackSyncChange('plan', plan.id, now);
        return plan;
    },

    async get(id: string) {
        return db.plans.get(id);
    },

    async rename(plan: Plan, name: string) {
        const updatedAt = Date.now();
        const updated = { ...plan, name, updatedAt };
        await db.plans.put(updated);
        await trackSyncChange('plan', updated.id, updatedAt);
        return updated;
    },

    async addExercise(plan: Plan, template: ExerciseTemplate, sets?: PlanSet[]): Promise<Plan> {
        const instance: PlanExercise = {
            id: crypto.randomUUID(),
            templateId: template.id,
            sets: sets && sets.length > 0 ? deepClone(sets) : [createDefaultSet(template.mode)],
        };
        const updatedAt = Date.now();
        const updated: Plan = {
            ...plan,
            exercises: [...plan.exercises, instance],
            updatedAt,
        };
        await db.plans.put(updated);
        await trackSyncChange('plan', updated.id, updatedAt);
        return updated;
    },

    async removeExercise(plan: Plan, exerciseIndex: number): Promise<Plan> {
        const exercises = plan.exercises.filter((_, i) => i !== exerciseIndex);
        const updatedAt = Date.now();
        const updated: Plan = { ...plan, exercises, updatedAt };
        await db.plans.put(updated);
        await trackSyncChange('plan', updated.id, updatedAt);
        return updated;
    },

    async reorderExercises(plan: Plan, fromIndex: number, toIndex: number): Promise<Plan> {
        const exercises = [...plan.exercises];
        const [moved] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, moved);
        const updatedAt = Date.now();
        const updated: Plan = { ...plan, exercises, updatedAt };
        await db.plans.put(updated);
        await trackSyncChange('plan', updated.id, updatedAt);
        return updated;
    },

    async updateSets(plan: Plan, exerciseIndex: number, sets: PlanSet[]): Promise<Plan> {
        const exercises = deepClone(plan.exercises);
        exercises[exerciseIndex].sets = sets;
        const updatedAt = Date.now();
        const updated: Plan = { ...plan, exercises, updatedAt };
        await db.plans.put(updated);
        await trackSyncChange('plan', updated.id, updatedAt);
        return updated;
    },

    async delete(id: string) {
        const updatedAt = Date.now();
        await db.plans.delete(id);
        await trackSyncChange('plan', id, updatedAt);
    },
};

// ── Session Repository ──

export const sessionRepo = {
    async create(session: WorkoutSession) {
        await db.sessions.add(session);
        await trackSyncChange('session', session.id, session.updatedAt);
    },

    async update(session: WorkoutSession) {
        const updatedAt = Date.now();
        await db.sessions.put({ ...session, updatedAt });
        await trackSyncChange('session', session.id, updatedAt);
    },

    async finish(session: WorkoutSession) {
        const updatedAt = Date.now();
        await db.sessions.put({
            ...session,
            finishedAt: updatedAt,
            updatedAt,
        });
        await trackSyncChange('session', session.id, updatedAt);
    },
};
