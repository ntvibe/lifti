import { useEffect, useMemo, useState } from 'react'
import { normalizeKey } from '../utils/normalize'

const svgCache = new Map()

function toGroupKey(id = '') {
  return normalizeKey(id.replace(/[0-9]+$/, ''))
}

async function loadSvg(svgPath) {
  if (!svgCache.has(svgPath)) {
    svgCache.set(svgPath, fetch(svgPath).then((response) => {
      if (!response.ok) {
        throw new Error('Unable to load heatmap SVG.')
      }
      return response.text()
    }))
  }

  return svgCache.get(svgPath)
}

function applyHeatmap(svgMarkup, intensities) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) {
    return svgMarkup
  }

  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.removeAttribute('width')
  svg.removeAttribute('height')

  doc.querySelectorAll('#fig-front, #fig-back').forEach((node) => {
    node.setAttribute('style', 'fill:rgba(255,255,255,0.5);opacity:1;')
  })

  doc.querySelectorAll('[id]').forEach((node) => {
    const id = node.getAttribute('id')
    if (!id || id === 'fig-front' || id === 'fig-back') {
      return
    }

    const key = toGroupKey(id)
    if (!key) {
      return
    }

    const intensity = intensities[key] || 0
    const fill = intensity > 0 ? `rgba(255,255,255,${intensity.toFixed(3)})` : 'rgba(255,255,255,0.08)'
    node.setAttribute('style', `fill:${fill};opacity:1;cursor:default;`)
  })

  return svg.outerHTML
}

export default function PlanMuscleHeatmapSVG({ svgPath, intensities, width = '100%', className = '' }) {
  const [svgMarkup, setSvgMarkup] = useState('')

  const normalizedIntensities = useMemo(
    () => Object.fromEntries(Object.entries(intensities || {}).map(([key, value]) => [normalizeKey(key), value])),
    [intensities],
  )

  useEffect(() => {
    let cancelled = false

    loadSvg(svgPath)
      .then((rawSvg) => {
        if (cancelled) {
          return
        }

        setSvgMarkup(applyHeatmap(rawSvg, normalizedIntensities))
      })
      .catch(() => {
        if (!cancelled) {
          setSvgMarkup('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [svgPath, normalizedIntensities])

  if (!svgMarkup) {
    return <div className={`plan-heatmap-fallback ${className}`.trim()}>Heatmap unavailable</div>
  }

  return (
    <div
      className={`plan-heatmap-svg ${className}`.trim()}
      style={{ width }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  )
}
