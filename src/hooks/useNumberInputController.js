import { useCallback, useState } from 'react'

export default function useNumberInputController({ onCommit }) {
  const [activeField, setActiveField] = useState(null)
  const [isKeypadOpen, setIsKeypadOpen] = useState(false)
  const [currentValue, setCurrentValue] = useState('')

  const openField = useCallback((field, value, options = {}) => {
    setActiveField(field)
    setCurrentValue(value === '' || value === null || value === undefined ? '' : String(value))
    setIsKeypadOpen(Boolean(options.openKeypad))
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

  return {
    activeField,
    isKeypadOpen,
    currentValue,
    setCurrentValue,
    openField,
    openKeypad,
    closeKeypad,
    close,
    commit,
  }
}
