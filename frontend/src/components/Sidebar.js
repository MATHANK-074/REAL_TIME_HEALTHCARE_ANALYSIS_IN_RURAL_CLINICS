import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Bell,
  LogOut,
  Activity,
  ShieldAlert,
  MapPin
} from 'lucide-react';

const Sidebar = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getLinks = () => {
    if (!user) return [];

    const links = [];

    // Admin gets all dashboards or admin panel
    if (user.role === 'ADMIN') {
      links.push(
        { path: '/admin', label: 'Admin Dashboard', icon: ShieldAlert },
        { path: '/admin/locations', label: 'Territories', icon: MapPin },
        { path: '/admin/users', label: 'Staff Management', icon: Users },
        { path: '/doctor', label: 'Doctor View', icon: LayoutDashboard },
        { path: '/nurse', label: 'Nurse View', icon: Activity }
      );
    } else if (user.role === 'DOCTOR') {
      links.push(
        { path: '/doctor', label: 'Dashboard', icon: LayoutDashboard }
      );
    } else if (user.role === 'NURSE') {
      links.push(
        { path: '/nurse', label: 'Dashboard', icon: Activity }
      );
    } else if (user.role === 'PATIENT') {
      links.push(
        { path: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/patient/health', label: 'My Health', icon: Activity },
        { path: '/patient/history', label: 'Health History', icon: Calendar },
        { path: '/patient/predictions', label: 'AI Assessment', icon: Activity },
        { path: '/patient/followups', label: 'Follow-ups', icon: Calendar },
        { path: '/patient/notifications', label: 'Notifications', icon: Bell },
        { path: '/patient/profile', label: 'My Profile', icon: Users }
      );
    }

    return links;
  };

  const links = getLinks();

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <Activity className="text-primary" size={28} style={{ color: '#0ea5e9' }} />
        <span className="logo-text">RuralCare AI</span>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="user-profile" style={{ marginBottom: '15px' }}>
            <div className="avatar">
              {user.name ? user.name.substring(0, 2) : 'US'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{user.name}</span>
              <span className="profile-role" style={{
                color: user.role === 'ADMIN' ? '#ef4444' : user.role === 'DOCTOR' ? '#0ea5e9' : user.role === 'PATIENT' ? '#8b5cf6' : '#10b981'
              }}>{user.role}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleLogoutClick}
          className="btn btn-secondary"
          style={{ width: '100%', padding: '10px' }}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
