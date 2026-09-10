import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Building, Plus, Search, ShieldAlert, Edit2, Save, X } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [subdistricts, setSubdistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [areas, setAreas] = useState([]);
  const [clinics, setClinics] = useState([]);
  
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, distData, subData, vilData, areaData, clinicData] = await Promise.all([
        api.getUsers(),
        api.getDistricts(),
        api.getSubdistricts(),
        api.getVillages(),
        api.getAreas(),
        api.getClinics()
      ]);
      setUsers(usersData);
      setDistricts(distData);
      setSubdistricts(subData);
      setVillages(vilData);
      setAreas(areaData || []);
      setClinics(clinicData || []);
    } catch (err) {
      setError('Failed to fetch data.');
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
      // The API expects a specific argument order: name, email, password, role, phone, qualification, districtId, subdistrictId, villageId
      // We will need to update the frontend api method signature to accept an object instead to easily support area_id and clinic_id.
      // But wait! If I just pass the extra parameters it won't work unless I updated api.js. I should change api.js or do it here. Let's fix api.js register next.
      // Assuming api.js is updated to take an object. Wait, let me just add the arguments in order: name, email, password, role, phone, qualification, districtId, subdistrictId, villageId, areaId, clinicId
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

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDistrictName = (id) => districts.find(d => d.id === id)?.name || 'N/A';
  const getSubdistrictName = (id) => subdistricts.find(s => s.id === id)?.name || 'N/A';
  const getVillageName = (id) => villages.find(v => v.id === id)?.name || 'N/A';

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
            Professional portal to register, assign, and manage healthcare providers.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegModal(true)} style={{ padding: '12px 24px', borderRadius: '12px' }}>
          <Plus size={20} /> Register New Staff
        </button>
      </div>

      <div className="kpi-grid">
        <div className="glass kpi-card glass-interactive">
          <div className="kpi-header">
            <span>Total Staff</span>
            <div className="kpi-icon-wrapper" style={{ background: 'var(--info-bg)' }}>
              <Users size={20} style={{ color: 'var(--info)' }} />
            </div>
          </div>
          <div className="kpi-val">{users.length}</div>
        </div>
        <div className="glass kpi-card glass-interactive">
          <div className="kpi-header">
            <span>Active Doctors</span>
            <div className="kpi-icon-wrapper" style={{ background: 'var(--warning-bg)' }}>
              <ShieldAlert size={20} style={{ color: 'var(--warning)' }} />
            </div>
          </div>
          <div className="kpi-val">{users.filter(u => u.role === 'DOCTOR').length}</div>
        </div>
        <div className="glass kpi-card glass-interactive">
          <div className="kpi-header">
            <span>Active Nurses</span>
            <div className="kpi-icon-wrapper" style={{ background: 'var(--success-bg)' }}>
              <Building size={20} style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <div className="kpi-val">{users.filter(u => u.role === 'NURSE').length}</div>
        </div>
      </div>

      {success && (
        <div className="badge badge-success" style={{ display: 'block', padding: '14px', width: '100%', marginBottom: '20px', borderRadius: '12px', textTransform: 'none', textAlign: 'center' }}>
          {success}
        </div>
      )}

      {error && (
        <div className="badge badge-danger" style={{ display: 'block', padding: '14px', width: '100%', marginBottom: '20px', borderRadius: '12px', textTransform: 'none', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div className="glass" style={{ padding: '16px 20px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Search size={20} style={{ color: 'var(--text-secondary)' }} />
        <input 
          type="text" 
          placeholder="Search users by name or email..." 
          className="form-control"
          style={{ border: 'none', background: 'transparent', padding: '5px' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="glass table-container" style={{ padding: '15px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Qualification</th>
              <th>District</th>
              <th>Subdistrict / Clinic (Doctor)</th>
              <th>Village / Area (Nurse)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isEditing = editingUserId === user.id;
                
                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${user.role === 'ADMIN' ? 'badge-danger' : user.role === 'DOCTOR' ? 'badge-warning' : 'badge-success'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{user.qualification || 'N/A'}</td>
                    
                    {isEditing ? (
                      <>
                        <td>
                          <select 
                            className="form-control" 
                            style={{ padding: '4px', fontSize: '0.85rem' }}
                            value={editForm.district_id}
                            onChange={(e) => setEditForm({...editForm, district_id: e.target.value})}
                            disabled={user.role !== 'ADMIN'}
                          >
                            <option value="">None</option>
                            {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <select 
                              className="form-control" 
                              style={{ padding: '4px', fontSize: '0.85rem' }}
                              value={editForm.subdistrict_id}
                              onChange={(e) => setEditForm({...editForm, subdistrict_id: e.target.value})}
                              disabled={user.role !== 'DOCTOR' && user.role !== 'ADMIN'}
                            >
                              <option value="">No Subdistrict</option>
                              {subdistricts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <select 
                              className="form-control" 
                              style={{ padding: '4px', fontSize: '0.85rem' }}
                              value={editForm.clinic_id}
                              onChange={(e) => setEditForm({...editForm, clinic_id: e.target.value})}
                              disabled={user.role !== 'DOCTOR'}
                            >
                              <option value="">No Clinic</option>
                              {clinics.map(c => <option key={c.id} value={c.id}>{c.clinic_name}</option>)}
                            </select>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <select 
                              className="form-control" 
                              style={{ padding: '4px', fontSize: '0.85rem' }}
                              value={editForm.village_id}
                              onChange={(e) => setEditForm({...editForm, village_id: e.target.value})}
                              disabled={user.role !== 'NURSE' && user.role !== 'ADMIN'}
                            >
                              <option value="">No Village</option>
                              {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                            <select 
                              className="form-control" 
                              style={{ padding: '4px', fontSize: '0.85rem' }}
                              value={editForm.area_id}
                              onChange={(e) => setEditForm({...editForm, area_id: e.target.value})}
                              disabled={user.role !== 'NURSE'}
                            >
                              <option value="">No Area</option>
                              {areas.filter(a => a.village_id === editForm.village_id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-success" style={{ padding: '6px' }} onClick={() => handleSaveUser(user.id)}>
                              <Save size={16} />
                            </button>
                            <button className="btn btn-danger" style={{ padding: '6px' }} onClick={handleCancelEdit}>
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{getDistrictName(user.district_id)}</td>
                        <td>
                          {getSubdistrictName(user.subdistrict_id)}
                          {user.clinic_id && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Clinic: {clinics.find(c => c.id === user.clinic_id)?.clinic_name || 'N/A'}</div>}
                        </td>
                        <td>
                          {getVillageName(user.village_id)}
                          {user.area_id && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Area: {areas.find(a => a.id === user.area_id)?.name || 'N/A'}</div>}
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(user)}>
                            <Edit2 size={14} /> Assign Location
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
          <div className="glass" style={{ width: '100%', maxWidth: '600px', padding: '35px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Plus size={24} style={{ color: 'var(--primary)' }} /> Register Provider
              </h2>
              <button className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => setShowRegModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleRegisterSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-control" required value={regForm.name} onChange={(e) => setRegForm({...regForm, name: e.target.value})} placeholder="e.g., Dr. Jane Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-control" required value={regForm.email} onChange={(e) => setRegForm({...regForm, email: e.target.value})} placeholder="jane@clinic.org" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control" required value={regForm.password} onChange={(e) => setRegForm({...regForm, password: e.target.value})} placeholder="Secure password" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input type="tel" className="form-control" value={regForm.phone} onChange={(e) => setRegForm({...regForm, phone: e.target.value})} placeholder="+91 9999999999" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Educational Qualification</label>
                <input type="text" className="form-control" value={regForm.qualification} onChange={(e) => setRegForm({...regForm, qualification: e.target.value})} placeholder="e.g., MBBS, MD, B.Sc Nursing" />
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="role" value="ADMIN" checked={regForm.role === 'ADMIN'} onChange={(e) => setRegForm({...regForm, role: e.target.value, subdistrict_id: '', village_id: ''})} />
                    <span style={{ fontWeight: regForm.role === 'ADMIN' ? 600 : 400, color: regForm.role === 'ADMIN' ? 'var(--danger)' : '' }}>District Admin</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="role" value="DOCTOR" checked={regForm.role === 'DOCTOR'} onChange={(e) => setRegForm({...regForm, role: e.target.value, district_id: '', village_id: ''})} />
                    <span style={{ fontWeight: regForm.role === 'DOCTOR' ? 600 : 400, color: regForm.role === 'DOCTOR' ? 'var(--warning)' : '' }}>Doctor</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="role" value="NURSE" checked={regForm.role === 'NURSE'} onChange={(e) => setRegForm({...regForm, role: e.target.value, district_id: '', subdistrict_id: ''})} />
                    <span style={{ fontWeight: regForm.role === 'NURSE' ? 600 : 400, color: regForm.role === 'NURSE' ? 'var(--success)' : '' }}>Nurse</span>
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
                    <label className="form-label">Assign District (Global Coverage)</label>
                    <select className="form-control" value={regForm.district_id} onChange={(e) => setRegForm({...regForm, district_id: e.target.value})}>
                      <option value="">Select District</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}

                {regForm.role === 'DOCTOR' && (
                  <div className="form-group mb-0" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label className="form-label">Assign Subdistrict (Regional Coverage)</label>
                      <select className="form-control" value={regForm.subdistrict_id} onChange={(e) => setRegForm({...regForm, subdistrict_id: e.target.value})}>
                        <option value="">Select Subdistrict</option>
                        {subdistricts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Assign Clinic (Specific Coverage)</label>
                      <select className="form-control" value={regForm.clinic_id} onChange={(e) => setRegForm({...regForm, clinic_id: e.target.value})}>
                        <option value="">Select Clinic</option>
                        {clinics.map(c => <option key={c.id} value={c.id}>{c.clinic_name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {regForm.role === 'NURSE' && (
                  <div className="form-group mb-0" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label className="form-label">Assign Village (Local Coverage)</label>
                      <select className="form-control" value={regForm.village_id} onChange={(e) => setRegForm({...regForm, village_id: e.target.value})}>
                        <option value="">Select Village</option>
                        {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Assign Area (Specific Coverage)</label>
                      <select className="form-control" value={regForm.area_id} onChange={(e) => setRegForm({...regForm, area_id: e.target.value})}>
                        <option value="">Select Area</option>
                        {areas.filter(a => a.village_id === regForm.village_id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '20px', fontSize: '1.05rem', borderRadius: '12px' }}>
                Register Staff & Send Credentials
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
