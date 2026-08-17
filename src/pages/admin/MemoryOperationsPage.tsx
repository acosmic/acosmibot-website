import React from 'react';
import { PublicNav } from '@/components/layout/PublicNav';
import { MemoryConstellationPanel } from '@/features/memory/MemoryConstellationPanel';
import '@/styles/admin.css';

export const MemoryOperationsPage: React.FC = () => (
  <div className="admin-page memory-operations-page">
    <PublicNav variant="observatory" />
    <main className="admin-main">
      <header className="admin-header"><div><p className="admin-kicker">Owner control plane</p><h1>Memory operations.</h1><p>Aggregate projection health for the second-brain surfaces.</p></div></header>
      <MemoryConstellationPanel mode="owner" />
    </main>
  </div>
);

export default MemoryOperationsPage;
