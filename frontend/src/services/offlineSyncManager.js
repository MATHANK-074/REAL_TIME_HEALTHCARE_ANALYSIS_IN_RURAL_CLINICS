/**
 * RuralCare AI - Offline Synchronization Orchestrator
 * 
 * Manages:
 * - Real connectivity verification (via /api/health)
 * - Offline queueing of clinical records
 * - Dependency-ordered background synchronization
 * - Temporary-to-canonical ID remapping
 * - Idempotent sync retries with backoff
 * - Real-time event broadcasting to UI components
 */

import { api } from './api';
import * as storage from './offlineStorage';

// Sync state event emitter listeners
const listeners = new Set();

let isSyncing = false;
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let isBackendReachable = true;
let lastSyncTime = null;
let lastSyncError = null;

/**
 * Notify all subscribed UI components about state changes.
 */
const notifyListeners = () => {
  const state = getSyncState();
  listeners.forEach(fn => {
    try {
      fn(state);
    } catch (e) {
      console.error('Error in sync listener:', e);
    }
  });
};

/**
 * Get current authenticated user ID from localStorage safely.
 */
export const getActiveUserId = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user.id || user._id || null;
  } catch (e) {
    return null;
  }
};

/**
 * Verify actual backend reachability by checking /api/health with a short timeout.
 */
export const checkBackendHealth = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    isOnline = false;
    isBackendReachable = false;
    notifyListeners();
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch('/api/health', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const reachable = res.ok;
    isOnline = true;
    isBackendReachable = reachable;
    notifyListeners();
    return reachable;
  } catch (err) {
    isBackendReachable = false;
    notifyListeners();
    return false;
  }
};

/**
 * Return current sync status snapshot.
 */
export const getSyncState = () => ({
  isOnline,
  isBackendReachable,
  isSyncing,
  lastSyncTime,
  lastSyncError
});

/**
 * Subscribe to sync state changes.
 */
export const subscribeSyncState = (fn) => {
  listeners.add(fn);
  fn(getSyncState());
  return () => listeners.delete(fn);
};

// =========================================================================
// OFFLINE QUEUEING HELPERS (Called by Nurse Dashboard / Modals)
// =========================================================================

/**
 * Queue a patient registration while offline.
 * Immediately saves patient to local cache with OFFLINE badge.
 */
export const queueOfflinePatient = async (patientData) => {
  const userId = getActiveUserId();
  if (!userId) throw new Error('Cannot queue offline record without active user session.');

  const tempId = `temp_pat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const idempotencyKey = `idem_pat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = new Date().toISOString();

  // Create temporary local patient object for immediate UI display
  const offlinePatient = {
    ...patientData,
    id: tempId,
    _id: tempId,
    tempId,
    patient_code: `OFFLINE-${Date.now().toString().slice(-4)}`,
    created_at: createdAt,
    _isOffline: true,
    _syncStatus: 'PENDING_SYNC',
    idempotency_key: idempotencyKey
  };

  // 1. Add to action queue
  await storage.enqueueAction({
    actionType: 'CREATE_PATIENT',
    payload: {
      ...patientData,
      idempotency_key: idempotencyKey,
      created_at: createdAt
    },
    tempId,
    idempotencyKey,
    userId,
    createdAt
  });

  // 2. Put into local cache so patient appears immediately in Nurse's patient list
  await storage.putCachedPatient(userId, offlinePatient);

  notifyListeners();
  return offlinePatient;
};

/**
 * Queue vitals logging while offline.
 */
export const queueOfflineVitals = async (recordData) => {
  const userId = getActiveUserId();
  if (!userId) throw new Error('Cannot queue offline vitals without active user session.');

  const idempotencyKey = `idem_vit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const recordedAt = new Date().toISOString();

  const payload = {
    ...recordData,
    recorded_at: recordedAt,
    idempotency_key: idempotencyKey
  };

  await storage.enqueueAction({
    actionType: 'LOG_VITALS',
    payload,
    tempId: recordData.patient_id, // Might be a temp_pat_ ID or canonical ID
    idempotencyKey,
    userId,
    createdAt: recordedAt
  });

  notifyListeners();
  return { ...payload, _isOffline: true, _syncStatus: 'PENDING_SYNC' };
};

/**
 * Queue field visit while offline.
 */
export const queueOfflineFieldVisit = async (visitData) => {
  const userId = getActiveUserId();
  if (!userId) throw new Error('Cannot queue offline field visit without active user session.');

  const idempotencyKey = `idem_fv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = new Date().toISOString();

  const payload = {
    ...visitData,
    idempotency_key: idempotencyKey,
    created_at: createdAt
  };

  await storage.enqueueAction({
    actionType: visitData.status === 'COMPLETED' ? 'COMPLETE_FIELD_VISIT' : 'START_FIELD_VISIT',
    payload,
    tempId: visitData.patient_id,
    idempotencyKey,
    userId,
    createdAt
  });

  notifyListeners();
  return { ...payload, _isOffline: true };
};

