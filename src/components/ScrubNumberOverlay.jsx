export default function ScrubNumberOverlay({ active, x, y, label, value }) {
  if (!active) {
    return null
  }

  return (
    <div className="scrub-overlay" style={{ left: x, top: y }}>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>Drag up/down</span>
    </div>
  )
}
