import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MapPin, Plus, Edit2, Save, X, Navigation, Building2, Home } from 'lucide-react';

const AdminLocations = () => {
  const [districts, setDistricts] = useState([]);
  const [subdistricts, setSubdistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [areas, setAreas] = useState([]);
  const [clinics, setClinics] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals for creating new locations
  const [showSubModal, setShowSubModal] = useState(false);
  const [showVilModal, setShowVilModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showClinicModal, setShowClinicModal] = useState(false);

  const [newSubForm, setNewSubForm] = useState({ name: '', district_id: '' });
  const [newVilForm, setNewVilForm] = useState({ name: '', subdistrict_id: '' });
  const [newAreaForm, setNewAreaForm] = useState({ name: '', village_id: '' });
  const [newClinicForm, setNewClinicForm] = useState({ clinic_code: '', clinic_name: '', district_id: '', subdistrict_id: '', village_id: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [distData, subData, vilData, areaData, clinicData] = await Promise.all([
        api.getDistricts(),
        api.getSubdistricts(),
        api.getVillages(),
        api.getAreas(),
        api.getClinics()
      ]);
      setDistricts(distData);
      setSubdistricts(subData);
      setVillages(vilData);
      setAreas(areaData || []);
      setClinics(clinicData || []);
    } catch (err) {
      setError('Failed to fetch location data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubdistrict = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.createSubdistrict({
        name: newSubForm.name,
        district_id: newSubForm.district_id
      });
      setSuccess(`Subdistrict '${newSubForm.name}' created successfully!`);
      setShowSubModal(false);
      setNewSubForm({ name: '', district_id: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create subdistrict');
    }
  };

  const handleCreateVillage = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.createVillage({
        name: newVilForm.name,
        subdistrict_id: newVilForm.subdistrict_id
      });
      setSuccess(`Village '${newVilForm.name}' created successfully!`);
      setShowVilModal(false);
      setNewVilForm({ name: '', subdistrict_id: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create village');
    }
  };

  const handleCreateArea = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.createArea({
        name: newAreaForm.name,
        village_id: newAreaForm.village_id
      });
      setSuccess(`Area '${newAreaForm.name}' created successfully!`);
      setShowAreaModal(false);
      setNewAreaForm({ name: '', village_id: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create area');
    }
  };

  const handleCreateClinic = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      // Find the district and subdistrict based on the village id.
      const village = villages.find(v => v.id === newClinicForm.village_id);
      const subdistrict = subdistricts.find(s => s.id === village?.subdistrict_id);
      const districtId = subdistrict?.district_id;
      
      await api.createClinic({
        clinic_code: newClinicForm.clinic_code,
        clinic_name: newClinicForm.clinic_name,
        district_id: districtId,
        subdistrict_id: village.subdistrict_id,
        village_id: newClinicForm.village_id
      });
      setSuccess(`Clinic '${newClinicForm.clinic_name}' created successfully!`);
      setShowClinicModal(false);
      setNewClinicForm({ clinic_code: '', clinic_name: '', district_id: '', subdistrict_id: '', village_id: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create clinic');
    }
  };

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Territories...</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MapPin size={28} style={{ color: 'var(--primary)' }} />
            Territory & Locations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '6px' }}>
            Manage hierarchical geographic boundaries for your healthcare network.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowSubModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem' }}>
            <Plus size={16} /> Subdistrict
          </button>
          <button className="btn btn-secondary" onClick={() => setShowVilModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem' }}>
            <Plus size={16} /> Village
          </button>
          <button className="btn btn-primary" onClick={() => setShowAreaModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem' }}>
            <Plus size={16} /> Area
          </button>
          <button className="btn btn-primary" onClick={() => setShowClinicModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem' }}>
            <Plus size={16} /> Clinic
          </button>
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

      {/* Hierarchical View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {districts.map(district => {
          const districtSubs = subdistricts.filter(s => s.district_id === district.id);
          
          return (
            <div key={district.id} className="glass" style={{ padding: '25px', borderRadius: '16px' }}>
              
              {/* District Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-card)' }}>
                <div style={{ background: 'var(--danger-bg)', padding: '12px', borderRadius: '12px' }}>
                  <Navigation size={24} style={{ color: 'var(--danger)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{district.name} District</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Central Jurisdiction</span>
                </div>
              </div>

              {/* Subdistricts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {districtSubs.length === 0 ? (
                  <div style={{ padding: '20px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No subdistricts established yet.
                  </div>
                ) : (
                  districtSubs.map(sub => {
                    const subVillages = villages.filter(v => v.subdistrict_id === sub.id);
                    
                    return (
                      <div key={sub.id} className="glass glass-interactive" style={{ padding: '20px', background: '#f8fafc', border: '1px solid var(--border-card)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                          <div style={{ background: 'var(--warning-bg)', padding: '8px', borderRadius: '8px' }}>
                            <Building2 size={18} style={{ color: 'var(--warning)' }} />
                          </div>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{sub.name}</h3>
                        </div>
                        
                        <div style={{ paddingLeft: '40px', borderLeft: '2px solid #f1f5f9', marginLeft: '16px' }}>
                          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                            Villages ({subVillages.length})
                          </h4>
                          
                          {subVillages.length === 0 ? (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No villages mapped.</div>
                          ) : (
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              {subVillages.map(village => {
                                const villageAreas = areas.filter(a => a.village_id === village.id);
                                const villageClinics = clinics.filter(c => c.village_id === village.id);
                                
                                return (
                                  <li key={village.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', padding: '10px', background: '#f1f5f9', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                      <Home size={16} style={{ color: 'var(--success)' }} />
                                      <span>{village.name}</span>
                                    </div>
                                    
                                    <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {villageAreas.length > 0 && (
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                          <strong>Areas:</strong> {villageAreas.map(a => a.name).join(', ')}
                                        </div>
                                      )}
                                      {villageClinics.length > 0 && (
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                          <strong>Clinics:</strong> {villageClinics.map(c => c.clinic_name).join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* CREATE SUBDISTRICT MODAL */}
      {showSubModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '35px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={24} style={{ color: 'var(--warning)' }} /> Add Subdistrict
              </h2>
              <button className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => setShowSubModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubdistrict}>
              <div className="form-group">
                <label className="form-label">Subdistrict Name</label>
                <input type="text" className="form-control" required value={newSubForm.name} onChange={(e) => setNewSubForm({...newSubForm, name: e.target.value})} placeholder="e.g., Perundurai" />
              </div>
              <div className="form-group">
                <label className="form-label">Parent District</label>
                <select className="form-control" required value={newSubForm.district_id} onChange={(e) => setNewSubForm({...newSubForm, district_id: e.target.value})}>
                  <option value="">Select District</option>
                  {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px', fontSize: '1.05rem', borderRadius: '12px' }}>
                Create Subdistrict
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE VILLAGE MODAL */}
      {showVilModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '35px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Home size={24} style={{ color: 'var(--success)' }} /> Add Village
              </h2>
              <button className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => setShowVilModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateVillage}>
              <div className="form-group">
                <label className="form-label">Village Name</label>
                <input type="text" className="form-control" required value={newVilForm.name} onChange={(e) => setNewVilForm({...newVilForm, name: e.target.value})} placeholder="e.g., Kunnathur" />
              </div>
              <div className="form-group">
                <label className="form-label">Parent Subdistrict</label>
                <select className="form-control" required value={newVilForm.subdistrict_id} onChange={(e) => setNewVilForm({...newVilForm, subdistrict_id: e.target.value})}>
                  <option value="">Select Subdistrict</option>
                  {subdistricts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px', fontSize: '1.05rem', borderRadius: '12px' }}>
                Create Village
              </button>
            </form>
          </div>
        </div>
      )}
      {/* CREATE AREA MODAL */}
      {showAreaModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '35px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Plus size={24} style={{ color: 'var(--primary)' }} /> Add Area
              </h2>
              <button className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => setShowAreaModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateArea}>
              <div className="form-group">
                <label className="form-label">Area Name</label>
                <input type="text" className="form-control" required value={newAreaForm.name} onChange={(e) => setNewAreaForm({...newAreaForm, name: e.target.value})} placeholder="e.g., North Sector" />
              </div>
              <div className="form-group">
                <label className="form-label">Parent Village</label>
                <select className="form-control" required value={newAreaForm.village_id} onChange={(e) => setNewAreaForm({...newAreaForm, village_id: e.target.value})}>
                  <option value="">Select Village</option>
                  {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px', fontSize: '1.05rem', borderRadius: '12px' }}>
                Create Area
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CLINIC MODAL */}
      {showClinicModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '35px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Plus size={24} style={{ color: 'var(--primary)' }} /> Add Clinic
              </h2>
              <button className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => setShowClinicModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateClinic}>
              <div className="form-group">
                <label className="form-label">Clinic Code</label>
                <input type="text" className="form-control" required value={newClinicForm.clinic_code} onChange={(e) => setNewClinicForm({...newClinicForm, clinic_code: e.target.value})} placeholder="e.g., CL-001" />
              </div>
              <div className="form-group">
                <label className="form-label">Clinic Name</label>
                <input type="text" className="form-control" required value={newClinicForm.clinic_name} onChange={(e) => setNewClinicForm({...newClinicForm, clinic_name: e.target.value})} placeholder="e.g., Central Village Clinic" />
              </div>
              <div className="form-group">
                <label className="form-label">Parent Village</label>
                <select className="form-control" required value={newClinicForm.village_id} onChange={(e) => setNewClinicForm({...newClinicForm, village_id: e.target.value})}>
                  <option value="">Select Village</option>
                  {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px', fontSize: '1.05rem', borderRadius: '12px' }}>
                Create Clinic
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminLocations;
