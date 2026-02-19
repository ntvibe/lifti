import { NavLink } from 'react-router-dom'
import Icon from './Icon'

const tabs = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/exercises', label: 'Exercises', icon: 'directions_run' },
  { to: '/history', label: 'History', icon: 'history' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-tabs select-none glass" aria-label="Primary">
      {tabs.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
