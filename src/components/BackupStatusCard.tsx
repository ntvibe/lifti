import { Cloud, CloudOff, LoaderCircle, RefreshCw, Trash2, Unplug } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../state/authStore';
import { useSyncStore } from '../state/syncStore';
import type { SyncStatus } from '../sync/types';
import styles from './BackupStatusCard.module.css';

function getStatusLabel(syncStatus: SyncStatus) {
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'out_of_sync') return 'Out of sync';
    if (syncStatus === 'error') return 'Out of sync';
    return 'Saved locally';
}

function getLastSyncLabel(lastSyncedAt?: number) {
    if (!Number.isFinite(lastSyncedAt ?? NaN)) {
        return 'Not synced yet';
    }

    try {
        return `Last sync ${formatDistanceToNow(lastSyncedAt as number, { addSuffix: true })}`;
    } catch {
        return 'Not synced yet';
    }
}

export function BackupStatusCard() {
    const authStatus = useAuthStore(state => state.status);
    const authUser = useAuthStore(state => state.user);
    const authProvider = useAuthStore(state => state.provider);
    const authAccessToken = useAuthStore(state => state.accessToken);
    const authLastError = useAuthStore(state => state.lastError);
    const connectGoogle = useAuthStore(state => state.connectGoogle);
    const disconnectAuth = useAuthStore(state => state.disconnect);

    const syncStatus = useSyncStore(state => state.status);
    const pendingOps = useSyncStore(state => state.pendingOps);
    const lastSyncedAt = useSyncStore(state => state.lastSyncedAt);
    const syncLastError = useSyncStore(state => state.lastError);
    const syncNow = useSyncStore(state => state.syncNow);
    const deleteCloudBackup = useSyncStore(state => state.deleteCloudBackup);
    const disconnectCloud = useSyncStore(state => state.disconnectCloud);

    const connected = authStatus === 'authenticated' && authProvider === 'google' && Boolean(authAccessToken);
    const statusLabel = getStatusLabel(syncStatus);

    const handleEnableBackup = async () => {
        const success = await connectGoogle();
        if (success) {
            await syncNow();
        }
    };

    const handleDisconnect = async () => {
        await Promise.all([disconnectAuth(), disconnectCloud()]);
    };

    return (
        <section className={styles.card}>
            <div className={styles.headerRow}>
                <div className={styles.titleRow}>
                    {connected ? <Cloud size={16} /> : <CloudOff size={16} />}
                    <h3 className={styles.title}>
                        {connected ? 'Backup connected to Google' : 'Back up your plans and history'}
                    </h3>
                </div>
                <span className={`${styles.badge} ${syncStatus === 'out_of_sync' || syncStatus === 'error' ? styles.outOfSync : ''}`}>
                    {statusLabel}
                </span>
            </div>

            <p className={styles.meta}>
                {connected
                    ? `Connected as ${authUser?.email ?? authUser?.name ?? 'Google account'}`
                    : 'Optional backup. Training remains fully offline-first.'}
            </p>

            {connected && (
                <p className={styles.meta}>
                    {getLastSyncLabel(lastSyncedAt)}
                    {pendingOps > 0 ? ` • ${pendingOps} pending` : ''}
                </p>
            )}

            {(authLastError || syncLastError) && (
                <p className={styles.errorText}>{syncLastError ?? authLastError}</p>
            )}

            <div className={styles.actions}>
                {!connected ? (
                    <button className={styles.primaryBtn} onClick={handleEnableBackup} disabled={authStatus === 'authenticating'}>
                        {authStatus === 'authenticating' ? (
                            <><LoaderCircle size={14} className={styles.spin} /> Connecting...</>
                        ) : (
                            <><Cloud size={14} /> Enable backup</>
                        )}
                    </button>
                ) : (
                    <>
                        <button className={styles.secondaryBtn} onClick={syncNow} disabled={syncStatus === 'syncing'}>
                            {syncStatus === 'syncing' ? (
                                <><LoaderCircle size={14} className={styles.spin} /> Syncing...</>
                            ) : (
                                <><RefreshCw size={14} /> Sync now</>
                            )}
                        </button>
                        <button className={styles.secondaryBtn} onClick={handleDisconnect}>
                            <Unplug size={14} /> Disconnect
                        </button>
                        <button className={styles.dangerBtn} onClick={deleteCloudBackup}>
                            <Trash2 size={14} /> Delete cloud backup only
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}
