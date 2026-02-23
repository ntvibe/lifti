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
  const anchorX = anchorRect.left + anchorRect.width / 2
  const clampedLeft = clamp(anchorX, VIEWPORT_PADDING, viewportWidth - VIEWPORT_PADDING)
  const viewportHeight = window.innerHeight
  const anchorY = anchorRect.top + anchorRect.height / 2
  const clampedTop = clamp(anchorY, VIEWPORT_PADDING, viewportHeight - VIEWPORT_PADDING)

  const style = {
    left: clampedLeft,
    top: clampedTop,
    transform: 'translate(-50%, -50%)',
    maxWidth: `${Math.max(120, viewportWidth - VIEWPORT_PADDING * 2)}px`,
  }

  const center = Number(value || 0)
  const above = center + step
  const below = center - step

  return createPortal(
    <div className="scrub-overlay-anchored" style={{ pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 120 }}>
      <div ref={overlayRef} className="slot-overlay-stack" style={{ ...style, position: 'fixed', pointerEvents: 'none' }}>
        <span className="slot-muted slot-muted-top">{formatNumber(above)}{unit ? <small>{unit}</small> : null}</span>
        <div className="slot-overlay-glass">
          <span className="slot-handle" />
          <div className="slot-value-stack">
            <strong key={pulseKey} className="slot-center">{formatNumber(center)}{unit ? <small>{unit}</small> : null}</strong>
          </div>
        </div>
        <span className="slot-muted slot-muted-bottom">{formatNumber(Math.max(0, below))}{unit ? <small>{unit}</small> : null}</span>
      </div>
    </div>,
    document.body,
  )
}
