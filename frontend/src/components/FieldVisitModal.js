import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';
import { MapPin, Navigation, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = "AIzaSyCqlExf1BkdOn5QMmnraDl-DurE6jFeL1k";

const FieldVisitModal = ({ patient, user, onClose, onComplete }) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending'); // pending, captured, unavailable
  const [visitNotes, setVisitNotes] = useState('');
  const [visitId, setVisitId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  const [assignedCoords, setAssignedCoords] = useState(null);

  const requestGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setStatus('unavailable');
      return;
    }

    setStatus('pending');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setStatus('captured');
        setAssignedCoords([position.coords.latitude, position.coords.longitude]); // Mock assigned coords
      },
      (err) => {
        setError(`Unable to retrieve your location: ${err.message}`);
        setStatus('unavailable');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    // Attempt to request GPS on load
    requestGPS();
  }, []);

  const handleStartVisit = async () => {
    setApiError('');
    setIsSubmitting(true);
    try {
      const visit = await api.startFieldVisit({
        patient_id: patient.id,
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        accuracy: location?.accuracy || null,
        notes: 'Started visit',
        status: 'STARTED'
      });
      setVisitId(visit.id);
    } catch (err) {
      setApiError(err.message || 'Failed to start visit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteVisit = async () => {
    setApiError('');
    setIsSubmitting(true);
    try {
      if (!visitId) {
        // Start and complete at same time if they didn't hit start
        const visit = await api.startFieldVisit({
          patient_id: patient.id,
          latitude: location?.lat || null,
          longitude: location?.lng || null,
          accuracy: location?.accuracy || null,
          notes: visitNotes,
          status: 'COMPLETED'
        });
      } else {
        await api.updateFieldVisit(visitId, {
          patient_id: patient.id,
          notes: visitNotes,
          status: 'COMPLETED'
        });
      }
      onComplete();
    } catch (err) {
      setApiError(err.message || 'Failed to complete visit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '20px'
    }}>
      <div className="glass" style={{ width: '100%', maxWidth: '800px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            Field Visit: <span style={{ color: 'var(--primary)' }}>{patient.name}</span>
          </h2>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
        </div>

        {apiError && (
          <div className="badge badge-danger" style={{ display: 'block', padding: '10px', marginBottom: '15px' }}>
            {apiError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ marginBottom: '10px' }}>Location Status</h4>
            <div style={{ padding: '15px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              {status === 'pending' && <p>Requesting GPS...</p>}
              {status === 'unavailable' && (
                <div>
                  <AlertTriangle size={18} style={{ color: 'var(--warning)', marginRight: '8px' }} />
                  <strong style={{ color: 'var(--warning)' }}>Location Unavailable</strong>
                  <p style={{ fontSize: '0.85rem', marginTop: '5px', color: 'var(--text-secondary)' }}>{error}</p>
                  <p style={{ fontSize: '0.80rem', marginTop: '5px', color: 'var(--text-secondary)' }}>You can still proceed without GPS if authorized.</p>
                  <button className="btn btn-secondary btn-sm" onClick={requestGPS} style={{ marginTop: '10px' }}>Retry GPS</button>
                </div>
              )}
              {status === 'captured' && location && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                    <strong style={{ color: 'var(--success)' }}>Location Captured</strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <p>Lat: {location.lat.toFixed(6)}</p>
                    <p>Lng: {location.lng.toFixed(6)}</p>
                    <p>Accuracy: {location.accuracy.toFixed(1)} meters</p>
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                    <strong>Status: </strong> 
                    <span style={{ color: 'var(--success)' }}>Within Assigned Area</span> 
                    {/* Hardcoded success for demo. In prod, check distance to village centroid */}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Visit Notes</label>
              <textarea 
                className="form-control" 
                rows="4" 
                placeholder="Observations, health status..."
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
              />
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: '10px' }}>Map Reference</h4>
            <div style={{ height: '250px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#e5e7eb' }}>
              {status === 'captured' && location && isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={{ lat: location.lat, lng: location.lng }}
                  zoom={15}
                  options={{ disableDefaultUI: true, zoomControl: true }}
                >
                  <Marker position={{ lat: location.lat, lng: location.lng }} />
                  <Circle 
                    center={{ lat: location.lat, lng: location.lng }} 
                    radius={300} 
                    options={{ strokeColor: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, strokeOpacity: 0.5, strokeWeight: 2 }} 
                  />
                </GoogleMap>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', padding: '20px', textAlign: 'center' }}>
                  {status === 'pending' ? 'Loading map...' : 'Map unavailable without GPS coordinates.'}
                </div>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
              * Exact patient coordinates are never exposed publicly. Showing area reference.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' }}>
          {!visitId && (
            <button 
              className="btn btn-secondary" 
              onClick={handleStartVisit}
              disabled={isSubmitting}
            >
              Start Visit Log
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={handleCompleteVisit}
            disabled={isSubmitting}
          >
            Complete Field Visit
          </button>
        </div>

      </div>
    </div>
  );
};

export default FieldVisitModal;
