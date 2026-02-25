import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import styles from './PageHeader.module.css';

interface Props {
    title?: string;
    editableTitle?: { value: string; onChange: (v: string) => void };
    showBack?: boolean;
    right?: ReactNode;
}

export function PageHeader({ title, editableTitle, showBack = true, right }: Props) {
    const navigate = useNavigate();

    return (
        <header className={styles.header}>
            <div className={styles.side}>
                {showBack ? (
                    <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
                        <ChevronLeft size={20} />
                    </button>
                ) : (
                    <span className={styles.sideSpacer} aria-hidden="true" />
                )}
            </div>
            {editableTitle ? (
                <input
                    className={styles.titleInput}
                    value={editableTitle.value}
                    aria-label="Title"
                    onChange={e => editableTitle.onChange(e.target.value)}
                />
            ) : (
                <h1 className={styles.title}>{title}</h1>
            )}
            <div className={styles.side}>{right}</div>
        </header>
    );
}
