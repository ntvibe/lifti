import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { GripVertical, Trash2, Plus } from 'lucide-react';
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
import { setVolume } from '../../../types/helpers';
import type { MuscleId, ExerciseTemplate } from '../../../types/domain';
import styles from './PlanEditor.module.css';

export function PlanEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const plan = useLiveQuery(() => (id ? db.plans.get(id) : undefined), [id]);
    const templates = useLiveQuery(() => db.exercises.toArray());
    const [search, setSearch] = useState('');

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

    const handleAdd = (tpl: ExerciseTemplate) => planRepo.addExercise(plan, tpl);
    const handleDelete = (idx: number) => planRepo.removeExercise(plan, idx);

    const filtered = templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()),
    );

    const sortableIds = plan.exercises.map(ex => ex.id);

    return (
        <div className={styles.page}>
            <PageHeader editableTitle={{ value: plan.name, onChange: handleRename }} />

            <div className={styles.bodyWrap}>
                <BodyMap size={100} heatmap={heatmap} />
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
                                onDelete={() => handleDelete(idx)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            <div className={styles.pickerSection}>
                <div className={styles.pickerTitle}>Add Exercise</div>
                <input
                    className={styles.searchInput}
                    placeholder="Search exercises…"
                    aria-label="Search exercises"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className={styles.templateList}>
                    {filtered.length > 0 ? (
                        filtered.map(tpl => (
                            <button key={tpl.id} className={styles.templateBtn} onClick={() => handleAdd(tpl)}>
                                <Plus size={14} />
                                {tpl.name}
                                <span className={styles.templateMode}>{tpl.mode.replace('_', ' ')}</span>
                            </button>
                        ))
                    ) : (
                        <div className={styles.emptyTemplates}>No matching exercises</div>
                    )}
                </div>
            </div>
        </div>
    );
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
