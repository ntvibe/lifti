import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X } from 'lucide-react';
import { db, planRepo } from '../../../db/db';
import { BodyMap } from '../../../components/BodyMap/BodyMap';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { NumericInput } from '../../../components/NumericInput/NumericInput';
import {
    createDefaultSet,
    duplicateSet,
    getSetPrimaryLabel,
    getSetPrimaryValue,
    getSetWeight,
    modeHasWeight,
    setWithPrimaryValue,
    setWithRest,
    setWithWeight,
} from '../../../types/helpers';
import type { ExerciseMode, PlanSet } from '../../../types/domain';
import styles from './PlanExerciseDetail.module.css';

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

function createSuggestedSets(mode: ExerciseMode): PlanSet[] {
    const firstSet = createDefaultSet(mode);
    return [firstSet, duplicateSet(firstSet), duplicateSet(firstSet)];
}

export function PlanExerciseDetail() {
    const { id: planId, templateId } = useParams<{ id: string; templateId: string }>();
    const navigate = useNavigate();

    const plan = useLiveQuery(() => (planId ? db.plans.get(planId) : undefined), [planId]);
    const template = useLiveQuery(
        () => (templateId ? db.exercises.get(templateId) : undefined),
        [templateId],
    );
    const [draftSets, setDraftSets] = useState<PlanSet[]>([]);

    useEffect(() => {
        if (!template) return;
        setDraftSets(createSuggestedSets(template.mode));
    }, [template]);

    if (!plan || !template || !planId) return null;

    const highlighted = [...template.musclesPrimary, ...(template.musclesSecondary ?? [])];
    const primaryLabel = getSetPrimaryLabel(template.mode);
    const primaryStep = getPrimaryStep(template.mode);
    const primaryUnit = getPrimaryUnit(template.mode);
    const primaryMax = getPrimaryMax(template.mode);
    const showWeight = modeHasWeight(template.mode);

    const updateSet = (setIndex: number, updater: (set: PlanSet) => PlanSet) => {
        setDraftSets(prev => prev.map((set, idx) => (idx === setIndex ? updater(set) : set)));
    };

    const addSet = () => {
        setDraftSets(prev => {
            const last = prev[prev.length - 1] ?? createDefaultSet(template.mode);
            return [...prev, duplicateSet(last)];
        });
    };

    const removeSet = (setIndex: number) => {
        setDraftSets(prev => {
            if (prev.length <= 1) return prev;
            return prev.filter((_, idx) => idx !== setIndex);
        });
    };

    const handleAdd = async () => {
        if (draftSets.length === 0) return;
        await planRepo.addExercise(plan, template, draftSets);
        navigate(`/plan/${planId}`);
    };

    return (
        <div className={styles.page}>
            <PageHeader title="Exercise Details" backTo={`/plan/${planId}/add-exercise`} />

            <div className={styles.bodyMapWrap}>
                <BodyMap size="100%" highlightedMuscles={highlighted} />
            </div>

            <h2 className={styles.exerciseName}>{template.name}</h2>
            <div className={styles.modeBadge}>{template.mode.replace(/_/g, ' ')}</div>

            <div className={styles.setsCard}>
                <div className={styles.setsHead}>
                    <span>Suggested sets</span>
                    <span>{draftSets.length} set{draftSets.length !== 1 ? 's' : ''}</span>
                </div>

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
                            {draftSets.map((set, idx) => (
                                <tr key={set.id}>
                                    <td>{idx + 1}</td>
                                    <td>
                                        <NumericInput
                                            value={getSetPrimaryValue(set)}
                                            onChange={value => updateSet(idx, current => setWithPrimaryValue(current, value) as PlanSet)}
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
                                                onChange={value => updateSet(idx, current => setWithWeight(current, value) as PlanSet)}
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
                                            onChange={value => updateSet(idx, current => setWithRest(current, value) as PlanSet)}
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
                                            onClick={() => removeSet(idx)}
                                            aria-label={`Delete set ${idx + 1}`}
                                            disabled={draftSets.length <= 1}
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
            </div>

            <button className={styles.addBtn} onClick={() => void handleAdd()}>
                <Plus size={18} />
                Add Exercise
            </button>
        </div>
    );
}
