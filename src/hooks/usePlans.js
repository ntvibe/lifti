import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createJson,
  deleteDriveFile,
  ensureDriveClientReady,
  isAuthExpiredError,
  readPlanFiles,
  updateJson,
} from '../services/driveAppData'

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10_000)}`
}

function normalizeSetRow(setRow = {}) {
  return {
    id: setRow.id || createId('set'),
    reps: Number.isFinite(setRow.reps) ? Math.max(0, Math.round(setRow.reps)) : 0,
    weight: Number.isFinite(setRow.weight) ? Math.max(0, Number(setRow.weight)) : 0,
    restSec: Number.isFinite(setRow.restSec) ? Math.max(0, Math.round(setRow.restSec)) : 0,
  }
}

function normalizePlanExercise(item = {}) {
  return {
    id: item.id || createId('item'),
    exerciseId: item.exerciseId || '',
    exerciseName: item.exerciseName || '',
    muscles: Array.isArray(item.muscles) ? item.muscles : [],
    equipment: Array.isArray(item.equipment) ? item.equipment : [],
    sets: Array.isArray(item.sets) ? item.sets.map(normalizeSetRow) : [],
  }
}

function normalizePlan(plan = {}) {
  const now = new Date().toISOString()
  const exercises = Array.isArray(plan.exercises)
    ? plan.exercises.map(normalizePlanExercise)
    : Array.isArray(plan.items)
      ? plan.items.map(normalizePlanExercise)
      : []

  return {
    id: plan.id || createId('plan'),
    name: typeof plan.name === 'string' ? plan.name : 'New Plan',
    createdAt: plan.createdAt || now,
    updatedAt: plan.updatedAt || now,
    exercises,
    fileId: plan.fileId || plan._fileId || '',
  }
}

function toPersistedPlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    exercises: plan.exercises,
  }
}

export default function usePlans({ accessToken, onAuthExpired }) {
  const [plans, setPlans] = useState([])
  const [driveStatus, setDriveStatus] = useState('idle')
  const [driveError, setDriveError] = useState(null)
  const timeoutRef = useRef(null)

  const clearWatchdog = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const loadPlans = useCallback(async () => {
    if (!accessToken) {
      clearWatchdog()
      setPlans([])
      setDriveStatus('idle')
      setDriveError(null)
      return
    }

    setDriveStatus('loading')
    setDriveError(null)
    clearWatchdog()

    timeoutRef.current = window.setTimeout(() => {
      setDriveStatus('error')
      setDriveError('Couldn’t load your plans. Tap Retry.')
    }, 10_000)

    try {
      await ensureDriveClientReady(accessToken)
      const { plans: loadedPlans } = await readPlanFiles(accessToken)
      const normalizedPlans = loadedPlans.map((plan) => normalizePlan(plan))
      setPlans(normalizedPlans)
      setDriveStatus('ready')
    } catch (error) {
      console.warn('[drive] loadPlans failed', error)
      if (isAuthExpiredError(error)) {
        onAuthExpired?.()
        return
      }

      setDriveStatus('error')
      setDriveError(error?.message?.slice(0, 180) || 'Couldn’t load your plans. Tap Retry.')
    } finally {
      clearWatchdog()
    }
  }, [accessToken, clearWatchdog, onAuthExpired])

  useEffect(() => {
    loadPlans()
    return () => clearWatchdog()
  }, [loadPlans, clearWatchdog])

  const createPlan = useCallback(async (name = 'New Plan') => {
    if (!accessToken) {
      throw new Error('Missing account connection for plans.')
    }

    const now = new Date().toISOString()
    const plan = normalizePlan({ name, createdAt: now, updatedAt: now, exercises: [] })
    const createdFile = await createJson(accessToken, `lifti_plan_${plan.id}.json`, toPersistedPlan(plan))
    const nextPlan = { ...plan, fileId: createdFile.id }
    setPlans((current) => [...current, nextPlan])
    setDriveStatus('ready')
    return nextPlan
  }, [accessToken])

  const updatePlan = useCallback(async (planId, patch) => {
    if (!accessToken) {
      throw new Error('Missing account connection for plans.')
    }

    const currentPlan = plans.find((plan) => plan.id === planId)
    if (!currentPlan) {
      throw new Error('Plan not found.')
    }

    const now = new Date().toISOString()
    const updatedPlan = normalizePlan({
      ...currentPlan,
      ...patch,
      id: currentPlan.id,
      createdAt: currentPlan.createdAt,
      updatedAt: now,
      fileId: currentPlan.fileId,
    })

    if (currentPlan.fileId) {
      await updateJson(accessToken, currentPlan.fileId, toPersistedPlan(updatedPlan))
    } else {
      const created = await createJson(accessToken, `lifti_plan_${updatedPlan.id}.json`, toPersistedPlan(updatedPlan))
      updatedPlan.fileId = created.id
    }

    setPlans((current) => current.map((plan) => (plan.id === planId ? updatedPlan : plan)))
    return updatedPlan
  }, [accessToken, plans])

  const upsertPlan = useCallback(async (plan) => {
    if (!accessToken) {
      throw new Error('Missing account connection for plans.')
    }

    const normalized = normalizePlan(plan)
    const exists = plans.some((entry) => entry.id === normalized.id)
    if (exists) {
      return updatePlan(normalized.id, normalized)
    }

    const createdFile = await createJson(accessToken, `lifti_plan_${normalized.id}.json`, toPersistedPlan(normalized))
    const nextPlan = { ...normalized, fileId: createdFile.id }
    setPlans((current) => [...current, nextPlan])
    return nextPlan
  }, [accessToken, plans, updatePlan])

  const deletePlan = useCallback(async (planId) => {
    if (!accessToken) {
      throw new Error('Missing account connection for plans.')
    }

    const existing = plans.find((plan) => plan.id === planId)
    if (existing?.fileId) {
      await deleteDriveFile(accessToken, existing.fileId)
    }

    setPlans((current) => current.filter((plan) => plan.id !== planId))
  }, [accessToken, plans])

  return {
    plans,
    driveStatus,
    driveError,
    loadPlans,
    createPlan,
    updatePlan,
    deletePlan,
    upsertPlan,
    setPlans,
  }
}
