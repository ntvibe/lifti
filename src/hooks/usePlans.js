import { useCallback, useEffect, useState } from 'react'
import { readJson, updateJson } from '../services/driveAppData'

const DEFAULT_PAYLOAD = { plans: [] }

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

function normalizePlanItem(item = {}) {
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
  return {
    id: plan.id || createId('plan'),
    name: typeof plan.name === 'string' ? plan.name : 'New Plan',
    createdAt: plan.createdAt || now,
    updatedAt: plan.updatedAt || now,
    items: Array.isArray(plan.items) ? plan.items.map(normalizePlanItem) : [],
  }
}

export default function usePlans({ accessToken, fileIds }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)

  const persistPlans = useCallback(async (nextPlans) => {
    if (!accessToken || !fileIds?.plans) {
      throw new Error('Missing account connection for plans.')
    }

    await updateJson(accessToken, fileIds.plans, { ...DEFAULT_PAYLOAD, plans: nextPlans })
    setPlans(nextPlans)
    return nextPlans
  }, [accessToken, fileIds])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      if (!accessToken || !fileIds?.plans) {
        setPlans([])
        return
      }

      setLoading(true)
      try {
        const payload = await readJson(accessToken, fileIds.plans).catch(() => DEFAULT_PAYLOAD)
        const loadedPlans = Array.isArray(payload?.plans) ? payload.plans.map(normalizePlan) : []
        if (mounted) {
          setPlans(loadedPlans)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [accessToken, fileIds])

  const createPlan = useCallback(async (name = 'New Plan') => {
    const now = new Date().toISOString()
    const plan = normalizePlan({ name, createdAt: now, updatedAt: now, items: [] })
    await persistPlans([...plans, plan])
    return plan
  }, [persistPlans, plans])

  const updatePlan = useCallback(async (planId, patch) => {
    let updatedPlan = null
    const now = new Date().toISOString()

    const nextPlans = plans.map((plan) => {
      if (plan.id !== planId) {
        return plan
      }

      updatedPlan = normalizePlan({
        ...plan,
        ...patch,
        id: plan.id,
        createdAt: plan.createdAt,
        updatedAt: now,
      })

      return updatedPlan
    })

    if (!updatedPlan) {
      throw new Error('Plan not found.')
    }

    await persistPlans(nextPlans)
    return updatedPlan
  }, [persistPlans, plans])

  const upsertPlan = useCallback(async (plan) => {
    const normalized = normalizePlan(plan)
    const now = new Date().toISOString()
    const exists = plans.some((entry) => entry.id === normalized.id)
    const nextPlan = { ...normalized, updatedAt: now, createdAt: normalized.createdAt || now }
    const nextPlans = exists
      ? plans.map((entry) => (entry.id === nextPlan.id ? nextPlan : entry))
      : [...plans, nextPlan]

    await persistPlans(nextPlans)
    return nextPlan
  }, [persistPlans, plans])

  const deletePlan = useCallback(async (planId) => {
    const nextPlans = plans.filter((plan) => plan.id !== planId)
    await persistPlans(nextPlans)
  }, [persistPlans, plans])

  return {
    plans,
    loading,
    createPlan,
    updatePlan,
    deletePlan,
    upsertPlan,
  }
}
