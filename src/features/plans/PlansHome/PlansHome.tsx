import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Play, Dumbbell } from 'lucide-react';
import { db, planRepo } from '../../../db/db';
import { BodyMap } from '../../../components/BodyMap/BodyMap';
import { BackupStatusCard } from '../../../components/BackupStatusCard';
import { setVolume } from '../../../types/helpers';
import type { MuscleId, Plan, ExerciseTemplate } from '../../../types/domain';
import styles from './PlansHome.module.css';

export function PlansHome() {
    const navigate = useNavigate();
    const [queryBuster, setQueryBuster] = useState(0);
    const plans = useLiveQuery(
        () => db.plans.orderBy('updatedAt').reverse().toArray(),
        [queryBuster],
    );
    const templates = useLiveQuery(() => db.exercises.toArray());

    useEffect(() => {
        const refreshPlans = () => {
            setQueryBuster(prev => prev + 1);
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') refreshPlans();
        };

        window.addEventListener('pageshow', refreshPlans);
        window.addEventListener('focus', refreshPlans);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('pageshow', refreshPlans);
            window.removeEventListener('focus', refreshPlans);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleNew = async () => {
        const plan = await planRepo.create('New Plan');
        setQueryBuster(prev => prev + 1);
        navigate(`/plan/${plan.id}`);
    };

    const totalExercises = plans?.reduce((sum, p) => sum + p.exercises.length, 0) ?? 0;

    return (
        <div className={styles.page}>
            <div className={styles.topBar}>
                <div>
                    <span className={styles.logo}>Lifti</span>
                    <p className={styles.subtitle}>Train with structure</p>
                </div>
                <button className={styles.newBtn} onClick={handleNew}>
                    <Plus size={16} /> New Plan
                </button>
            </div>

            <BackupStatusCard />

            <div className={styles.metrics}>
                <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Plans</span>
                    <span className={styles.metricValue}>{plans?.length ?? 0}</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Exercises</span>
                    <span className={styles.metricValue}>{totalExercises}</span>
                </div>
            </div>

            {plans && plans.length > 0 ? (
                <div className={styles.grid}>
                    {plans.map(plan => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            templates={templates ?? []}
                            onOpen={() => navigate(`/plan/${plan.id}`)}
                            onStart={() => navigate(`/workout/${plan.id}`)}
                        />
                    ))}
                </div>
            ) : (
                <div className={styles.empty}>
                    <Dumbbell size={48} className={styles.emptyIcon} />
                    <p className={styles.emptyTitle}>No plans yet</p>
                    <p>Create your first workout plan to get started.</p>
                </div>
            )}
        </div>
    );
}

// ── Plan Card ──

interface PlanCardProps {
    plan: Plan;
    templates: ExerciseTemplate[];
    onOpen: () => void;
    onStart: () => void;
}

function PlanCard({ plan, templates, onOpen, onStart }: PlanCardProps) {
    const heatmap = useMemo(() => {
        const map: Partial<Record<MuscleId, number>> = {};
        for (const ex of plan.exercises) {
            const tpl = templates.find(t => t.id === ex.templateId);
            if (!tpl) continue;
            const vol = ex.sets.reduce((sum, s) => sum + setVolume(s), 0);
            for (const m of tpl.musclesPrimary) {
                map[m] = (map[m] ?? 0) + vol;
            }
            for (const m of tpl.musclesSecondary ?? []) {
                map[m] = (map[m] ?? 0) + vol * 0.4;
            }
        }
        return map;
    }, [plan, templates]);

    return (
        <article
            className={styles.card}
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={event => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen();
                }
            }}
            aria-label={`Open ${plan.name}`}
        >
            <div className={styles.cardMapWrap}>
                <BodyMap size="100%" heatmap={heatmap} />
            </div>
            <div className={styles.cardName}>{plan.name}</div>
            <div className={styles.cardMeta}>
                {plan.exercises.length} exercise{plan.exercises.length !== 1 ? 's' : ''}
            </div>
            <div className={styles.cardActions}>
                <button className={styles.startBtn} onClick={e => { e.stopPropagation(); onStart(); }}>
                    <Play size={14} /> Start
                </button>
            </div>
        </article>
    );
}
