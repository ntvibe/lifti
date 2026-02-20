import { NavLink } from 'react-router-dom'
import Icon from './Icon'

export default function BottomNav({ isAuthenticated, activeSession, onTogglePauseResume }) {
  if (!isAuthenticated) {
    return null
  }

  const tabs = [
    { to: '/', label: 'Plans', icon: 'home' },
    ...(activeSession
      ? [{ to: '/training', label: activeSession.paused ? 'Resume' : 'Pause', icon: activeSession.paused ? 'play_arrow' : 'pause', middle: true }]
      : []),
    { to: '/history', label: 'History', icon: 'history' },
  ]

  return (
    <nav className="bottom-tabs select-none glass" aria-label="Primary" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((item) => {
        if (item.middle) {
          return (
            <button
              key={item.to}
              type="button"
              className="tab-link nav-toggle-button"
              onClick={() => {
                onTogglePauseResume?.()
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          )
        }

        return (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
