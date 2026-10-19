import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Building, Plus, Search, ShieldAlert, Edit2, Save, X } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [subdistricts, setSubdistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Registration Modal State
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '', email: '', password: '', role: 'DOCTOR', phone: '', qualification: '',
    district_id: '', subdistrict_id: '', village_id: '', area_id: '', clinic_id: ''
  });
  
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [roleFilter, setRoleFilter] = useState('ALL');
  const [talukFilter, setTalukFilter] = useState('ALL');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersRes, distRes, subRes, vilRes] = await Promise.allSettled([
        api.getUsers(),
        api.getDistricts(),
        api.getSubdistricts(),
        api.getVillages()
      ]);

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value || []);
      } else {
        console.error('Failed to fetch users:', usersRes.reason);
        setError(usersRes.reason?.message || 'Failed to fetch staff data. Please check connection.');
      }

      if (distRes.status === 'fulfilled') {
        setDistricts(distRes.value || []);
      } else {
        console.warn('Failed to fetch districts:', distRes.reason);
      }

      if (subRes.status === 'fulfilled') {
        setSubdistricts(subRes.value || []);
      } else {
        console.warn('Failed to fetch subdistricts:', subRes.reason);
      }

      if (vilRes.status === 'fulfilled') {
        setVillages(vilRes.value || []);
      } else {
        console.warn('Failed to fetch villages:', vilRes.reason);
      }
    } catch (err) {
      console.error('Failed to fetch admin users data:', err);
      setError(err.message || 'Failed to fetch staff data. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEditClick = (user) => {
    setEditingUserId(user.id);
    setEditForm({
      district_id: user.district_id || '',
      subdistrict_id: user.subdistrict_id || '',
      village_id: user.village_id || '',
      area_id: user.area_id || '',
      clinic_id: user.clinic_id || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditForm({});
  };

  const handleSaveUser = async (userId) => {
    setError('');
    setSuccess('');
    try {
      await api.updateUser(userId, {
        district_id: editForm.district_id ? editForm.district_id : null,
        subdistrict_id: editForm.subdistrict_id ? editForm.subdistrict_id : null,
        village_id: editForm.village_id ? editForm.village_id : null,
        area_id: editForm.area_id ? editForm.area_id : null,
        clinic_id: editForm.clinic_id ? editForm.clinic_id : null
      });
      setSuccess('User location updated successfully!');
      setEditingUserId(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.register(
        regForm.name,
        regForm.email,
        regForm.password,
        regForm.role,
        regForm.phone || null,
        regForm.qualification || null,
        regForm.district_id ? regForm.district_id : null,
        regForm.subdistrict_id ? regForm.subdistrict_id : null,
        regForm.village_id ? regForm.village_id : null,
        regForm.area_id ? regForm.area_id : null,
        regForm.clinic_id ? regForm.clinic_id : null
      );
      setSuccess('New staff member registered successfully!');
      setShowRegModal(false);
      setRegForm({
        name: '', email: '', password: '', role: 'DOCTOR', phone: '', qualification: '',
        district_id: '', subdistrict_id: '', village_id: '', area_id: '', clinic_id: ''
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to register staff member');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (getSubdistrictName(u.subdistrict_id).toLowerCase().includes(searchQuery.toLowerCase())) ||
      (getVillageName(u.village_id).toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesTaluk = talukFilter === 'ALL' || u.subdistrict_id === talukFilter || String(u.subdistrict_id) === String(talukFilter);
    return matchesSearch && matchesRole && matchesTaluk;
  });

  const getDistrictName = (id) => districts.find(d => d.id === id || String(d.id) === String(id))?.name || 'Erode';
  const getSubdistrictName = (id) => subdistricts.find(s => s.id === id || String(s.id) === String(id))?.name || '—';
  const getVillageName = (id) => villages.find(v => v.id === id || String(v.id) === String(id))?.name || '—';

  // Helper for cascading villages
  const getVillagesForSubdistrict = (subId) => {
    if (!subId) return villages;
    return villages.filter(v => v.subdistrict_id === subId || String(v.subdistrict_id) === String(subId));
  };

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Users...</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Users size={28} style={{ color: 'var(--primary)' }} />
            Staff & User Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '6px' }}>
            Professional portal to register, assign, and manage healthcare providers across Erode District's 10 Taluks & 465 Villages.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegModal(true)} style={{ padding: '12px 24px', borderRadius: '12px' }}>
          <Plus size={20} /> Register New Staff
        </button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="glass kpi-card glass-interactive" onClick={() => { setRoleFilter('ALL'); setTalukFilter('ALL'); }} style={{ cursor: 'pointer', border: roleFilter === 'ALL' && talukFilter === 'ALL' ? '2px solid var(--primary)' : '1px solid var(--border-card)' }}>
          <div className="kpi-header">
            <span>Total Staff</span>
            <div className="kpi-icon-wrapper" style={{ background: 'var(--info-bg)' }}>
              <Users size={20} style={{ color: 'var(--info)' }} />
            </div>
          </div>
          <div className="kpi-val">{users.length}</div>
        </div>
        <div className="glass kpi-card glass-interactive" onClick={() => setRoleFilter('DOCTOR')} style={{ cursor: 'pointer', border: roleFilter === 'DOCTOR' ? '2px solid var(--warning)' : '1px solid var(--border-card)' }}>
          <div className="kpi-header">
            <span>Active Doctors</span>
            <div className="kpi-icon-wrapper" style={{ background: 'var(--warning-bg)' }}>
              <ShieldAlert size={20} style={{ color: 'var(--warning)' }} />
            </div>
          </div>
          <div className="kpi-val">{users.filter(u => u.role === 'DOCTOR').length}</div>
        </div>
        <div className="glass kpi-card glass-interactive" onClick={() => setRoleFilter('NURSE')} style={{ cursor: 'pointer', border: roleFilter === 'NURSE' ? '2px solid var(--success)' : '1px solid var(--border-card)' }}>
          <div className="kpi-header">
            <span>Active Nurses</span>
            <div className="kpi-icon-wrapper" style={{ background: 'var(--success-bg)' }}>
              <Building size={20} style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <div className="kpi-val">{users.filter(u => u.role === 'NURSE').length}</div>
        </div>
        <div className="glass kpi-card" style={{ border: '1px solid var(--border-card)' }}>
          <div className="kpi-header">
            <span>Territory Coverage</span>
            <div className="kpi-icon-wrapper" style={{ background: 'rgba(14, 165, 233, 0.1)' }}>
              <Building size={20} style={{ color: 'var(--primary)' }} />
            </div>
          </div>
          <div className="kpi-val" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>
            {subdistricts.filter(s => users.some(u => u.subdistrict_id === s.id || String(u.subdistrict_id) === String(s.id))).length} / {subdistricts.length || 10} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Taluks</span>
          </div>
        </div>
      </div>

      {success && (
        <div className="badge badge-success" style={{ display: 'block', padding: '14px', width: '100%', marginBottom: '20px', borderRadius: '12px', textTransform: 'none', textAlign: 'center' }}>
          {success}
        </div>
      )}

      {error && (
        <div className="badge badge-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', width: '100%', marginBottom: '20px', borderRadius: '12px', textTransform: 'none' }}>
          <span>{error}</span>
          <button 
            type="button"
            onClick={loadData} 
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Role filter pills, Taluk Selector & Search bar */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'DOCTOR', 'NURSE', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '20px', padding: '6px 16px', fontSize: '0.85rem' }}
            >
              {r === 'ALL' ? 'All Roles' : r === 'DOCTOR' ? 'Doctors' : r === 'NURSE' ? 'Nurses' : 'Admins'}
            </button>
          ))}
        </div>

        <div>
          <select 
            className="form-control" 
            style={{ minWidth: '200px', borderRadius: '12px', fontSize: '0.85rem', padding: '8px 14px', background: 'var(--card-bg, #fff)' }}
            value={talukFilter}
            onChange={(e) => setTalukFilter(e.target.value)}
          >
            <option value="ALL">All Taluks (Full District)</option>
            {subdistricts.map(s => (
              <option key={s.id} value={s.id}>{s.name} Taluk</option>
            ))}
          </select>
        </div>
        
        <div className="glass" style={{ flex: 1, minWidth: '250px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '12px' }}>
          <Search size={18} style={{ color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Search staff by name, email, taluk, or village..." 
            className="form-control"
            style={{ border: 'none', background: 'transparent', padding: '4px', width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass table-container" style={{ padding: '15px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Role</th>
              <th>Qualification</th>
              <th>District</th>
              <th>Subdistrict / Taluk</th>
              <th>Village Scope</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No staff members match the current filter.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isEditing = editingUserId === user.id;
                
                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${user.role === 'ADMIN' ? 'badge-danger' : user.role === 'DOCTOR' ? 'badge-warning' : 'badge-success'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{user.qualification || '—'}</td>
                    
                    {isEditing ? (
                      <>
                        <td>
                          <select 
                            className="form-control" 
                            style={{ padding: '6px', fontSize: '0.85rem' }}
                            value={editForm.district_id}
                            onChange={(e) => setEditForm({...editForm, district_id: e.target.value})}
                          >
                            <option value="">Select District</option>
                            {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <select 
                            className="form-control" 
                            style={{ padding: '6px', fontSize: '0.85rem' }}
                            value={editForm.subdistrict_id}
                            onChange={(e) => setEditForm({...editForm, subdistrict_id: e.target.value, village_id: ''})}
                          >
                            <option value="">Select Taluk (Subdistrict)</option>
                            {subdistricts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <select 
                            className="form-control" 
                            style={{ padding: '6px', fontSize: '0.85rem' }}
                            value={editForm.village_id}
                            onChange={(e) => setEditForm({...editForm, village_id: e.target.value})}
                            disabled={user.role !== 'NURSE'}
                          >
                            <option value="">{user.role === 'NURSE' ? (editForm.subdistrict_id ? 'Select Village' : 'Pick Taluk first') : 'Not Applicable (Doctor/Admin)'}</option>
                            {getVillagesForSubdistrict(editForm.subdistrict_id).map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-success" title="Save" style={{ padding: '6px 10px' }} onClick={() => handleSaveUser(user.id)}>
                              <Save size={16} />
                            </button>
                            <button className="btn btn-danger" title="Cancel" style={{ padding: '6px 10px' }} onClick={handleCancelEdit}>
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <span style={{ fontWeight: 500 }}>{getDistrictName(user.district_id)}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500, color: user.subdistrict_id ? 'var(--primary)' : 'inherit' }}>
                            {getSubdistrictName(user.subdistrict_id)}
                          </span>
                        </td>
                        <td>
                          {user.role === 'NURSE' ? (
                            <span className="badge badge-success" style={{ textTransform: 'none', fontWeight: 500 }}>
                              {getVillageName(user.village_id)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {user.role === 'DOCTOR' ? 'Taluk Jurisdiction' : 'District-wide'}
                            </span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(user)} style={{ borderRadius: '8px' }}>
                            <Edit2 size={13} /> Edit Location
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* REGISTRATION MODAL */}
      {showRegModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '620px', padding: '35px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Plus size={24} style={{ color: 'var(--primary)' }} /> Register New Healthcare Provider
              </h2>
              <button className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => setShowRegModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleRegisterSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-control" required value={regForm.name} onChange={(e) => setRegForm({...regForm, name: e.target.value})} placeholder="e.g., Dr. Rajesh Kumar" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-control" required value={regForm.email} onChange={(e) => setRegForm({...regForm, email: e.target.value})} placeholder="e.g., sathyamangalam.doc@ruralcare.com" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control" required value={regForm.password} onChange={(e) => setRegForm({...regForm, password: e.target.value})} placeholder="Minimum 6 characters" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input type="tel" className="form-control" value={regForm.phone} onChange={(e) => setRegForm({...regForm, phone: e.target.value})} placeholder="+91 9876543210" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Educational Qualification</label>
                <input type="text" className="form-control" value={regForm.qualification} onChange={(e) => setRegForm({...regForm, qualification: e.target.value})} placeholder="e.g., MBBS, MD / B.Sc Nursing" />
              </div>

              <div className="form-group">
                <label className="form-label">Staff Role</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="role" value="DOCTOR" checked={regForm.role === 'DOCTOR'} onChange={(e) => setRegForm({...regForm, role: e.target.value, village_id: ''})} />
                    <span style={{ fontWeight: regForm.role === 'DOCTOR' ? 600 : 400, color: regForm.role === 'DOCTOR' ? 'var(--warning)' : '' }}>Doctor</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="role" value="NURSE" checked={regForm.role === 'NURSE'} onChange={(e) => setRegForm({...regForm, role: e.target.value})} />
                    <span style={{ fontWeight: regForm.role === 'NURSE' ? 600 : 400, color: regForm.role === 'NURSE' ? 'var(--success)' : '' }}>Nurse</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="role" value="ADMIN" checked={regForm.role === 'ADMIN'} onChange={(e) => setRegForm({...regForm, role: e.target.value, subdistrict_id: '', village_id: ''})} />
                    <span style={{ fontWeight: regForm.role === 'ADMIN' ? 600 : 400, color: regForm.role === 'ADMIN' ? 'var(--danger)' : '' }}>District Admin</span>
                  </label>
                </div>
              </div>

              {/* Dynamic Location Assignment based on Role */}
              <div className="form-group" style={{ background: 'rgba(14, 165, 233, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                <h4 style={{ marginBottom: '15px', fontSize: '0.95rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={16} /> Jurisdiction Assignment
                </h4>
                
                {regForm.role === 'ADMIN' && (
                  <div className="form-group mb-0">
                    <label className="form-label">Assign District (Global District Coverage)</label>
                    <select className="form-control" value={regForm.district_id} onChange={(e) => setRegForm({...regForm, district_id: e.target.value})}>
                      <option value="">Select District</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}

                {regForm.role === 'DOCTOR' && (
                  <div className="form-group mb-0" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label className="form-label">Assign Subdistrict / Taluk (Regional Coverage)</label>
                      <select 
                        className="form-control" 
                        required 
                        value={regForm.subdistrict_id} 
                        onChange={(e) => {
                          const dist = districts[0]?.id || '';
                          setRegForm({...regForm, subdistrict_id: e.target.value, district_id: dist});
                        }}
                      >
                        <option value="">Select Taluk (10 Official Taluks)</option>
                        {subdistricts.map(s => <option key={s.id} value={s.id}>{s.name} Taluk</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {regForm.role === 'NURSE' && (
                  <div className="form-group mb-0" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label className="form-label">1. Select Taluk (Subdistrict)</label>
                      <select 
                        className="form-control" 
                        required
                        value={regForm.subdistrict_id} 
                        onChange={(e) => {
                          const dist = districts[0]?.id || '';
                          setRegForm({...regForm, subdistrict_id: e.target.value, village_id: '', district_id: dist});
                        }}
                      >
                        <option value="">Select Taluk first</option>
                        {subdistricts.map(s => <option key={s.id} value={s.id}>{s.name} Taluk</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">2. Assign Official Revenue Village (Local Coverage)</label>
                      <select 
                        className="form-control" 
                        required
                        value={regForm.village_id} 
                        onChange={(e) => setRegForm({...regForm, village_id: e.target.value})}
                        disabled={!regForm.subdistrict_id}
                      >
                        <option value="">
                          {regForm.subdistrict_id ? 'Select Revenue Village' : '← Please select Taluk above first'}
                        </option>
                        {getVillagesForSubdistrict(regForm.subdistrict_id).map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '20px', fontSize: '1.05rem', borderRadius: '12px' }}>
                Register Staff & Create Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
