import { createPortal } from 'react-dom'

const VIEWPORT_PADDING = 12

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function formatNumber(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return '0'
  }

  return Number.isInteger(numeric) ? String(numeric) : String(numeric)
}

export default function ScrubNumberOverlay({ open, anchorRect, value, step = 1, unit = '', pulseKey = 0, overlayRef }) {
  if (!open || !anchorRect) {
    return null
  }

  const viewportWidth = window.innerWidth
  const clampedLeft = clamp(anchorRect.left + anchorRect.width / 2, VIEWPORT_PADDING, viewportWidth - VIEWPORT_PADDING)
  const prefersBelow = anchorRect.top < 110

  const style = {
    left: clampedLeft,
    top: prefersBelow ? anchorRect.bottom + 12 : anchorRect.top - 12,
    transform: prefersBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
    maxWidth: `${Math.max(120, viewportWidth - VIEWPORT_PADDING * 2)}px`,
  }

  const center = Number(value || 0)
  const above = center + step
  const below = center - step

  return createPortal(
    <div className="scrub-overlay-anchored" style={{ pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 120 }}>
      <div ref={overlayRef} className="slot-overlay-glass" style={{ ...style, position: 'fixed', pointerEvents: 'none' }}>
        <span className="slot-handle" />
        <div className="slot-value-stack">
          <span className="slot-muted">{formatNumber(above)}{unit ? <small>{unit}</small> : null}</span>
          <strong key={pulseKey} className="slot-center">{formatNumber(center)}{unit ? <small>{unit}</small> : null}</strong>
          <span className="slot-muted">{formatNumber(Math.max(0, below))}{unit ? <small>{unit}</small> : null}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