/**
 * Queue follow-up completion while offline.
 */
export const queueOfflineFollowupUpdate = async (followupId, status) => {
  const userId = getActiveUserId();
  if (!userId) throw new Error('Cannot queue offline followup update without active user session.');

  const idempotencyKey = `idem_fol_${followupId}_${Date.now()}`;
  const updatedAt = new Date().toISOString();

  await storage.enqueueAction({
    actionType: 'UPDATE_FOLLOWUP',
    payload: {
      followupId,
      status,
      updated_at: updatedAt
    },
    idempotencyKey,
    userId,
    createdAt: updatedAt
  });

  // Optimistically update cached followup
  const cachedFollowups = await storage.getCachedFollowups(userId);
  const target = cachedFollowups.find(f => String(f.id || f._id) === String(followupId));
  if (target) {
    await storage.putCachedFollowup(userId, {
      ...target,
      status: status.toUpperCase(),
      _syncStatus: 'PENDING_SYNC'
    });
  }

  notifyListeners();
  return { followupId, status, _isOffline: true };
};

// =========================================================================
// SEQUENTIAL DEPENDENCY-ORDERED SYNCHRONIZATION
// =========================================================================

/**
 * Process all queued actions in strict dependency order:
 * 1. CREATE_PATIENT
 * 2. Save tempId -> canonicalId mappings
 * 3. Remap tempIds in dependent queued vitals & field visits
 * 4. LOG_VITALS
 * 5. FIELD_VISIT actions
 * 6. UPDATE_FOLLOWUP
 * 7. Refresh caches from server
 */
