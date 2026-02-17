import { NavLink, Route, Routes } from 'react-router-dom'

const screens = {
  Login: () => <Page title="Login" description="Sign in to access your Lifti account." />,
  Home: () => <Page title="Home" description="Welcome to Lifti. Start a plan or jump into today's workout." />,
  PlanBuilder: () => <Page title="Plan Builder" description="Create and customize your weekly lifting plan." />,
  WorkoutPlayer: () => <Page title="Workout Player" description="Follow your workout step-by-step with timers and logging." />,
  History: () => <Page title="History" description="Review completed workouts, trends, and personal records." />,
}

function Page({ title, description }) {
  return (
    <section className="screen">
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/login', label: 'Login' },
  { to: '/plan-builder', label: 'PlanBuilder' },
  { to: '/workout-player', label: 'WorkoutPlayer' },
  { to: '/history', label: 'History' },
]

export default function App() {
  return (
    <div className="app-shell">
      <header>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<screens.Home />} />
          <Route path="/login" element={<screens.Login />} />
          <Route path="/plan-builder" element={<screens.PlanBuilder />} />
          <Route path="/workout-player" element={<screens.WorkoutPlayer />} />
          <Route path="/history" element={<screens.History />} />
        </Routes>
      </main>
    </div>
  )
}
