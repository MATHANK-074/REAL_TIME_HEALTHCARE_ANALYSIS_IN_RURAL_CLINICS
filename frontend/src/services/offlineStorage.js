/**
 * RuralCare AI - Offline-First IndexedDB Storage Service
 * 
 * Provides local persistence for:
 * 1. Action Queue (patient creation, vitals, field visits, follow-up status updates)
 * 2. Cached authorized patients (scoped by logged-in user)
 * 3. Cached authorized villages
 * 4. Cached authorized follow-ups
 * 5. Temporary-to-Canonical ID mappings
 */

const DB_NAME = 'RuralCareOfflineDB';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Open or upgrade the IndexedDB database safely.
 */
export const getDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Queue Store
      if (!db.objectStoreNames.contains('queue')) {
        const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('userId', 'userId', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        queueStore.createIndex('idempotencyKey', 'idempotencyKey', { unique: false });
      }

      // 2. Cached Patients Store
      if (!db.objectStoreNames.contains('cached_patients')) {
        const patientStore = db.createObjectStore('cached_patients', { keyPath: 'id' });
        patientStore.createIndex('userId', 'userId', { unique: false });
        patientStore.createIndex('village_id', 'village_id', { unique: false });
      }

      // 3. Cached Villages Store
      if (!db.objectStoreNames.contains('cached_villages')) {
        const villageStore = db.createObjectStore('cached_villages', { keyPath: 'id' });
        villageStore.createIndex('userId', 'userId', { unique: false });
      }

      // 4. Cached Followups Store
      if (!db.objectStoreNames.contains('cached_followups')) {
        const followupStore = db.createObjectStore('cached_followups', { keyPath: 'id' });
        followupStore.createIndex('userId', 'userId', { unique: false });
        followupStore.createIndex('patient_id', 'patient_id', { unique: false });
      }

      // 5. Temporary to Canonical ID Mappings Store
      if (!db.objectStoreNames.contains('id_mappings')) {
        const mapStore = db.createObjectStore('id_mappings', { keyPath: 'tempId' });
        mapStore.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      
      // Handle connection close / error gracefully
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Failed to open IndexedDB:', event.target.error);
      reject(event.target.error || new Error('Could not open IndexedDB'));
    };
  });
};

/**
 * Execute a transaction on an object store safely.
 */
const runTx = async (storeName, mode, callback) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);

      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = (e) => reject(e.target.error);
      transaction.onabort = (e) => reject(e.target.error || new Error('Transaction aborted'));

      result = callback(store);
    } catch (err) {
      reject(err);
    }
  });
};

// =========================================================================
// QUEUE OPERATIONS (FIFO, Retry, Scoped by User)
// =========================================================================

/**
 * Enqueue an action for background synchronization.
 * 
 * @param {Object} action
 * @param {string} action.actionType - 'CREATE_PATIENT' | 'LOG_VITALS' | 'START_FIELD_VISIT' | 'COMPLETE_FIELD_VISIT' | 'UPDATE_FOLLOWUP'
 * @param {Object} action.payload - Form or request payload
 * @param {string} [action.tempId] - Client-generated temporary ID
 * @param {string} [action.idempotencyKey] - Unique idempotency key
 * @param {string} action.userId - ID of the authenticated user
 * @param {string} [action.createdAt] - Clinical recording timestamp
 */
export const enqueueAction = async ({
  actionType,
  payload,
  tempId = null,
  idempotencyKey = null,
  userId,
  createdAt = new Date().toISOString()
}) => {
  if (!actionType || !payload || !userId) {
    throw new Error('Action requires actionType, payload, and userId.');
  }

  const actionRecord = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    actionType,
    payload,
    tempId,
    idempotencyKey: idempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    userId: String(userId),
    createdAt,
    status: 'PENDING',
    retryCount: 0,
    error: null,
    enqueuedAt: new Date().toISOString()
  };

  await runTx('queue', 'readwrite', (store) => {
    store.add(actionRecord);
  });

  return actionRecord;
};

/**
 * Get all queued actions for a specific user, ordered chronologically.
 */
export const getQueue = async (userId) => {
  const uid = String(userId);
  return new Promise(async (resolve, reject) => {
    try {
      const db = await getDB();
      const transaction = db.transaction('queue', 'readonly');
      const store = transaction.objectStore('queue');
      const index = store.index('createdAt');
      const request = index.getAll();

      request.onsuccess = () => {
        const all = request.result || [];
        const userActions = all.filter(a => String(a.userId) === uid);
        resolve(userActions);
      };
      request.onerror = (e) => reject(e.target.error);
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Update the status, error message, or payload of a queued action.
 */
export const updateQueuedAction = async (actionId, updates) => {
  return runTx('queue', 'readwrite', (store) => {
    const getReq = store.get(actionId);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        const updatedRecord = { ...record, ...updates, updatedAt: new Date().toISOString() };
        store.put(updatedRecord);
      }
    };
  });
};

/**
 * Remove a successfully synchronized action from the queue.
 */
export const removeQueuedAction = async (actionId) => {
  return runTx('queue', 'readwrite', (store) => {
    store.delete(actionId);
  });
};

/**
 * Count pending / failed actions in queue for a user.
 */
export const getQueueCount = async (userId) => {
  const actions = await getQueue(userId);
  const pending = actions.filter(a => a.status === 'PENDING' || a.status === 'SYNCING').length;
  const failed = actions.filter(a => a.status === 'FAILED').length;
  return { total: actions.length, pending, failed };
};

// =========================================================================
// ID MAPPING OPERATIONS (tempId -> canonicalId)
// =========================================================================

/**
 * Save mapping between client temporary patient ID and server canonical MongoDB ID.
 */
export const saveIdMapping = async (tempId, canonicalId, patientCode, userId) => {
  const record = {
    tempId,
    canonicalId: String(canonicalId),
    patientCode,
    userId: String(userId),
    createdAt: new Date().toISOString()
  };
  return runTx('id_mappings', 'readwrite', (store) => {
    store.put(record);
  });
};

/**
 * Retrieve canonical ID for a temporary patient ID.
 */
export const getIdMapping = async (tempId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await getDB();
      const tx = db.transaction('id_mappings', 'readonly');
      const store = tx.objectStore('id_mappings');
      const req = store.get(tempId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    } catch (e) {
      reject(e);
    }
  });
};

