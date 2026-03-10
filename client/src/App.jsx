import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useQueueStore } from './store/queueStore';

// Pages
import QueueJoin from './pages/Patient/QueueJoin';
import TokenStatus from './pages/Patient/TokenStatus';
import Login from './pages/Admin/Login';
import AdminDashboard from './pages/Admin/AdminDashboard';
import DoctorManagement from './pages/Admin/DoctorManagement';
import SuperadminPanel from './pages/Admin/SuperadminPanel';
import DoctorDashboard from './pages/Doctor/DoctorDashboard';
import DisplayBoard from './pages/Display/DisplayBoard';

// Route guard
const ProtectedRoute = ({ children, requiredRole }) => {
    const { user, token } = useQueueStore();
    if (!user || !token) return <Navigate to="/login" replace />;
    if (requiredRole && !requiredRole.includes(user.role)) return <Navigate to="/login" replace />;
    return children;
};

const AppRoutes = () => {
    const { initFromStorage } = useQueueStore();
    useEffect(() => { initFromStorage(); }, []);

    return (
        <Routes>
            {/* Public — Patient */}
            <Route path="/queue" element={<QueueJoin />} />
            <Route path="/queue/:clinicSlug" element={<QueueJoin />} />
            <Route path="/token/:tokenId" element={<TokenStatus />} />

            {/* Public — Display board (TV screen) */}
            <Route path="/display" element={<DisplayBoard />} />
            <Route path="/display/:clinicId/:doctorId" element={<DisplayBoard />} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />

            {/* Protected — Admin */}
            <Route path="/admin" element={
                <ProtectedRoute requiredRole={['admin', 'staff', 'superadmin']}>
                    <AdminDashboard />
                </ProtectedRoute>
            } />
            <Route path="/admin/:clinicId/:doctorId" element={
                <ProtectedRoute requiredRole={['admin', 'staff', 'superadmin']}>
                    <AdminDashboard />
                </ProtectedRoute>
            } />
            <Route path="/admin/doctors" element={
                <ProtectedRoute requiredRole={['admin', 'superadmin']}>
                    <DoctorManagement />
                </ProtectedRoute>
            } />

            {/* Protected — Superadmin */}
            <Route path="/superadmin" element={
                <ProtectedRoute requiredRole={['superadmin']}>
                    <SuperadminPanel />
                </ProtectedRoute>
            } />

            {/* Protected — Doctor */}
            <Route path="/doctor" element={
                <ProtectedRoute requiredRole={['doctor', 'admin', 'superadmin']}>
                    <DoctorDashboard />
                </ProtectedRoute>
            } />

            {/* Default — redirect to queue join */}
            <Route path="/" element={<Navigate to="/queue" replace />} />
            <Route path="*" element={<Navigate to="/queue" replace />} />
        </Routes>
    );
};

const App = () => (
    <BrowserRouter>
        <AppRoutes />
    </BrowserRouter>
);

export default App;