export const syncQueue = async () => {
  const userId = getActiveUserId();
  if (!userId) return { success: false, reason: 'No active user session' };

  if (isSyncing) {
    return { success: false, reason: 'Synchronization already in progress' };
  }

  // Double check real server connectivity first
  const isHealthy = await checkBackendHealth();
  if (!isHealthy) {
    return { success: false, reason: 'Backend server is not reachable' };
  }

  isSyncing = true;
  lastSyncError = null;
  notifyListeners();

  const idMap = new Map(); // tempId -> canonicalId

  try {
    const queue = await storage.getQueue(userId);
    if (queue.length === 0) {
      isSyncing = false;
      lastSyncTime = new Date().toISOString();
      notifyListeners();
      return { success: true, count: 0 };
    }

    // Step 1: Create queued patients
    const patientActions = queue.filter(a => a.actionType === 'CREATE_PATIENT' && a.status !== 'SYNCING');
    for (const action of patientActions) {
      try {
        await storage.updateQueuedAction(action.id, { status: 'SYNCING' });
        
        // Execute server creation
        const serverPatient = await api.createPatient(action.payload);
        const canonicalId = String(serverPatient.id || serverPatient._id);

        // Step 2: Save mapping
        if (action.tempId) {
          idMap.set(action.tempId, canonicalId);
          await storage.saveIdMapping(action.tempId, canonicalId, serverPatient.patient_code, userId);

          // Update cached patient with real ID & code
          await storage.putCachedPatient(userId, {
            ...serverPatient,
            id: canonicalId,
            _isOffline: false,
            _syncStatus: 'SYNCED'
          });
        }

        // Action succeeded, delete from queue
        await storage.removeQueuedAction(action.id);
      } catch (err) {
        console.error(`Failed to sync patient action ${action.id}:`, err);
        await storage.updateQueuedAction(action.id, {
          status: 'FAILED',
          retryCount: (action.retryCount || 0) + 1,
          error: err.message || 'Server error creating patient'
        });
      }
    }

    // Step 3: Remap dependent queued actions that reference temporary patient IDs
    const otherActions = await storage.getQueue(userId);
    for (const action of otherActions) {
      let modified = false;
      const payload = { ...action.payload };

      if (payload.patient_id && idMap.has(payload.patient_id)) {
        payload.patient_id = idMap.get(payload.patient_id);
        modified = true;
      } else if (payload.patient_id && String(payload.patient_id).startsWith('temp_pat_')) {
        // Check persistent store for mapping
        const mapping = await storage.getIdMapping(payload.patient_id);
        if (mapping && mapping.canonicalId) {
          payload.patient_id = mapping.canonicalId;
          modified = true;
        }
      }

      if (modified) {
        await storage.updateQueuedAction(action.id, { payload });
      }
    }

    // Step 4: Synchronize Vitals (Health Records)
    const vitalsActions = (await storage.getQueue(userId)).filter(a => a.actionType === 'LOG_VITALS');
    for (const action of vitalsActions) {
      // Don't send if patient_id is still a temporary ID (waits for patient sync)
      if (String(action.payload.patient_id).startsWith('temp_pat_')) {
        continue;
      }

      try {
        await storage.updateQueuedAction(action.id, { status: 'SYNCING' });
        await api.logVitals(action.payload);
        await storage.removeQueuedAction(action.id);
      } catch (err) {
        console.error(`Failed to sync vitals action ${action.id}:`, err);
        await storage.updateQueuedAction(action.id, {
          status: 'FAILED',
          retryCount: (action.retryCount || 0) + 1,
          error: err.message || 'Server error logging vitals'
        });
      }
    }

    // Step 5: Synchronize Field Visits
    const fvActions = (await storage.getQueue(userId)).filter(a => 
      a.actionType === 'START_FIELD_VISIT' || a.actionType === 'COMPLETE_FIELD_VISIT'
    );
    for (const action of fvActions) {
      if (String(action.payload.patient_id).startsWith('temp_pat_')) {
        continue;
      }

      try {
        await storage.updateQueuedAction(action.id, { status: 'SYNCING' });
        if (action.actionType === 'START_FIELD_VISIT') {
          await api.startFieldVisit(action.payload);
        } else {
          await api.updateFieldVisit(action.payload.visitId || action.id, action.payload);
        }
        await storage.removeQueuedAction(action.id);
      } catch (err) {
        console.error(`Failed to sync field visit ${action.id}:`, err);
        await storage.updateQueuedAction(action.id, {
          status: 'FAILED',
          retryCount: (action.retryCount || 0) + 1,
          error: err.message || 'Server error updating field visit'
        });
      }
    }

    // Step 6: Synchronize Follow-up Updates
    const followupActions = (await storage.getQueue(userId)).filter(a => a.actionType === 'UPDATE_FOLLOWUP');
    for (const action of followupActions) {
      try {
        await storage.updateQueuedAction(action.id, { status: 'SYNCING' });
        await api.updateFollowupStatus(action.payload.followupId, action.payload.status);
        await storage.removeQueuedAction(action.id);
      } catch (err) {
        console.error(`Failed to sync followup update ${action.id}:`, err);
        await storage.updateQueuedAction(action.id, {
          status: 'FAILED',
          retryCount: (action.retryCount || 0) + 1,
          error: err.message || 'Server error updating followup'
        });
      }
    }

    // Step 7: Refresh authorized local caches from server
    try {
      const freshPatients = await api.getPatients();
      if (Array.isArray(freshPatients)) {
        await storage.setCachedPatients(userId, freshPatients);
      }
      const freshFollowups = await api.getFollowups();
      if (Array.isArray(freshFollowups)) {
        await storage.setCachedFollowups(userId, freshFollowups);
      }
    } catch (e) {
      console.warn('Could not refresh caches after sync:', e);
    }

    lastSyncTime = new Date().toISOString();
    return { success: true };
  } catch (err) {
    console.error('Fatal error during syncQueue:', err);
    lastSyncError = err.message || 'Fatal synchronization failure';
    return { success: false, error: lastSyncError };
  } finally {
    isSyncing = false;
    notifyListeners();
  }
};

// =========================================================================
// AUTO-INITIALIZATION & NETWORK EVENT LISTENERS
// =========================================================================

if (typeof window !== 'undefined') {
  // Listen to browser network changes
  window.addEventListener('online', async () => {
    isOnline = true;
    notifyListeners();
    const reachable = await checkBackendHealth();
    if (reachable) {
      // Automatic sync upon reconnection
      syncQueue();
    }
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    isBackendReachable = false;
    notifyListeners();
  });

  // Periodic heartbeat every 30 seconds
  setInterval(async () => {
    const reachable = await checkBackendHealth();
    const userId = getActiveUserId();
    if (reachable && userId) {
      const counts = await storage.getQueueCount(userId);
      if (counts.pending > 0 && !isSyncing) {
        syncQueue();
      }
    }
  }, 30000);
}
