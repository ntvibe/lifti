import { useEffect, useRef, useMemo } from 'react';
import type { MuscleId } from '../../types/domain';
import styles from './BodyMap.module.css';

interface BodyMapProps {
    highlightedMuscles?: MuscleId[];
    heatmap?: Partial<Record<MuscleId, number>>;
    onClick?: (id: MuscleId) => void;
    size?: number;
    className?: string;
}

/**
 * Map our domain MuscleId → SVG element ID prefixes.
 * The SVG uses ids like "deltoids1", "deltoids2" for left/right.
 */
const MUSCLE_TO_SVG_IDS: Record<MuscleId, string[]> = {
    Deltoids: ['deltoids1', 'deltoids2'],
    Pectorals: ['pectorals1', 'pectorals2'],
    Biceps: ['biceps1', 'biceps2'],
    Triceps: ['triceps1', 'triceps2'],
    Forearms: ['forearms1', 'forearms2', 'forearms3', 'forearms4'],
    Abdominals: ['abdominals1', 'abdominals2', 'abdominals3', 'abdominals4', 'abdominals5', 'abdominals6', 'abdominals7', 'abdominals8'],
    Oblique: ['oblique1', 'oblique2'],
    Trapezius: ['trapezius1', 'trapezius2', 'trapezius3', 'trapezius4'],
    RotatorCuff: ['rotator_cuff1', 'rotator_cuff2'],
    UpperBack: ['upper_back1', 'upper_back2'],
    LowerBack: ['lower-back'],
    Paravertebrals: ['paravertebrals1', 'paravertebrals2'],
    Quadriceps: ['quadriceps1', 'quadriceps2'],
    Hamstrings: ['hamstrings1', 'hamstrings2'],
    Gluteus: ['gluteus1', 'gluteus2'],
    Adductors: ['adductors1', 'adductors2'],
    Calves: ['calves1', 'calves2', 'calves3', 'calves4', 'calves5', 'calves6', 'calves7', 'calves8', 'calves9', 'calves10'],
    Ileopsoas: ['ileopsoas1', 'ileopsoas2'],
    AbdomenTransverse: [],
    Diaphragm: [],
};

export function BodyMap({ highlightedMuscles = [], heatmap, onClick, size = 100, className = '' }: BodyMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const bodyMapSrc = `${import.meta.env.BASE_URL}svg/muscle-groups.svg`;

    const maxHeat = useMemo(() => {
        if (!heatmap) return 1;
        const vals = Object.values(heatmap).filter(Boolean) as number[];
        return Math.max(...vals, 1);
    }, [heatmap]);

    // Colorise SVG paths after SVG is loaded into the DOM via <object>
    useEffect(() => {
        const obj = containerRef.current?.querySelector('object') as HTMLObjectElement | null;
        if (!obj) return;

        const colourPaths = () => {
            const doc = obj.contentDocument;
            if (!doc) return;

            // Reset all muscle paths to transparent
            for (const ids of Object.values(MUSCLE_TO_SVG_IDS)) {
                for (const id of ids) {
                    const el = doc.getElementById(id);
                    if (el) {
                        el.style.fill = 'rgba(200,200,200,0.08)';
                        el.style.transition = 'fill 0.3s ease';
                        el.style.cursor = onClick ? 'pointer' : 'default';
                    }
                }
            }

            // Apply highlights
            for (const muscleId of highlightedMuscles) {
                const ids = MUSCLE_TO_SVG_IDS[muscleId];
                if (!ids) continue;
                for (const id of ids) {
                    const el = doc.getElementById(id);
                    if (el) el.style.fill = 'var(--c-accent, #6c63ff)';
                }
            }

            // Apply heatmap
            if (heatmap) {
                for (const [muscleId, value] of Object.entries(heatmap)) {
                    if (!value) continue;
                    const ids = MUSCLE_TO_SVG_IDS[muscleId as MuscleId];
                    if (!ids) continue;
                    const ratio = Math.min(value / maxHeat, 1);
                    const alpha = 0.15 + ratio * 0.7;
                    const color = `rgba(var(--c-accent-rgb, 108, 99, 255), ${alpha})`;
                    for (const id of ids) {
                        const el = doc.getElementById(id);
                        if (el) el.style.fill = color;
                    }
                }
            }

            // Wire up click handlers
            if (onClick) {
                for (const [muscleId, ids] of Object.entries(MUSCLE_TO_SVG_IDS)) {
                    for (const id of ids) {
                        const el = doc.getElementById(id);
                        if (el) {
                            el.onclick = () => onClick(muscleId as MuscleId);
                        }
                    }
                }
            }

            // Also fix the figure silhouette fills to use current text color
            const figFront = doc.getElementById('fig-front');
            const figBack = doc.getElementById('fig-back');
            if (figFront) figFront.style.fill = 'var(--c-text-dim, #555)';
            if (figBack) figBack.style.fill = 'var(--c-text-dim, #555)';
        };

        obj.addEventListener('load', colourPaths);
        // If already loaded
        if (obj.contentDocument?.readyState === 'complete') colourPaths();

        return () => obj.removeEventListener('load', colourPaths);
    }, [highlightedMuscles, heatmap, maxHeat, onClick]);

    return (
        <div ref={containerRef} className={`${styles.wrap} ${className}`} style={{ width: size }}>
            <object
                type="image/svg+xml"
                data={bodyMapSrc}
                className={styles.svg}
                aria-label="Body muscle map"
            >
                Body map
            </object>
        </div>
    );
}
