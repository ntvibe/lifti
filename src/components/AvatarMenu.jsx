import { useEffect, useRef, useState } from 'react'

export default function AvatarMenu({ profileName, profilePicture, onSignOut }) {
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

  return (
    <div className="avatar-menu" ref={wrapperRef}>
      <button type="button" className="avatar-button" onClick={() => setOpen((value) => !value)} aria-label="Account menu">
        {profilePicture ? <img src={profilePicture} alt={profileName || 'Profile'} /> : <span>{(profileName || 'U').slice(0, 1).toUpperCase()}</span>}
      </button>
      {open ? (
        <div className="avatar-dropdown">
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
