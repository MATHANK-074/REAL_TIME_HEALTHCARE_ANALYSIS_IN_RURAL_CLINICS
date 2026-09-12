const BASE_URL = '/api';

const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (res, defaultErrorMsg) => {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }
  if (!res.ok) {
    let err = {};
    try {
      err = await res.json();
    } catch(e) {}
    throw new Error(err.detail || defaultErrorMsg);
  }
  return res.json();
};

export const api = {
  // Authentication
  login: async (email, password) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    // Do not intercept 401 for login specifically so it doesn't redirect loop
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to login');
    }
    return res.json();
  },

  register: async (name, email, password, role, phone, qualification, districtId, subdistrictId, villageId, areaId, clinicId) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, phone, qualification, district_id: districtId, subdistrict_id: subdistrictId, village_id: villageId, area_id: areaId, clinic_id: clinicId }),
    });
    return handleResponse(res, 'Failed to register');
  },

  getMe: async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch user profile');
  },

  // Patients
  getPatients: async (search = '', areaId = '') => {
    let url = `${BASE_URL}/patients?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (areaId) url += `area_id=${areaId}`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch patients');
  },

  getPatient: async (id) => {
    const res = await fetch(`${BASE_URL}/patients/${id}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch patient details');
  },

  createPatient: async (patientData) => {
    const res = await fetch(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(patientData),
    });
    return handleResponse(res, 'Failed to create patient');
  },

  // Vitals / Health Records
  logVitals: async (recordData) => {
    const res = await fetch(`${BASE_URL}/health-records`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(recordData),
    });
    return handleResponse(res, 'Failed to log vitals');
  },

  getPatientRecords: async (patientId) => {
    const res = await fetch(`${BASE_URL}/health-records/patient/${patientId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch patient health records');
  },

  getPendingReviews: async () => {
    const res = await fetch(`${BASE_URL}/health-records/pending-review`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch pending reviews');
  },

  reviewHealthRecord: async (recordId, data) => {
    const res = await fetch(`${BASE_URL}/health-records/${recordId}/review`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to submit health record review');
  },

  // Dashboards
  getDoctorDashboard: async () => {
    const res = await fetch(`${BASE_URL}/dashboard/doctor`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch doctor metrics');
  },

  getAdminDashboard: async () => {
    const res = await fetch(`${BASE_URL}/dashboard/admin`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch administrator metrics');
  },

  simulateScreening: async () => {
    const res = await fetch(`${BASE_URL}/dashboard/simulate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to trigger simulation');
  },

  // Predictions
  getPredictionDetails: async (predictionId) => {
    const res = await fetch(`${BASE_URL}/predictions/${predictionId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch prediction details');
  },

  getPatientPredictions: async (patientId) => {
    const res = await fetch(`${BASE_URL}/predictions/patient/${patientId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch patient predictions');
  },

  // Notifications
  getNotifications: async (skip = 0, limit = 20) => {
    const res = await fetch(`${BASE_URL}/notifications?skip=${skip}&limit=${limit}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch notifications');
  },

  getUnreadNotifications: async (skip = 0, limit = 20) => {
    const res = await fetch(`${BASE_URL}/notifications/unread?skip=${skip}&limit=${limit}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch unread notifications');
  },

  getUnreadNotificationCount: async () => {
    const res = await fetch(`${BASE_URL}/notifications/unread-count`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch unread notification count');
  },

  markNotificationRead: async (notifId) => {
    const res = await fetch(`${BASE_URL}/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to mark notification as read');
  },

  markAllNotificationsRead: async () => {
    const res = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to mark all notifications as read');
  },

  // Follow-ups
  getFollowups: async () => {
    const res = await fetch(`${BASE_URL}/followups`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch follow-ups');
  },

  createFollowup: async (followupData) => {
    const res = await fetch(`${BASE_URL}/followups`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(followupData),
    });
    return handleResponse(res, 'Failed to create follow-up');
  },

  updateFollowupStatus: async (followupId, status) => {
    const res = await fetch(`${BASE_URL}/followups/${followupId}?status=${status}`, {
      method: 'PUT',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to update follow-up status');
  },

  // Locations
  getPredictions: async () => {
    const res = await fetch(`${BASE_URL}/predictions`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch predictions');
  },

  getDistricts: async () => {
    const res = await fetch(`${BASE_URL}/locations/districts`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch districts');
  },
  
  createDistrict: async (data) => {
    const res = await fetch(`${BASE_URL}/locations/districts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to create district');
  },

  // Geography cascade endpoints
  getTaluks: async (districtId = '') => {
    const url = districtId ? `${BASE_URL}/locations/taluks?district_id=${districtId}` : `${BASE_URL}/locations/taluks`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch taluks');
  },

  getFirkas: async (talukId = '') => {
    const url = talukId ? `${BASE_URL}/locations/firkas?taluk_id=${talukId}` : `${BASE_URL}/locations/firkas`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch firkas');
  },

  // Updated getVillages to use firkaId
  getVillages: async (firkaId = '') => {
    const url = firkaId ? `${BASE_URL}/locations/villages?firka_id=${firkaId}` : `${BASE_URL}/locations/villages`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch villages');
  },

  createVillage: async (data) => {
    const res = await fetch(`${BASE_URL}/locations/villages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to create village');
  },

  getAreas: async (villageId = '') => {
    const url = villageId ? `${BASE_URL}/locations/areas?village_id=${villageId}` : `${BASE_URL}/locations/areas`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch areas');
  },

  getFacilities: async (areaId = '') => {
    const url = areaId ? `${BASE_URL}/locations/facilities?area_id=${areaId}` : `${BASE_URL}/locations/facilities`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch facilities');
  },

  // Deprecated subdistrict endpoints (retain for compatibility)
  getSubdistricts: async (districtId = '') => {
    const url = districtId ? `${BASE_URL}/locations/subdistricts?district_id=${districtId}` : `${BASE_URL}/locations/subdistricts`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch subdistricts');
  },

  createSubdistrict: async (data) => {
    const res = await fetch(`${BASE_URL}/locations/subdistricts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to create subdistrict');
  },
  
  createArea: async (data) => {
    const res = await fetch(`${BASE_URL}/locations/areas`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to create area');
  },

  getClinics: async (villageId = '', areaId = '') => {
    let url = `${BASE_URL}/locations/clinics?`;
    if (villageId) url += `village_id=${villageId}&`;
    if (areaId) url += `area_id=${areaId}`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch clinics');
  },
  
  createClinic: async (data) => {
    const res = await fetch(`${BASE_URL}/locations/clinics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to create clinic');
  },
  
  // Users
  getUsers: async () => {
    const res = await fetch(`${BASE_URL}/users`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch users');
  },
  
  updateUser: async (userId, data) => {
    const res = await fetch(`${BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to change user status');
  },

  // Field Visits
  startFieldVisit: async (data) => {
    const res = await fetch(`${BASE_URL}/field-visits`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to start field visit');
    }
    return res.json();
  },

  updateFieldVisit: async (visitId, data) => {
    const res = await fetch(`${BASE_URL}/field-visits/${visitId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to update field visit');
    }
    return res.json();
  },

  getFieldVisits: async (statusFilter = '', patientId = '') => {
    let url = `${BASE_URL}/field-visits?`;
    if (statusFilter) url += `status_filter=${statusFilter}&`;
    if (patientId) url += `patient_id=${patientId}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch field visits');
    return res.json();
  }
};
