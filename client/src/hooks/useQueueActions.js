import axios from 'axios';
import { useQueueStore } from '../store/queueStore';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: `${API_URL}/api` });

// Attach JWT to all requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('mq_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const useQueueActions = () => {
    const { clinicId: storeClinicId, doctorId: storeDoctorId } = useQueueStore();

    const withDoctor = (doctorId) => doctorId || storeDoctorId;

    return {
        callNext: (doctorId) =>
            api.post('/admin/queue/call-next', { doctor_id: withDoctor(doctorId) }),

        callSpecific: (tokenId) =>
            api.post(`/admin/queue/call/${tokenId}`),

        markPresent: (tokenId) =>
            api.patch(`/admin/token/${tokenId}/present`),

        markComplete: (tokenId) =>
            api.patch(`/admin/token/${tokenId}/complete`),

        markOnHold: (tokenId) =>
            api.patch(`/admin/token/${tokenId}/hold`),

        recallToken: (tokenId) =>
            api.patch(`/admin/token/${tokenId}/recall`),

        applyPenalty: (tokenId) =>
            api.post(`/admin/token/${tokenId}/penalty`),

        markNoShow: (tokenId) =>
            api.post(`/admin/token/${tokenId}/noshow`),

        insertEmergency: (doctorId, payload) =>
            api.post('/admin/token/emergency', { doctor_id: withDoctor(doctorId), ...payload }),

        updateSubPatient: (subPatientId, status) =>
            api.patch(`/admin/sub-patient/${subPatientId}/status`, { status }),

        pauseQueue: (doctorId, paused) =>
            api.post('/admin/queue/pause', { doctor_id: withDoctor(doctorId), paused }),

        getQueue: (doctorId) =>
            api.get(`/admin/queue/${withDoctor(doctorId)}`),
    };
};

export const queueApi = {
    join: (data) => api.post('/queue/join', data),
    status: (tokenId) => api.get(`/queue/status/${tokenId}`),
    display: (clinicId, doctorId) => api.get(`/queue/display/${clinicId}/${doctorId}`),
    threshold: (doctorId) => api.get(`/queue/threshold/${doctorId}`),
    clinicBySlug: (slug) => api.get(`/queue/clinic/${slug}`),
    clinicUrls: (slug) => api.get(`/queue/clinic/${slug}/urls`),
};

export const authApi = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    logout: () => api.post('/auth/logout'),
    refresh: () => api.post('/auth/refresh'),
};

export const doctorApi = {
    dashboard: () => api.get('/doctor/dashboard'),
    reportDaily: (date) => api.get(`/doctor/reports/daily/${date}`),
    reportWeekly: () => api.get('/doctor/reports/weekly'),
    reportMonthly: (year, month) => api.get(`/doctor/reports/monthly/${year}/${month}`),
    history: (params) => api.get('/doctor/reports/history', { params }),
    updateThreshold: (data) => api.patch('/doctor/threshold', data),
};

export const adminApi = {
    // Doctor management
    getDoctors: () => api.get('/admin/doctors'),
    createDoctor: (data) => api.post('/admin/doctors', data),
    updateDoctor: (id, data) => api.patch(`/admin/doctors/${id}`, data),
    deleteDoctor: (id) => api.delete(`/admin/doctors/${id}`),
    changeDoctorPassword: (id, password) => api.patch(`/admin/doctors/${id}/password`, { password }),
    updateDoctorThreshold: (id, data) => api.patch(`/admin/doctors/${id}/threshold`, data),
    // Superadmin clinic management
    getClinics: () => api.get('/admin/clinics'),
    createClinic: (data) => api.post('/admin/clinics', data),
    updateClinic: (id, data) => api.patch(`/admin/clinics/${id}`, data),
};

export default api;
