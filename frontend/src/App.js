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
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminLocations from './pages/AdminLocations';
import PatientDetails from './pages/PatientDetails';

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
    const userObj = {
      email: loginData.email,
      name: loginData.name,
      role: loginData.role
    };
    setCurrentUser(userObj);
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
        background: '#070b13',
        color: '#94a3b8',
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
                      path="*" 
                      element={
                        currentUser.role === 'ADMIN' ? <Navigate to="/admin" replace /> :
                        currentUser.role === 'DOCTOR' ? <Navigate to="/doctor" replace /> :
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
