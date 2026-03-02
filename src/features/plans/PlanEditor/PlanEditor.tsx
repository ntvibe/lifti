import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { GripVertical, RotateCcw, Trash2 } from 'lucide-react';
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor,
    useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy,
    useSortable, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { db, planRepo } from '../../../db/db';
import { BodyMap } from '../../../components/BodyMap/BodyMap';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { deepClone, setVolume } from '../../../types/helpers';
import type { MuscleId, PlanExercise } from '../../../types/domain';
import styles from './PlanEditor.module.css';

export function PlanEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const plan = useLiveQuery(() => (id ? db.plans.get(id) : undefined), [id]);
    const templates = useLiveQuery(() => db.exercises.toArray());
    const [deletedExercises, setDeletedExercises] = useState<DeletedExerciseSnapshot[]>([]);

    useEffect(() => {
        setDeletedExercises([]);
    }, [id]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const heatmap = useMemo(() => {
        if (!plan || !templates) return {};
        const map: Partial<Record<MuscleId, number>> = {};
        for (const ex of plan.exercises) {
            const tpl = templates.find(t => t.id === ex.templateId);
            if (!tpl) continue;
            const vol = ex.sets.reduce((sum, s) => sum + setVolume(s), 0);
            for (const m of tpl.musclesPrimary) map[m] = (map[m] ?? 0) + vol;
            for (const m of tpl.musclesSecondary ?? []) map[m] = (map[m] ?? 0) + vol * 0.4;
        }
        return map;
    }, [plan, templates]);

    if (!plan || !templates) return null;

    const handleRename = (name: string) => planRepo.rename(plan, name);

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const from = plan.exercises.findIndex(ex => ex.id === active.id);
        const to = plan.exercises.findIndex(ex => ex.id === over.id);
        if (from >= 0 && to >= 0) planRepo.reorderExercises(plan, from, to);
    };

    const handleDelete = async (idx: number) => {
        const exercise = plan.exercises[idx];
        if (!exercise) return;
        setDeletedExercises(prev => [...prev, { exercise: deepClone(exercise), index: idx }]);
        await planRepo.removeExercise(plan, idx);
    };

    const handleDeletePlan = async () => {
        const confirmed = window.confirm(`Are you sure you want to delete "${plan.name}"?`);
        if (!confirmed) return;
        await planRepo.delete(plan.id);
        navigate('/', { replace: true });
    };

    const handleUndoDelete = async () => {
        const lastDeleted = deletedExercises[deletedExercises.length - 1];
        if (!lastDeleted) return;
        const restoreIndex = Math.min(lastDeleted.index, plan.exercises.length);
        await planRepo.insertExercise(plan, deepClone(lastDeleted.exercise), restoreIndex);
        setDeletedExercises(prev => prev.slice(0, -1));
    };

    const sortableIds = plan.exercises.map(ex => ex.id);

    return (
        <div className={styles.page}>
            <PageHeader editableTitle={{ value: plan.name, onChange: handleRename }} backTo="/" />

            <div className={styles.bodyWrap}>
                <BodyMap size="100%" heatmap={heatmap} />
            </div>

            <div className={styles.sectionHead}>
                <h2>Workout Flow</h2>
                <span>{plan.exercises.length} items</span>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    <div className={styles.list}>
                        {plan.exercises.map((ex, idx) => (
                            <SortableRow
                                key={ex.id}
                                id={ex.id}
                                name={templates.find(t => t.id === ex.templateId)?.name ?? 'Unknown'}
                                setCount={ex.sets.length}
                                onEdit={() => navigate(`/plan/${id}/exercise/${idx}`)}
                                onDelete={() => void handleDelete(idx)}
                            />
                        ))}
                        {plan.exercises.length === 0 && (
                            <div className={styles.emptyList}>
                                No exercises yet. Add one to start building this plan.
                            </div>
                        )}
                    </div>
                </SortableContext>
            </DndContext>

            <button
                className={styles.addExerciseBtn}
                onClick={() => navigate(`/plan/${id}/add-exercise`)}
            >
                + Add Exercise
            </button>

            <div className={styles.planActionRow}>
                <button className={styles.deletePlanBtn} onClick={() => void handleDeletePlan()}>
                    <Trash2 size={15} /> Delete Plan
                </button>
                <button
                    className={styles.undoDeleteBtn}
                    onClick={() => void handleUndoDelete()}
                    disabled={deletedExercises.length === 0}
                >
                    <RotateCcw size={15} /> Undo Delete
                </button>
            </div>
        </div>
    );
}

interface DeletedExerciseSnapshot {
    exercise: PlanExercise;
    index: number;
}

// ── Sortable Row ──

interface RowProps {
    id: string;
    name: string;
    setCount: number;
    onEdit: () => void;
    onDelete: () => void;
}

function SortableRow({ id, name, setCount, onEdit, onDelete }: RowProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    return (
        <div
            ref={setNodeRef}
            className={styles.row}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            onClick={onEdit}
            role="button"
            tabIndex={0}
            onKeyDown={event => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onEdit();
                }
            }}
            aria-label={`Edit ${name}`}
        >
            <div className={styles.dragHandle} {...attributes} {...listeners}>
                <GripVertical size={18} />
            </div>
            <div className={styles.rowInfo}>
                <div className={styles.rowName}>{name}</div>
                <div className={styles.rowMeta}>{setCount} set{setCount !== 1 ? 's' : ''}</div>
            </div>
            <button className={styles.deleteBtn} aria-label={`Delete ${name}`} onClick={e => { e.stopPropagation(); onDelete(); }}>
                <Trash2 size={16} />
            </button>
        </div>
    );
}
