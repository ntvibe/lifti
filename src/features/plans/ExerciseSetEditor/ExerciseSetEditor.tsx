import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, X } from 'lucide-react';
import { db, planRepo } from '../../../db/db';
import { BodyMap } from '../../../components/BodyMap/BodyMap';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { NumericInput } from '../../../components/NumericInput/NumericInput';
import {
    duplicateSet, getSetPrimaryLabel, getSetPrimaryValue,
    getSetWeight, modeHasWeight, setWithPrimaryValue, setWithWeight, setWithRest,
} from '../../../types/helpers';
import type { ExerciseMode, PlanSet } from '../../../types/domain';
import styles from './ExerciseSetEditor.module.css';

function getPrimaryStep(mode: ExerciseMode): number {
    if (mode === 'cardio_distance') return 0.1;
    return 1;
}

function getPrimaryUnit(mode: ExerciseMode): string | undefined {
    if (mode === 'timed_hold') return 's';
    if (mode === 'cardio_duration') return 'min';
    if (mode === 'cardio_distance') return 'km';
    return undefined;
}

function getPrimaryMax(mode: ExerciseMode): number {
    if (mode === 'timed_hold') return 3600;
    if (mode === 'cardio_duration') return 600;
    return 999;
}

export function ExerciseSetEditor() {
    const { planId, exerciseIndex: idxStr } = useParams<{ planId: string; exerciseIndex: string }>();
    const navigate = useNavigate();
    const idx = parseInt(idxStr ?? '0', 10);

    const plan = useLiveQuery(() => (planId ? db.plans.get(planId) : undefined), [planId]);
    const exercise = plan?.exercises[idx];
    const template = useLiveQuery(
        () => (exercise ? db.exercises.get(exercise.templateId) : undefined),
        [exercise?.templateId],
    );

    if (!plan || !exercise || !template) return null;

    const updateSet = (setIndex: number, updater: (s: PlanSet) => PlanSet) => {
        const newSets = exercise.sets.map((s, i) => (i === setIndex ? updater(s) : s));
        planRepo.updateSets(plan, idx, newSets);
    };

    const addSet = () => {
        const last = exercise.sets[exercise.sets.length - 1];
        const newSets = [...exercise.sets, duplicateSet(last)];
        planRepo.updateSets(plan, idx, newSets);
    };

    const removeSet = (setIndex: number) => {
        if (exercise.sets.length <= 1) return;
        const newSets = exercise.sets.filter((_, i) => i !== setIndex);
        planRepo.updateSets(plan, idx, newSets);
    };

    const primaryLabel = getSetPrimaryLabel(template.mode);
    const primaryStep = getPrimaryStep(template.mode);
    const primaryUnit = getPrimaryUnit(template.mode);
    const primaryMax = getPrimaryMax(template.mode);
    const showWeight = modeHasWeight(template.mode);

    return (
        <div className={styles.page}>
            <PageHeader title={template.name} />

            <div className={styles.bodyWrap}>
                <BodyMap size={80} highlightedMuscles={template.musclesPrimary} />
            </div>

            <div className={styles.exerciseName}>{template.name}</div>
            <div className={styles.modeBadge}>{template.mode.replace(/_/g, ' ')}</div>

            <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>{primaryLabel}</th>
                        {showWeight && <th>Kg</th>}
                        <th>Rest</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {exercise.sets.map((set, i) => (
                        <tr key={set.id}>
                            <td>{i + 1}</td>
                            <td>
                                <NumericInput
                                    value={getSetPrimaryValue(set)}
                                    onChange={v => updateSet(i, s => setWithPrimaryValue(s, v) as PlanSet)}
                                    label={primaryLabel}
                                    unit={primaryUnit}
                                    step={primaryStep}
                                    min={0}
                                    max={primaryMax}
                                />
                            </td>
                            {showWeight && (
                                <td>
                                    <NumericInput
                                        value={getSetWeight(set) ?? 0}
                                        onChange={v => updateSet(i, s => setWithWeight(s, v) as PlanSet)}
                                        label="Weight"
                                        unit="kg"
                                        step={2.5}
                                        min={0}
                                        max={250}
                                    />
                                </td>
                            )}
                            <td>
                                <NumericInput
                                    value={set.restSec}
                                    onChange={v => updateSet(i, s => setWithRest(s, v) as PlanSet)}
                                    label="Rest"
                                    unit="s"
                                    step={5}
                                    min={0}
                                    max={3600}
                                />
                            </td>
                            <td className={styles.removeCell}>
                                <button
                                    className={styles.removeBtn}
                                    onClick={() => removeSet(i)}
                                    aria-label={`Delete set ${i + 1}`}
                                    disabled={exercise.sets.length <= 1}
                                >
                                    <X size={14} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>

            <button className={styles.addSetBtn} onClick={addSet}>+ Add Set</button>

            <button className={styles.fab} aria-label="Save and return" onClick={() => navigate(`/plan/${planId}`)}>
                <Check size={24} />
            </button>
        </div>
    );
}
