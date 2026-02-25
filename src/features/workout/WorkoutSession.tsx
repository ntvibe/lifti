import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronLeft, SkipForward } from 'lucide-react';
import { db, sessionRepo } from '../../db/db';
import { BodyMap } from '../../components/BodyMap/BodyMap';
import { deepClone, planSetToSessionSet, getSetPrimaryValue, getSetPrimaryLabel, getSetWeight, modeHasWeight } from '../../types/helpers';
import type { WorkoutSession as WS } from '../../types/domain';
import s from './WorkoutSession.module.css';

export function WorkoutSession() {
    const { planId } = useParams<{ planId: string }>();
    const navigate = useNavigate();
    const plan = useLiveQuery(() => (planId ? db.plans.get(planId) : undefined), [planId]);
    const templates = useLiveQuery(() => db.exercises.toArray());

    const [session, setSession] = useState<WS | null>(null);
    const [exIdx, setExIdx] = useState(0);
    const [setIdx, setSetIdx] = useState(0);
    const [timer, setTimer] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);

    // Initialise session
    useEffect(() => {
        if (plan && !session) {
            const ws: WS = {
                id: crypto.randomUUID(),
                planId: plan.id,
                name: plan.name,
                startedAt: Date.now(),
                updatedAt: Date.now(),
                exercises: plan.exercises.map(ex => ({
                    id: ex.id,
                    templateId: ex.templateId,
                    sets: ex.sets.map(planSetToSessionSet),
                })),
            };
            setSession(ws);
            sessionRepo.create(ws);
        }
    }, [plan, session]);

    // Timer
    useEffect(() => {
        if (!timerRunning || timer <= 0) return;
        const id = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) {
                    setTimerRunning(false);
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [timerRunning, timer]);

    const completeSet = useCallback(() => {
        if (!session) return;
        const next = deepClone(session);
        const ss = next.exercises[exIdx].sets[setIdx];
        ss.isCompleted = true;
        ss.completedAt = Date.now();
        next.updatedAt = Date.now();
        setSession(next);
        sessionRepo.update(next);
        if (navigator.vibrate) navigator.vibrate(40);

        // Start rest timer
        if (ss.restSec > 0) {
            setTimer(ss.restSec);
            setTimerRunning(true);
        }
        // Advance
        const curEx = next.exercises[exIdx];
        if (setIdx < curEx.sets.length - 1) {
            setSetIdx(setIdx + 1);
        } else if (exIdx < next.exercises.length - 1) {
            setExIdx(exIdx + 1);
            setSetIdx(0);
        }
    }, [session, exIdx, setIdx]);

    const finish = useCallback(async () => {
        if (!session) return;
        const final = deepClone(session);
        final.finishedAt = Date.now();
        final.updatedAt = Date.now();
        await sessionRepo.update(final);
        navigate('/');
    }, [session, navigate]);

    if (!session || !plan || !templates) return null;

    const curEx = session.exercises[exIdx];
    const tpl = templates.find(t => t.id === curEx.templateId);
    const curSet = curEx.sets[setIdx];
    const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
    const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter(ss => ss.isCompleted).length, 0);
    const progress = totalSets > 0 ? doneSets / totalSets : 0;
    const primaryLabel = getSetPrimaryLabel(tpl?.mode ?? 'strength_reps');
    const primaryVal = getSetPrimaryValue(curSet);
    const setWeight = getSetWeight(curSet);
    const showWeight = modeHasWeight(tpl?.mode ?? 'strength_reps');

    const toggleSave = () => {
        if (!session) return;
        const next = deepClone(session);
        next.exercises[exIdx].sets[setIdx].saveToPlan = !next.exercises[exIdx].sets[setIdx].saveToPlan;
        setSession(next);
    };

    return (
        <div className={s.page}>
            {/* Progress bar */}
            <div className={s.progressBar}>
                <div className={s.progressFill} style={{ width: `${progress * 100}%` }} />
            </div>

            <header className={s.header}>
                <button className={s.backBtn} aria-label="Leave workout" onClick={() => navigate('/')}>
                    <ChevronLeft size={20} />
                </button>
                <div className={s.headerCenter}>
                    <span className={s.headerLabel}>Workout</span>
                    <span className={s.headerName}>{session.name}</span>
                </div>
                <button className={s.finishBtn} onClick={finish}>End</button>
            </header>

            <div className={s.content}>
                <BodyMap size={80} highlightedMuscles={tpl?.musclesPrimary} className={s.bodyMap} />

                <h2 className={s.exerciseName}>{tpl?.name}</h2>
                <p className={s.setLabel}>Set {setIdx + 1} of {curEx.sets.length}</p>

                <div className={s.valueCard}>
                    <div className={s.primaryVal}>
                        {primaryVal}
                        <span className={s.primaryUnit}>{primaryLabel}</span>
                    </div>
                    {showWeight && setWeight !== undefined && (
                        <div className={s.secondaryVal}>
                            {setWeight} <span className={s.secondaryUnit}>kg</span>
                        </div>
                    )}
                </div>

                <label className={s.saveToggle}>
                    <input type="checkbox" checked={curSet.saveToPlan} onChange={toggleSave} />
                    <span>Save for next time</span>
                </label>
            </div>

            <footer className={s.footer}>
                {timerRunning && (
                    <div className={s.timerSection}>
                        <div className={s.timerValue}>{timer}s</div>
                        <span className={s.timerLabel}>Rest</span>
                        <button className={s.skipBtn} onClick={() => { setTimerRunning(false); setTimer(0); }}>
                            <SkipForward size={16} /> Skip
                        </button>
                    </div>
                )}
                <button className={s.completeBtn} onClick={completeSet}>
                    <Check size={20} /> Complete Set
                </button>
            </footer>
        </div>
    );
}
