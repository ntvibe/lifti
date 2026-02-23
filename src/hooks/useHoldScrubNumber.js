import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MOVE_CANCEL_THRESHOLD = 8
const TAP_THRESHOLD = 6
const DEFAULT_PIXELS_PER_STEP = 16
const SCROLL_GUARD_MS = 140

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function quantize(value, step) {
  if (!step) {
    return value
  }

  const precision = step.toString().includes('.') ? step.toString().split('.')[1].length : 0
  const next = Math.round(value / step) * step
  return Number(next.toFixed(precision))
}

export default function useHoldScrubNumber({
  value,
  onChange,
  onTap,
  step = 1,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  longPressMs = 250,
  pixelsPerStep = DEFAULT_PIXELS_PER_STEP,
}) {
  const timerRef = useRef(null)
  const overlayRef = useRef(null)
  const lastScrollAtRef = useRef(0)
  const pointerRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    startValue: 0,
    moved: 0,
    holdTriggered: false,
    increments: 0,
    anchorEl: null,
  })
  const [overlay, setOverlay] = useState({
    open: false,
    anchorRect: null,
    displayValue: Number(value || 0),
    pulseKey: 0,
  })
  const scrollLockRef = useRef({
    locked: false,
    scrollX: 0,
    scrollY: 0,
    bodyPosition: '',
    bodyTop: '',
    bodyLeft: '',
    bodyRight: '',
    bodyWidth: '',
    bodyOverflow: '',
    htmlOverflow: '',
    htmlOverscroll: '',
  })

  const lockScroll = useCallback(() => {
    const state = scrollLockRef.current
    if (state.locked) {
      return
    }

    const { body, documentElement } = document
    state.locked = true
    state.scrollX = window.scrollX
    state.scrollY = window.scrollY
    state.bodyPosition = body.style.position
    state.bodyTop = body.style.top
    state.bodyLeft = body.style.left
    state.bodyRight = body.style.right
    state.bodyWidth = body.style.width
    state.bodyOverflow = body.style.overflow
    state.htmlOverflow = documentElement.style.overflow
    state.htmlOverscroll = documentElement.style.overscrollBehavior

    body.style.position = 'fixed'
    body.style.top = `-${state.scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    documentElement.style.overflow = 'hidden'
    documentElement.style.overscrollBehavior = 'none'
  }, [])

  const unlockScroll = useCallback(() => {
    const state = scrollLockRef.current
    if (!state.locked) {
      return
    }

    const { body, documentElement } = document
    body.style.position = state.bodyPosition
    body.style.top = state.bodyTop
    body.style.left = state.bodyLeft
    body.style.right = state.bodyRight
    body.style.width = state.bodyWidth
    body.style.overflow = state.bodyOverflow
    documentElement.style.overflow = state.htmlOverflow
    documentElement.style.overscrollBehavior = state.htmlOverscroll
    window.scrollTo(state.scrollX, state.scrollY)
    state.locked = false
  }, [])

  const close = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const current = pointerRef.current
    if (current.anchorEl && current.pointerId !== null) {
      try {
        if (current.anchorEl.hasPointerCapture(current.pointerId)) {
          current.anchorEl.releasePointerCapture(current.pointerId)
        }
      } catch {
        // no-op
      }
    }

    document.body.classList.remove('no-scroll', 'scrub-active')
    document.documentElement.classList.remove('no-scroll')
    unlockScroll()

    pointerRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startValue: 0,
      moved: 0,
      holdTriggered: false,
      increments: 0,
      anchorEl: null,
    }

    setOverlay((currentOverlay) => ({
      ...currentOverlay,
      open: false,
      anchorRect: null,
    }))
  }, [unlockScroll])

  const refreshAnchorRect = useCallback(() => {
    const anchorEl = pointerRef.current.anchorEl
    if (!anchorEl) {
      return
    }

    setOverlay((current) => ({
      ...current,
      anchorRect: anchorEl.getBoundingClientRect(),
    }))
  }, [])

  useEffect(() => {
    const onScroll = () => {
      lastScrollAtRef.current = Date.now()
    }

    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [])

  useEffect(() => {
    if (!overlay.open) {
      return undefined
    }

    const stopNativeScroll = (event) => {
      event.preventDefault()
    }

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        close()
      }
    }

    const onDocumentPointerDown = (event) => {
      const anchorEl = pointerRef.current.anchorEl
      if (anchorEl?.contains(event.target) || overlayRef.current?.contains(event.target)) {
        return
      }
      close()
    }

    window.addEventListener('keydown', onEscape)
    window.addEventListener('resize', refreshAnchorRect)
    window.addEventListener('scroll', refreshAnchorRect, true)
    window.addEventListener('wheel', stopNativeScroll, { passive: false, capture: true })
    window.addEventListener('touchmove', stopNativeScroll, { passive: false, capture: true })
    document.addEventListener('pointerdown', onDocumentPointerDown)

    return () => {
      window.removeEventListener('keydown', onEscape)
      window.removeEventListener('resize', refreshAnchorRect)
      window.removeEventListener('scroll', refreshAnchorRect, true)
      window.removeEventListener('wheel', stopNativeScroll, { capture: true })
      window.removeEventListener('touchmove', stopNativeScroll, { capture: true })
      document.removeEventListener('pointerdown', onDocumentPointerDown)
    }
  }, [close, overlay.open, refreshAnchorRect])

  useEffect(() => () => close(), [close])

  useEffect(() => {
    const onWindowPointerDone = (event) => {
      const state = pointerRef.current
      if (!state.anchorEl) {
        return
      }

      if (state.pointerId === null || event.pointerId === state.pointerId || state.holdTriggered) {
        close()
      }
    }

    const onWindowBlur = () => {
      if (pointerRef.current.anchorEl) {
        close()
      }
    }

    window.addEventListener('pointerup', onWindowPointerDone)
    window.addEventListener('pointercancel', onWindowPointerDone)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      window.removeEventListener('pointerup', onWindowPointerDone)
      window.removeEventListener('pointercancel', onWindowPointerDone)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [close])

  const bind = useMemo(() => ({
    onPointerDown: (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return
      }

      if (Date.now() - lastScrollAtRef.current < SCROLL_GUARD_MS) {
        return
      }

      const startValue = Number(value || 0)
      pointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startValue,
        moved: 0,
        holdTriggered: false,
        increments: 0,
        anchorEl: event.currentTarget,
      }

      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }

      timerRef.current = window.setTimeout(() => {
        const state = pointerRef.current
        if (!state.anchorEl || state.pointerId !== event.pointerId || state.moved > MOVE_CANCEL_THRESHOLD) {
          return
        }

        state.holdTriggered = true
        state.anchorEl.setPointerCapture(event.pointerId)
        document.body.classList.add('no-scroll', 'scrub-active')
        document.documentElement.classList.add('no-scroll')
        lockScroll()
        setOverlay({
          open: true,
          anchorRect: state.anchorEl.getBoundingClientRect(),
          displayValue: state.startValue,
          pulseKey: 0,
        })
      }, longPressMs)
    },
    onPointerMove: (event) => {
      const state = pointerRef.current
      if (event.pointerId !== state.pointerId) {
        return
      }

      const moved = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
      state.moved = moved

      if (!state.holdTriggered) {
        if (moved > MOVE_CANCEL_THRESHOLD && timerRef.current) {
          window.clearTimeout(timerRef.current)
          timerRef.current = null
        }
        return
      }

      event.preventDefault()
      const deltaY = event.clientY - state.startY
      const increments = -Math.round(deltaY / pixelsPerStep)
      const nextValue = clamp(quantize(state.startValue + increments * step, step), min, max)

      setOverlay((current) => ({
        ...current,
        displayValue: nextValue,
        pulseKey: increments !== state.increments ? current.pulseKey + 1 : current.pulseKey,
      }))

      if (increments !== state.increments) {
        onChange(nextValue)
      }

      state.increments = increments
    },
    onPointerUp: (event) => {
      const state = pointerRef.current
      if (!state.holdTriggered && event.pointerId !== state.pointerId) {
        return
      }

      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }

      if (state.holdTriggered) {
        event.preventDefault()
        close()
        return
      }

      if (state.moved < TAP_THRESHOLD) {
        onTap?.(event)
      }

      close()
    },
    onPointerCancel: () => {
      close()
    },
    onContextMenu: (event) => {
      event.preventDefault()
    },
  }), [close, lockScroll, longPressMs, max, min, onChange, onTap, pixelsPerStep, step, value])

  return { bind, overlay: { ...overlay, displayValue: overlay.open ? overlay.displayValue : Number(value || 0) }, overlayRef, close }
}
