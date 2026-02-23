import { useCallback, useState } from 'react'

export default function useNumberInputController({ onCommit }) {
  const [activeField, setActiveField] = useState(null)
  const [isKeypadOpen, setIsKeypadOpen] = useState(false)
  const [currentValue, setCurrentValue] = useState('')

  const openField = useCallback((field, value) => {
    setActiveField(field)
    setCurrentValue(value === '' || value === null || value === undefined ? '' : String(value))
  }, [])

  const close = useCallback(() => {
    setIsKeypadOpen(false)
    setActiveField(null)
    setCurrentValue('')
  }, [])

  const openKeypad = useCallback(() => {
    setIsKeypadOpen(true)
  }, [])

  const closeKeypad = useCallback(() => {
    setIsKeypadOpen(false)
  }, [])

  const commit = useCallback((value) => {
    if (!activeField) {
      return
    }

    const next = value ?? currentValue
    onCommit(activeField, next)
    setCurrentValue(next === '' || next === null || next === undefined ? '' : String(next))
  }, [activeField, currentValue, onCommit])

  const nudge = useCallback((delta) => {
    if (!activeField) {
      return
    }

    const baseValue = Number(currentValue || 0)
    const nextValue = Number.isFinite(baseValue) ? baseValue + delta : delta
    commit(String(nextValue))
  }, [activeField, commit, currentValue])

  return {
    activeField,
    isKeypadOpen,
    currentValue,
    setCurrentValue,
    openField,
    openKeypad,
    closeKeypad,
    close,
    nudge,
    commit,
  }
}
