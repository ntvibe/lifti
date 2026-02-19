export default function ScrubNumberOverlay({ active, x, y, label, value }) {
  if (!active) {
    return null
  }

  return (
    <div className="scrub-overlay slot-overlay" style={{ left: x, top: y }}>
      <small>{label}</small>
      <div className="slot-value-stack">
        <span>{Math.max(0, Number(value || 0) - 1)}</span>
        <strong>{value}</strong>
        <span>{Number(value || 0) + 1}</span>
      </div>
    </div>
  )
}
