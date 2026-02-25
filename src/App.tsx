import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import './App.css';
import { Navigation } from './components/Navigation/Navigation';
import { PlansHome } from './features/plans/PlansHome/PlansHome';
import { PlanEditor } from './features/plans/PlanEditor/PlanEditor';
import { ExerciseSetEditor } from './features/plans/ExerciseSetEditor/ExerciseSetEditor';
import { WorkoutSession } from './features/workout/WorkoutSession';
import { HistoryView } from './features/history/HistoryView';
import { ExerciseLibrary } from './features/exercises/ExerciseLibrary';
import { AIImport } from './features/exercises/AIImport';
import { useAuthStore } from './state/authStore';
import { useSyncStore } from './state/syncStore';

function AppLayout() {
    const location = useLocation();
    const isImmersiveRoute =
        /^\/workout\/[^/]+$/u.test(location.pathname)
        || /^\/plan\/[^/]+\/exercise\/[^/]+$/u.test(location.pathname);
    const mainClassName = `app-main ${isImmersiveRoute ? 'app-main-immersive' : ''}`;

    return (
        <div className="app-shell">
            <div className="app-bg" />
            <div className="app-phone">
                <div className="app-notch" aria-hidden="true" />
                <main className={mainClassName}>
                    <Routes>
                        <Route path="/" element={<PlansHome />} />
                        <Route path="/plan/:id" element={<PlanEditor />} />
                        <Route path="/plan/:planId/exercise/:exerciseIndex" element={<ExerciseSetEditor />} />
                        <Route path="/workout/:planId" element={<WorkoutSession />} />
                        <Route path="/history" element={<HistoryView />} />
                        <Route path="/exercises" element={<ExerciseLibrary />} />
                        <Route path="/exercises/import" element={<AIImport />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
                {!isImmersiveRoute && <Navigation />}
            </div>
        </div>
    );
}

export default function App() {
    const hydrateSession = useAuthStore(state => state.hydrateSession);
    const initializeSync = useSyncStore(state => state.initialize);
    const refreshPendingOps = useSyncStore(state => state.refreshPendingOps);
    const syncNow = useSyncStore(state => state.syncNow);
    const authStatus = useAuthStore(state => state.status);

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            try {
                await initializeSync();
                await hydrateSession();
                if (useAuthStore.getState().status === 'authenticated') {
                    await syncNow();
                } else {
                    await refreshPendingOps();
                }
            } catch (error) {
                if (cancelled) return;
                useSyncStore.setState(state => ({
                    ...state,
                    status: 'error',
                    lastError: error instanceof Error ? error.message : 'Failed to initialize app state.',
                }));
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, [hydrateSession, initializeSync, refreshPendingOps, syncNow]);

    useEffect(() => {
        if (authStatus !== 'authenticated') return;
        const timer = window.setInterval(() => {
            void refreshPendingOps();
        }, 4000);
        return () => window.clearInterval(timer);
    }, [authStatus, refreshPendingOps]);

    // GitHub Pages serves apps from a subpath and does not support SPA history fallback.
    // Use hash routing for non-root builds so refresh/deep links remain stable.
    if (import.meta.env.BASE_URL !== '/') {
        return (
            <HashRouter>
                <AppLayout />
            </HashRouter>
        );
    }

    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AppLayout />
        </BrowserRouter>
    );
}
