import { useEffect, useMemo, useState } from 'react'

function formatValue(value, allowDecimal) {
  if (value === '' || value === null || value === undefined) {
    return '0'
  }

  return allowDecimal ? String(Number(value)) : String(Math.round(Number(value)))
}

export default function CustomNumberPad({ isOpen, type, value, onClose, onDone }) {
  const allowDecimal = type === 'weight'
  const nudges = useMemo(() => {
    if (type === 'weight') {
      return [-10, -5, -2.5, 2.5, 5, 10]
    }
    return [-10, -5, 5, 10]
  }, [type])

  const [draft, setDraft] = useState('0')

  useEffect(() => {
    if (isOpen) {
      setDraft(formatValue(value, allowDecimal))
    }
  }, [isOpen, value, allowDecimal])

  if (!isOpen) {
    return null
  }

  const append = (char) => {
    setDraft((current) => {
      if (char === '.' && (!allowDecimal || current.includes('.'))) {
        return current
      }

      if (current === '0' && char !== '.') {
        return char
      }

      return `${current}${char}`
    })
  }

  const toNumber = (raw) => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return 0
    }

    if (allowDecimal) {
      return Math.max(0, parsed)
    }

    return Math.max(0, Math.round(parsed))
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="number-pad-sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>{type === 'restSec' ? 'Rest (sec)' : type === 'reps' ? 'Reps' : 'Weight'}</h3>
        <p className="number-pad-value">{draft}</p>

        <div className="number-pad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button key={digit} type="button" onClick={() => append(String(digit))}>{digit}</button>
          ))}
          <button type="button" onClick={() => setDraft('0')}>C</button>
          <button type="button" onClick={() => append('0')}>0</button>
          <button type="button" onClick={() => setDraft((value) => value.length <= 1 ? '0' : value.slice(0, -1))}>⌫</button>
          {allowDecimal ? <button type="button" onClick={() => append('.')}>.</button> : null}
        </div>

        <div className="nudge-row">
          {nudges.map((step) => (
            <button key={step} type="button" className="ghost" onClick={() => setDraft(String(toNumber(draft) + step >= 0 ? toNumber(draft) + step : 0))}>
              {step > 0 ? `+${step}` : step}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => onDone(toNumber(draft))}>Done</button>
      </section>
    </div>
  )
}
