import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './services/api';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Pages
import Login from './pages/Login';
import NurseDashboard from './pages/NurseDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorClinicalReview from './pages/DoctorClinicalReview';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminLocations from './pages/AdminLocations';
import PatientDetails from './pages/PatientDetails';
import PatientDashboard from './pages/PatientDashboard';
import PatientHealth from './pages/PatientHealth';
import PatientHistory from './pages/PatientHistory';
import PatientPredictions from './pages/PatientPredictions';
import PatientFollowups from './pages/PatientFollowups';
import PatientNotifications from './pages/PatientNotifications';
import PatientProfile from './pages/PatientProfile';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTitle, setCurrentTitle] = useState('Overview');

  useEffect(() => {
    // Check if user is logged in on load
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (loginData) => {
    setCurrentUser(loginData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#475569',
        fontSize: '1.2rem'
      }}>
        Initializing Care AI Platform...
      </div>
    );
  }

  // Helper for Route Guarding / Role checks
  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!currentUser) {
      return <Navigate to="/login" replace />;
    }
    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
      // If role not allowed, redirect to their home dashboard
      if (currentUser.role === 'ADMIN') return <Navigate to="/admin" replace />;
      if (currentUser.role === 'DOCTOR') return <Navigate to="/doctor" replace />;
      if (currentUser.role === 'NURSE') return <Navigate to="/nurse" replace />;
      if (currentUser.role === 'PATIENT') return <Navigate to="/patient/dashboard" replace />;
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route 
          path="/login" 
          element={
            currentUser ? (
              currentUser.role === 'ADMIN' ? <Navigate to="/admin" replace /> :
              currentUser.role === 'DOCTOR' ? <Navigate to="/doctor" replace /> :
              currentUser.role === 'PATIENT' ? <Navigate to="/patient/dashboard" replace /> :
              <Navigate to="/nurse" replace />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} />
            )
          } 
        />

        {/* Protected Core App Layout */}
        <Route 
          path="/*" 
          element={
            currentUser ? (
              <div className="app-container">
                <Sidebar user={currentUser} onLogout={handleLogout} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Routes>
                    <Route 
                      path="/nurse" 
                      element={
                        <ProtectedRoute allowedRoles={['NURSE', 'ADMIN']}>
                          <NurseDashboard user={currentUser} />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/doctor" 
                      element={
                        <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
                          <DoctorDashboard user={currentUser} />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/doctor/reviews/:patientId" 
                      element={
                        <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
                          <DoctorClinicalReview />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/admin" 
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/admin/users" 
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminUsers />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/admin/locations" 
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminLocations />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/patients/:id" 
                      element={
                        <ProtectedRoute allowedRoles={['NURSE', 'DOCTOR', 'ADMIN']}>
                          <PatientDetails />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/patient/dashboard" 
                      element={
                        <ProtectedRoute allowedRoles={['PATIENT']}>
                          <PatientDashboard />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/patient/health" 
                      element={
                        <ProtectedRoute allowedRoles={['PATIENT']}>
                          <PatientHealth />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/patient/history" 
                      element={
                        <ProtectedRoute allowedRoles={['PATIENT']}>
                          <PatientHistory />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/patient/predictions" 
                      element={
                        <ProtectedRoute allowedRoles={['PATIENT']}>
                          <PatientPredictions />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/patient/followups" 
                      element={
                        <ProtectedRoute allowedRoles={['PATIENT']}>
                          <PatientFollowups />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/patient/notifications" 
                      element={
                        <ProtectedRoute allowedRoles={['PATIENT']}>
                          <PatientNotifications />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/patient/profile" 
                      element={
                        <ProtectedRoute allowedRoles={['PATIENT']}>
                          <PatientProfile />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="*" 
                      element={
                        currentUser.role === 'ADMIN' ? <Navigate to="/admin" replace /> :
                        currentUser.role === 'DOCTOR' ? <Navigate to="/doctor" replace /> :
                        currentUser.role === 'PATIENT' ? <Navigate to="/patient/dashboard" replace /> :
                        <Navigate to="/nurse" replace />
                      } 
                    />
                  </Routes>
                </div>
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