// =========================================================================
// CACHED PATIENTS OPERATIONS
// =========================================================================

/**
 * Save authorized patients list to local cache for offline browsing.
 */
export const setCachedPatients = async (userId, patients) => {
  const uid = String(userId);
  const now = new Date().toISOString();
  return runTx('cached_patients', 'readwrite', (store) => {
    (patients || []).forEach(p => {
      const id = String(p.id || p._id);
      store.put({
        ...p,
        id,
        userId: uid,
        _cachedAt: now
      });
    });
  });
};

/**
 * Retrieve cached authorized patients for a user.
 */
export const getCachedPatients = async (userId) => {
  const uid = String(userId);
  return new Promise(async (resolve, reject) => {
    try {
      const db = await getDB();
      const tx = db.transaction('cached_patients', 'readonly');
      const store = tx.objectStore('cached_patients');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const userPatients = all.filter(p => String(p.userId) === uid);
        resolve(userPatients);
      };
      req.onerror = (e) => reject(e.target.error);
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Insert or update a single cached patient (e.g. when registered offline).
 */
export const putCachedPatient = async (userId, patient) => {
  const uid = String(userId);
  const id = String(patient.id || patient._id || patient.tempId);
  return runTx('cached_patients', 'readwrite', (store) => {
    store.put({
      ...patient,
      id,
      userId: uid,
      _cachedAt: new Date().toISOString()
    });
  });
};

// =========================================================================
// CACHED VILLAGES OPERATIONS
// =========================================================================

export const setCachedVillages = async (userId, villages) => {
  const uid = String(userId);
  const now = new Date().toISOString();
  return runTx('cached_villages', 'readwrite', (store) => {
    (villages || []).forEach(v => {
      const id = String(v.id || v._id);
      store.put({
        ...v,
        id,
        userId: uid,
        _cachedAt: now
      });
    });
  });
};

export const getCachedVillages = async (userId) => {
  const uid = String(userId);
  return new Promise(async (resolve, reject) => {
    try {
      const db = await getDB();
      const tx = db.transaction('cached_villages', 'readonly');
      const store = tx.objectStore('cached_villages');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const userVillages = all.filter(v => String(v.userId) === uid);
        resolve(userVillages);
      };
      req.onerror = (e) => reject(e.target.error);
    } catch (e) {
      reject(e);
    }
  });
};

// =========================================================================
// CACHED FOLLOWUPS OPERATIONS
// =========================================================================

export const setCachedFollowups = async (userId, followups) => {
  const uid = String(userId);
  const now = new Date().toISOString();
  return runTx('cached_followups', 'readwrite', (store) => {
    (followups || []).forEach(f => {
      const id = String(f.id || f._id);
      store.put({
        ...f,
        id,
        userId: uid,
        _cachedAt: now
      });
    });
  });
};

export const getCachedFollowups = async (userId) => {
  const uid = String(userId);
  return new Promise(async (resolve, reject) => {
    try {
      const db = await getDB();
      const tx = db.transaction('cached_followups', 'readonly');
      const store = tx.objectStore('cached_followups');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const userFollowups = all.filter(f => String(f.userId) === uid);
        resolve(userFollowups);
      };
      req.onerror = (e) => reject(e.target.error);
    } catch (e) {
      reject(e);
    }
  });
};

export const putCachedFollowup = async (userId, followup) => {
  const uid = String(userId);
  const id = String(followup.id || followup._id);
  return runTx('cached_followups', 'readwrite', (store) => {
    store.put({
      ...followup,
      id,
      userId: uid,
      _cachedAt: new Date().toISOString()
    });
  });
};

// =========================================================================
// SECURITY & USER SCOPE HYGIENE
// =========================================================================

/**
 * Clear cached data for a user on logout, while preserving any unsynced clinical actions in queue.
 */
export const clearUserCache = async (userId) => {
  const uid = String(userId);
  const clearStoreForUser = async (storeName) => {
    const db = await getDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          items.forEach(item => {
            if (String(item.userId) === uid) {
              store.delete(item.id || item.tempId);
            }
          });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  };

  await Promise.all([
    clearStoreForUser('cached_patients'),
    clearStoreForUser('cached_villages'),
    clearStoreForUser('cached_followups')
  ]);
  clearPatientCache(userId);
};

// =========================================================================
// PATIENT PORTAL READ-ONLY OFFLINE CACHING
// =========================================================================

export const cachePatientData = (userId, section, data) => {
  if (!userId || !section) return;
  try {
    const payload = {
      cachedAt: new Date().toISOString(),
      data
    };
    localStorage.setItem(`ruralcare_patient_${userId}_${section}`, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to cache patient data offline:', e);
  }
};

export const getCachedPatientData = (userId, section) => {
  if (!userId || !section) return null;
  try {
    const raw = localStorage.getItem(`ruralcare_patient_${userId}_${section}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

export const clearPatientCache = (userId) => {
  if (!userId) return;
  try {
    const prefix = `ruralcare_patient_${userId}_`;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn('Failed to clear patient cache:', e);
  }
};

