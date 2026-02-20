import { useEffect, useRef, useState } from 'react'

export default function AvatarMenu({ profileName, profilePicture, onSignOut, onSettings }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handleOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const initials = (profileName || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((entry) => entry[0].toUpperCase())
    .join('')

  return (
    <div className="avatar-menu" ref={wrapperRef}>
      <button type="button" className="avatar-button select-none" onClick={() => setOpen((value) => !value)} aria-label="Account menu">
        {profilePicture ? <img src={profilePicture} alt={profileName || 'Profile'} /> : <span>{initials}</span>}
      </button>
      {open ? (
        <div className="avatar-dropdown glass">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onSettings?.()
            }}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
