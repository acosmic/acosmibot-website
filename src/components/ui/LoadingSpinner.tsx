import React from 'react';

export const LoadingSpinner: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid var(--border-light)',
      borderTop: '3px solid var(--primary-color)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }} />
    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Loading...</p>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);
