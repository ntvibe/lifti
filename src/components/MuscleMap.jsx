import { useEffect, useMemo, useRef } from 'react'
import { formatLabel } from '../services/exerciseCatalog'
import { normalizeKey } from '../utils/normalize'

function getGroupKey(id) {
  return normalizeKey(id.replace(/\d+$/, ''))
}

const SILHOUETTE_FILL = '#ffffff'
const SILHOUETTE_OPACITY = '0.5'
const DEFAULT_MUSCLE_FILL = '#ffffff'
const ACTIVE_MUSCLE_FILL = '#3b82f6'

export default function MuscleMap({ value, onChange, onGroupsChange }) {
  const containerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onGroupsChangeRef = useRef(onGroupsChange)
  const valueRef = useRef(value)
  const selectedGroups = useMemo(() => new Set(value || []), [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onGroupsChangeRef.current = onGroupsChange
  }, [onGroupsChange])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    let isMounted = true

    const handleMuscleClick = (event) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      const idElement = target.closest('[id]')
      if (!idElement) {
        return
      }

      const id = idElement.id
      if (!id || id === 'fig-front' || id === 'fig-back') {
        return
      }

      const group = getGroupKey(id)

      if (!group) {
        return
      }

      const next = new Set(valueRef.current || [])
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }

      onChangeRef.current?.(Array.from(next))
    }

    const loadSvg = async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}svg/muscle-groups.svg`)
      const svgMarkup = await response.text()

      if (!isMounted || !containerRef.current) {
        return
      }

      containerRef.current.innerHTML = svgMarkup

      const pathEls = containerRef.current.querySelectorAll('path[id]')
      const groupKeys = new Set()

      pathEls.forEach((pathEl) => {
        const id = pathEl.id
        const d = pathEl.getAttribute('d') || ''

        if (id === 'fig-front' || id === 'fig-back') {
          pathEl.style.fill = SILHOUETTE_FILL
          pathEl.style.opacity = SILHOUETTE_OPACITY
          return
        }

        if (d.trim() === '') {
          return
        }

        const groupKey = getGroupKey(id)
        groupKeys.add(groupKey)
        pathEl.dataset.group = groupKey
        pathEl.classList.add('muscle')
        pathEl.style.fill = DEFAULT_MUSCLE_FILL
        pathEl.style.opacity = '1'
      })

      const sortedGroups = [...groupKeys].sort((a, b) => formatLabel(a).localeCompare(formatLabel(b)))
      onGroupsChangeRef.current?.(sortedGroups)

      containerRef.current.addEventListener('click', handleMuscleClick)
    }

    loadSvg().catch(() => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '<p class="error">Unable to load muscle map.</p>'
      }
    })

    return () => {
      isMounted = false
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleMuscleClick)
      }
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const musclePaths = containerRef.current.querySelectorAll('path.muscle')
    musclePaths.forEach((pathEl) => {
      const isSelected = selectedGroups.has(pathEl.dataset.group)
      pathEl.classList.toggle('active', isSelected)
      pathEl.style.fill = isSelected ? ACTIVE_MUSCLE_FILL : DEFAULT_MUSCLE_FILL
      pathEl.style.opacity = '1'
    })
  }, [selectedGroups])

  return <div className="muscle-map" ref={containerRef} aria-label="Interactive muscle map" />
}

export { getGroupKey }
