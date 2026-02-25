import { NavLink } from 'react-router-dom';
import { Home, BarChart3, Dumbbell } from 'lucide-react';
import styles from './Navigation.module.css';

export function Navigation() {
    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `${styles.link} ${isActive ? styles.active : ''}`;

    return (
        <nav className={styles.nav} aria-label="Primary">
            <NavLink to="/" className={linkClass} end>
                <Home className={styles.icon} />
                <span>Plans</span>
            </NavLink>
            <NavLink to="/history" className={linkClass}>
                <BarChart3 className={styles.icon} />
                <span>History</span>
            </NavLink>
            <NavLink to="/exercises" className={linkClass}>
                <Dumbbell className={styles.icon} />
                <span>Library</span>
            </NavLink>
        </nav>
    );
}
