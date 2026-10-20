import { useState, useEffect, useCallback } from 'react';
import { 
  getSyncState, 
  subscribeSyncState, 
  checkBackendHealth, 
  syncQueue, 
  getActiveUserId 
} from '../services/offlineSyncManager';
import { getQueueCount } from '../services/offlineStorage';

/**
 * React hook to track real-time offline synchronization status, queue size,
 * connectivity status, and trigger manual syncs.
 */
export const useOfflineSync = () => {
  const [syncState, setSyncState] = useState(getSyncState());
  const [queueCounts, setQueueCounts] = useState({ total: 0, pending: 0, syncing: 0, failed: 0 });

  const refreshQueueCounts = useCallback(async () => {
    try {
      const userId = getActiveUserId();
      if (userId) {
        const counts = await getQueueCount(userId);
        setQueueCounts(counts);
      } else {
        setQueueCounts({ total: 0, pending: 0, syncing: 0, failed: 0 });
      }
    } catch (e) {
      console.warn('Could not read offline queue count:', e);
    }
  }, []);

  useEffect(() => {
    // 1. Subscribe to offline sync manager updates
    const unsubscribe = subscribeSyncState((state) => {
      setSyncState(state);
      refreshQueueCounts();
    });

    // 2. Initial counts and check
    refreshQueueCounts();
    checkBackendHealth();

    // 3. Poll counts periodically
    const interval = setInterval(() => {
      refreshQueueCounts();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refreshQueueCounts]);

  const handleSyncNow = useCallback(async () => {
    const res = await syncQueue();
    await refreshQueueCounts();
    return res;
  }, [refreshQueueCounts]);

  return {
    isOnline: syncState.isOnline,
    isBackendReachable: syncState.isBackendReachable,
    isSyncing: syncState.isSyncing,
    lastSyncTime: syncState.lastSyncTime,
    lastSyncError: syncState.lastSyncError,
    pendingCount: Number(queueCounts?.pending || 0),
    failedCount: Number(queueCounts?.failed || 0),
    totalQueueCount: Number(queueCounts?.total || 0),
    syncNow: handleSyncNow,
    checkConnectivity: checkBackendHealth
  };
};

export default useOfflineSync;
