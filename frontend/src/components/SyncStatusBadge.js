import React, { useState, useRef, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, X, Check } from 'lucide-react';
import useOfflineSync from '../hooks/useOfflineSync';

export const SyncStatusBadge = () => {
  const {
    isOnline,
    isBackendReachable,
    isSyncing,
    pendingCount,
    failedCount,
    lastSyncTime,
    lastSyncError,
    syncNow
  } = useOfflineSync();

  const [showPopover, setShowPopover] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const popoverRef = useRef(null);

  const isConnected = isOnline && isBackendReachable;

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  const handleManualSync = async (e) => {
    e.stopPropagation();
    if (isSyncing || triggering) return;
    setTriggering(true);
    try {
      await syncNow();
    } finally {
      setTriggering(false);
    }
  };

  // Determine badge visual state
  let badgeColor = '#059669'; // Emerald green
  let badgeBg = '#ecfdf5';
  let badgeBorder = '#a7f3d0';
  let icon = <Wifi size={14} style={{ color: '#059669' }} />;
  let label = 'Online';

  if (isSyncing || triggering) {
    badgeColor = '#0284c7';
    badgeBg = '#f0f9ff';
    badgeBorder = '#bae6fd';
    icon = <RefreshCw size={14} className="animate-spin text-primary" style={{ animation: 'spin 1s linear infinite' }} />;
    label = pendingCount > 0 ? `Syncing (${pendingCount})...` : 'Syncing...';
  } else if (!isConnected) {
    badgeColor = '#d97706';
    badgeBg = '#fffbeb';
    badgeBorder = '#fde68a';
    icon = <WifiOff size={14} style={{ color: '#d97706' }} />;
    label = pendingCount > 0 ? `Offline (${pendingCount} pending)` : 'Offline';
  } else if (failedCount > 0) {
    badgeColor = '#dc2626';
    badgeBg = '#fef2f2';
    badgeBorder = '#fecaca';
    icon = <AlertCircle size={14} style={{ color: '#dc2626' }} />;
    label = `Sync Issue (${failedCount})`;
  } else if (pendingCount > 0) {
    badgeColor = '#0284c7';
    badgeBg = '#f0f9ff';
    badgeBorder = '#bae6fd';
    icon = <RefreshCw size={14} style={{ color: '#0284c7' }} />;
    label = `${pendingCount} Pending Sync`;
  }

  const formatLastSync = (ts) => {
    if (!ts) return 'Never';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className="sync-status-badge"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '20px',
          backgroundColor: badgeBg,
          border: `1.5px solid ${badgeBorder}`,
          color: badgeColor,
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}
        title="Network & Offline Synchronization Status"
      >
        {icon}
        <span>{label}</span>
      </button>

      {showPopover && (
        <div
          className="sync-popover"
          style={{
            position: 'absolute',
            right: 0,
            top: '46px',
            width: '310px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            zIndex: 1100,
            boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.15), 0 5px 15px rgba(0, 0, 0, 0.05)',
            fontSize: '0.86rem',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Popover Header with Title and Close Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>Sync Status</span>
              <span style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: badgeBg,
                color: badgeColor,
                border: `1px solid ${badgeBorder}`,
                fontWeight: 700
              }}>
                {isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              title="Close Sync Details"
            >
              <X size={15} />
            </button>
          </div>

          {/* Details Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#64748b', fontSize: '0.82rem', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
              <span>Server Reachability:</span>
              <span style={{ color: isBackendReachable ? '#059669' : '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isBackendReachable ? <Check size={13} /> : null}
                {isBackendReachable ? 'Reachable' : 'Unreachable'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
              <span>Pending Actions:</span>
              <span style={{ 
                fontWeight: 700, 
                color: pendingCount > 0 ? '#0284c7' : '#0f172a',
                padding: pendingCount > 0 ? '1px 8px' : '0',
                background: pendingCount > 0 ? '#e0f2fe' : 'transparent',
                borderRadius: '10px'
              }}>
                {pendingCount}
              </span>
            </div>

            {failedCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#fef2f2', borderRadius: '6px', color: '#dc2626' }}>
                <span>Failed Actions:</span>
                <span style={{ fontWeight: 700 }}>{failedCount}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
              <span>Last Synchronized:</span>
              <span style={{ color: '#0f172a', fontWeight: 600 }}>{formatLastSync(lastSyncTime)}</span>
            </div>

            {lastSyncError && (
              <div style={{ marginTop: '4px', padding: '8px 10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '0.76rem' }}>
                <strong>Issue:</strong> {lastSyncError}
              </div>
            )}
          </div>

          {/* Action Buttons: Sync Now & Close */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || triggering || !isConnected}
              className="btn btn-primary"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px',
                opacity: (isSyncing || triggering || !isConnected) ? 0.6 : 1,
                cursor: (isSyncing || triggering || !isConnected) ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={14} className={(isSyncing || triggering) ? 'animate-spin' : ''} />
              {(isSyncing || triggering) ? 'Syncing Now...' : 'Sync Now'}
            </button>

            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="btn btn-secondary"
              style={{
                padding: '9px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatusBadge;
