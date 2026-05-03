import React, { useState, useEffect, useCallback } from 'react';

interface RagDocument {
  document_id: string;
  title: string;
  content_type: string;
  source_url: string | null;
  total_chunks: number;
  embedding_status: 'pending' | 'processing' | 'completed' | 'failed';
  indexed_at: string | null;
  created_at: string | null;
}

interface RagChunk {
  chunk_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  section_title: string | null;
  section_path: string | null;
}

interface QueryResult {
  content: string;
  section_title: string | null;
  section_path: string | null;
  score: number;
  source_url: string | null;
}

interface QueryLog {
  id: number;
  guild_id: string | null;
  user_id: string;
  query: string;
  chunk_count: number;
  avg_relevance: number | null;
  response_generated: boolean;
  timestamp: string | null;
}

interface HealthData {
  chromadb: 'ok' | 'error';
  collection_exists: boolean;
  vector_count: number;
  document_count: number;
}

interface RefreshResult {
  file: string;
  title: string;
  status: 'ingested' | 'skipped' | 'failed';
  error?: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#4ade80',
  pending: '#fbbf24',
  processing: '#60a5fa',
  failed: '#f87171',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: '20px 24px',
  marginBottom: 24,
};

export const RagTab: React.FC<{ token: string | null }> = ({ token }) => {
  const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';

  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [chunkCache, setChunkCache] = useState<Record<string, RagChunk[]>>({});
  const [chunksLoading, setChunksLoading] = useState<Set<string>>(new Set());

  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [refreshResults, setRefreshResults] = useState<RefreshResult[] | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const [queryText, setQueryText] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResults, setQueryResults] = useState<QueryResult[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchHealth = useCallback(() => {
    fetch(`${apiBase}/api/admin/rag/health`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.success) setHealth(d); else setHealthError(d.error); })
      .catch(e => setHealthError(String(e)));
  }, []);

  const fetchDocuments = useCallback(() => {
    setDocsLoading(true);
    fetch(`${apiBase}/api/admin/rag/documents`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => {
        if (d.success) { setDocuments(d.documents); setDocsError(null); }
        else setDocsError(d.error);
      })
      .catch(e => setDocsError(String(e)))
      .finally(() => setDocsLoading(false));
  }, []);

  const fetchLogs = useCallback(() => {
    setLogsLoading(true);
    fetch(`${apiBase}/api/admin/rag/logs?limit=200`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.success) setLogs(d.logs); })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchDocuments();
    fetchLogs();
  }, []);

  const toggleDoc = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
        if (!chunkCache[docId]) {
          setChunksLoading(l => new Set(l).add(docId));
          fetch(`${apiBase}/api/admin/rag/documents/${docId}/chunks`, { headers: authHeaders })
            .then(r => r.json())
            .then(d => {
              if (d.success) setChunkCache(c => ({ ...c, [docId]: d.chunks }));
            })
            .finally(() => setChunksLoading(l => { const s = new Set(l); s.delete(docId); return s; }));
        }
      }
      return next;
    });
  };

  const handleRefresh = async (force = false) => {
    setRefreshing(true);
    setRefreshMsg(null);
    setRefreshResults(null);
    try {
      const r = await fetch(`${apiBase}/api/admin/rag/refresh${force ? '?force=true' : ''}`, {
        method: 'POST',
        headers: authHeaders,
      });
      const d = await r.json();
      setRefreshMsg({ text: d.message ?? (d.success ? 'Done' : d.error), ok: d.success });
      if (d.results) setRefreshResults(d.results);
      if (d.success) { fetchDocuments(); fetchHealth(); }
    } catch (e) {
      setRefreshMsg({ text: String(e), ok: false });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (deleteConfirm !== docId) { setDeleteConfirm(docId); return; }
    setDeleting(docId);
    setDeleteConfirm(null);
    try {
      const r = await fetch(`${apiBase}/api/admin/rag/documents/${docId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const d = await r.json();
      if (d.success) {
        setDocuments(prev => prev.filter(doc => doc.document_id !== docId));
        setChunkCache(c => { const n = { ...c }; delete n[docId]; return n; });
        fetchHealth();
      }
    } catch {}
    setDeleting(null);
  };

  const handleDeleteAll = async () => {
    if (!deleteAllConfirm) { setDeleteAllConfirm(true); return; }
    setDeletingAll(true);
    setDeleteAllConfirm(false);
    setRefreshMsg(null);
    setRefreshResults(null);
    try {
      const r = await fetch(`${apiBase}/api/admin/rag/documents`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const d = await r.json();
      setRefreshMsg({ text: d.message ?? (d.success ? 'Deleted all documents' : d.error), ok: d.success });
      if (d.success) {
        setDocuments([]);
        setExpandedDocs(new Set());
        setChunkCache({});
        fetchHealth();
      } else {
        fetchDocuments();
        fetchHealth();
      }
    } catch (e) {
      setRefreshMsg({ text: String(e), ok: false });
    } finally {
      setDeletingAll(false);
    }
  };

  const handleQuery = async () => {
    if (!queryText.trim()) return;
    setQueryLoading(true);
    setQueryResults(null);
    setQueryError(null);
    try {
      const r = await fetch(`${apiBase}/api/admin/rag/query`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, top_k: 5 }),
      });
      const d = await r.json();
      if (d.success) setQueryResults(d.results);
      else setQueryError(d.error);
    } catch (e) {
      setQueryError(String(e));
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div>
      {/* Header: health badge + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h3 style={{ margin: 0 }}>RAG Knowledge Base</h3>
          {health ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: health.chromadb === 'ok' ? '#4ade80' : '#f87171' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: health.chromadb === 'ok' ? '#4ade80' : '#f87171', display: 'inline-block' }} />
              ChromaDB {health.chromadb === 'ok' ? 'OK' : 'Error'} &middot; {health.vector_count.toLocaleString()} vectors
            </span>
          ) : healthError ? (
            <span style={{ fontSize: '0.82rem', color: '#f87171' }}>ChromaDB unreachable</span>
          ) : (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Checking...</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => handleRefresh(false)}
            disabled={refreshing || deletingAll}
            className="btn btn-sm btn-outline-secondary"
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh Help Docs'}
          </button>
          <button
            onClick={() => handleRefresh(true)}
            disabled={refreshing || deletingAll}
            className="btn btn-sm btn-outline-warning"
          >
            Force Re-ingest Help
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={refreshing || deletingAll || documents.length === 0}
            className="btn btn-sm btn-outline-danger"
          >
            {deletingAll ? 'Deleting...' : deleteAllConfirm ? 'Confirm Delete All?' : 'Delete All'}
          </button>
          {deleteAllConfirm && (
            <button
              onClick={() => setDeleteAllConfirm(false)}
              disabled={deletingAll}
              className="btn btn-sm btn-outline-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {refreshMsg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: refreshMsg.ok ? '#14532d' : '#450a0a', border: `1px solid ${refreshMsg.ok ? '#4ade80' : '#f87171'}`, fontSize: '0.85rem' }}>
          {refreshMsg.text}
          {refreshResults && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.8rem' }}>
              {refreshResults.map(r => (
                <li key={r.file} style={{ color: r.status === 'failed' ? '#f87171' : r.status === 'skipped' ? 'var(--text-muted)' : '#4ade80' }}>
                  {r.title} ({r.file}) — {r.status}{r.error ? `: ${r.error}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Documents */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h5 style={{ margin: 0 }}>Documents ({documents.length})</h5>
        </div>

        {docsLoading ? (
          <p className="text-muted">Loading...</p>
        ) : docsError ? (
          <p style={{ color: '#f87171' }}>{docsError}</p>
        ) : documents.length === 0 ? (
          <p className="text-muted">No documents indexed yet. Click "Refresh Help Docs" to ingest bot Markdown help docs.</p>
        ) : (
          <div>
            {documents.map(doc => {
              const expanded = expandedDocs.has(doc.document_id);
              const chunks = chunkCache[doc.document_id];
              const loadingChunks = chunksLoading.has(doc.document_id);
              const confirmingDelete = deleteConfirm === doc.document_id;
              const isDeletingThis = deleting === doc.document_id;

              return (
                <div key={doc.document_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', padding: '10px 4px', gap: 12, cursor: 'pointer' }}
                    onClick={() => toggleDoc(doc.document_id)}
                  >
                    <span style={{ width: 16, color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }}>
                      {expanded ? '▼' : '▶'}
                    </span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{doc.title}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }}>{doc.total_chunks} chunks</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: STATUS_COLORS[doc.embedding_status] ?? 'inherit', flexShrink: 0 }}>
                      {doc.embedding_status}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', flexShrink: 0 }}>
                      {doc.indexed_at ? new Date(doc.indexed_at).toLocaleDateString() : '—'}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(doc.document_id); }}
                      disabled={isDeletingThis}
                      style={{
                        background: 'none',
                        border: `1px solid ${confirmingDelete ? '#f87171' : 'var(--border-light)'}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        color: confirmingDelete ? '#f87171' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}
                    >
                      {isDeletingThis ? '...' : confirmingDelete ? 'Confirm?' : 'Delete'}
                    </button>
                    {confirmingDelete && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(null); }}
                        style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: 4, padding: '2px 8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {expanded && (
                    <div style={{ paddingLeft: 28, paddingBottom: 8 }}>
                      {loadingChunks ? (
                        <p className="text-muted" style={{ fontSize: '0.8rem' }}>Loading chunks...</p>
                      ) : chunks ? (
                        chunks.map(chunk => (
                          <div key={chunk.chunk_id} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.8rem', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 28 }}>#{chunk.chunk_index}</span>
                            <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 60 }}>{chunk.token_count} tok</span>
                            <span style={{ color: '#60a5fa', flexShrink: 0, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {chunk.section_title ?? '—'}
                            </span>
                            <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {chunk.content.slice(0, 120)}{chunk.content.length > 120 ? '…' : ''}
                            </span>
                          </div>
                        ))
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Test Query */}
      <div style={cardStyle}>
        <h5 style={{ marginBottom: 16 }}>Test Query</h5>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="form-control"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            placeholder="e.g. what can you do?"
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
          />
          <button
            onClick={handleQuery}
            disabled={queryLoading || !queryText.trim()}
            className="btn btn-sm btn-outline-secondary"
            style={{ flexShrink: 0 }}
          >
            {queryLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {queryError && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{queryError}</p>}

        {queryResults !== null && (
          queryResults.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>No results above threshold.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {queryResults.map((r, i) => (
                <div key={i} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 6, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: r.score >= 0.7 ? '#4ade80' : r.score >= 0.5 ? '#fbbf24' : '#f87171', fontSize: '0.82rem' }}>
                      {(r.score * 100).toFixed(0)}% match
                    </span>
                    {r.section_title && <span style={{ color: '#60a5fa', fontSize: '0.8rem' }}>{r.section_title}</span>}
                    {r.section_path && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.section_path}</span>}
                    {/* score bar */}
                    <div style={{ flex: 1, minWidth: 80, height: 4, background: 'var(--border-light)', borderRadius: 2 }}>
                      <div style={{ width: `${r.score * 100}%`, height: '100%', background: r.score >= 0.7 ? '#4ade80' : r.score >= 0.5 ? '#fbbf24' : '#f87171', borderRadius: 2 }} />
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {r.content.slice(0, 300)}{r.content.length > 300 ? '…' : ''}
                  </p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Query Logs */}
      <div style={cardStyle}>
        <h5 style={{ marginBottom: 16 }}>Recent /help Queries</h5>
        {logsLoading ? (
          <p className="text-muted">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-muted">No queries logged yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-dark table-hover" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', borderColor: 'var(--border-light)' }}>Time</th>
                  <th style={{ borderColor: 'var(--border-light)' }}>User</th>
                  <th style={{ borderColor: 'var(--border-light)' }}>Query</th>
                  <th style={{ borderColor: 'var(--border-light)' }}>Chunks</th>
                  <th style={{ borderColor: 'var(--border-light)' }}>Avg Score</th>
                  <th style={{ borderColor: 'var(--border-light)' }}>Response</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ borderColor: 'var(--border-light)', whiteSpace: 'nowrap' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </td>
                    <td style={{ borderColor: 'var(--border-light)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{log.user_id}</td>
                    <td style={{ borderColor: 'var(--border-light)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={log.query}>
                      {log.query}
                    </td>
                    <td style={{ borderColor: 'var(--border-light)' }}>{log.chunk_count}</td>
                    <td style={{ borderColor: 'var(--border-light)', color: log.avg_relevance !== null ? (log.avg_relevance >= 0.7 ? '#4ade80' : log.avg_relevance >= 0.5 ? '#fbbf24' : '#f87171') : 'var(--text-muted)' }}>
                      {log.avg_relevance !== null ? `${(log.avg_relevance * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ borderColor: 'var(--border-light)' }}>
                      {log.response_generated
                        ? <span style={{ color: '#4ade80' }}>✓</span>
                        : <span style={{ color: '#f87171' }}>✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
