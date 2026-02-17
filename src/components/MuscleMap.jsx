import { useEffect, useRef, useState } from 'react'

function getGroupKey(id) {
  return id.replace(/\d+$/, '')
}

export default function MuscleMap({ value, onChange }) {
  const containerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const [selectedGroups, setSelectedGroups] = useState(() => new Set(value || []))

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!Array.isArray(value)) {
      return
    }

    setSelectedGroups(new Set(value))
  }, [value])

  useEffect(() => {
    let isMounted = true

    const handleMuscleClick = (event) => {
      const target = event.target
      if (!(target instanceof SVGPathElement) || !target.classList.contains('muscle')) {
        return
      }

      const group = target.dataset.group
      if (!group) {
        return
      }

      setSelectedGroups((previous) => {
        const next = new Set(previous)

        if (next.has(group)) {
          next.delete(group)
        } else {
          next.add(group)
        }

        onChangeRef.current?.(Array.from(next))
        return next
      })
    }

    const loadSvg = async () => {
      const response = await fetch('/svg/muscle-groups.svg')
      const svgMarkup = await response.text()

      if (!isMounted || !containerRef.current) {
        return
      }

      containerRef.current.innerHTML = svgMarkup

      const pathEls = containerRef.current.querySelectorAll('path[id]')
      pathEls.forEach((pathEl) => {
        const id = pathEl.id
        const d = pathEl.getAttribute('d') || ''

        if (id === 'fig-front' || id === 'fig-back' || d.trim() === '') {
          return
        }

        const groupKey = getGroupKey(id)
        pathEl.dataset.group = groupKey
        pathEl.classList.add('muscle')
      })

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
      pathEl.classList.toggle('active', selectedGroups.has(pathEl.dataset.group))
    })
  }, [selectedGroups])

  return <div className="muscle-map" ref={containerRef} aria-label="Interactive muscle map" />
}

export { getGroupKey }
