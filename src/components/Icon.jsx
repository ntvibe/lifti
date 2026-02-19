export default function Icon({ name, className = '' }) {
  return <span className={`material-symbols-rounded app-icon ${className}`.trim()} aria-hidden="true">{name}</span>
}
