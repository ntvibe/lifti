import { formatLabel } from '../services/exerciseCatalog'

export default function TagToggleList({ items, selectedSet, onToggle }) {
  return (
    <div className="tag-toggle-list">
      {items.map((item) => {
        const isSelected = selectedSet.has(item)

        return (
          <button
            key={item}
            type="button"
            className={`tag-chip glass-chip select-none ${isSelected ? 'selected' : ''}`}
            onClick={() => onToggle(item)}
          >
            {formatLabel(item)}
          </button>
        )
      })}
    </div>
  )
}
