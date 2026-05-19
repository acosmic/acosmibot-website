import React, { useState, useEffect, useRef, useCallback } from 'react';
import { bannedUsersApi, MemberSearchResult } from '@/api/bannedUsers';

interface MemberSearchInputProps {
  guildId: string;
  onSelect: (member: MemberSearchResult) => void;
  excludeUserIds?: string[];
  placeholder?: string;
}

export const MemberSearchInput: React.FC<MemberSearchInputProps> = ({
  guildId,
  onSelect,
  excludeUserIds = [],
  placeholder = 'Search by username…',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await bannedUsersApi.searchMembers(guildId, q);
        const filtered = (res.data ?? []).filter((m) => !excludeUserIds.includes(m.user_id));
        setResults(filtered);
        setIsOpen(filtered.length > 0);
        setActiveIndex(-1);
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [guildId, excludeUserIds],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (member: MemberSearchResult) => {
    onSelect(member);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const displayName = (m: MemberSearchResult) => m.nickname || m.username;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        autoComplete="off"
      />
      {isLoading && (
        <div className="small text-muted mt-1">Searching…</div>
      )}
      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {results.map((member, idx) => (
            <div
              key={member.user_id}
              onClick={() => handleSelect(member)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                background: idx === activeIndex ? 'var(--bg-tertiary)' : 'transparent',
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 'bold',
                    flexShrink: 0,
                  }}
                >
                  {displayName(member).charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="small fw-bold">{displayName(member)}</div>
                {member.nickname && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{member.username}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
