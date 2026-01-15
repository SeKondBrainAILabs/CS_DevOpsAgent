/**
 * FileLockList Component
 * Display active file locks
 */

import React, { useState, useEffect } from 'react';
import { useIpcSubscription } from '../../hooks/useIpcSubscription';
import type { FileLock, FileConflict } from '../../../shared/types';

export function FileLockList(): React.ReactElement {
  const [locks, setLocks] = useState<FileLock[]>([]);
  const [loading, setLoading] = useState(true);

  // Load locks
  useEffect(() => {
    setLoading(true);
    window.api.lock.list().then((result) => {
      if (result.success && result.data) {
        setLocks(result.data);
      }
      setLoading(false);
    });
  }, []);

  // Subscribe to conflict events
  useIpcSubscription(
    window.api.lock.onConflictDetected,
    (conflicts) => {
      console.warn('File conflicts detected:', conflicts);
      // Could show a notification
    },
    []
  );

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return `${Math.floor(diffMinutes / 60)}h ago`;
  };

  if (loading) {
    return <div className="p-4 text-gray-500 text-sm">Loading locks...</div>;
  }

  if (locks.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm text-center">
        No active file locks
      </div>
    );
  }

  return (
    <div className="py-2 space-y-2">
      {locks.map((lock) => (
        <div
          key={lock.sessionId}
          className="mx-2 p-3 bg-surface-tertiary rounded-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="badge badge-info">{lock.agentType}</span>
            <span className="text-xs text-gray-500">
              {formatTime(lock.declaredAt)}
            </span>
          </div>

          {/* Files */}
          <div className="space-y-1">
            {lock.files.slice(0, 5).map((file) => (
              <div
                key={file}
                className="text-xs text-gray-300 flex items-center gap-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-500"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="truncate">{file}</span>
              </div>
            ))}
            {lock.files.length > 5 && (
              <div className="text-xs text-gray-500">
                +{lock.files.length - 5} more files
              </div>
            )}
          </div>

          {/* Operation badge */}
          <div className="mt-2 flex items-center justify-between">
            <span
              className={`badge ${
                lock.operation === 'edit'
                  ? 'badge-warning'
                  : lock.operation === 'delete'
                  ? 'badge-error'
                  : 'badge-info'
              }`}
            >
              {lock.operation}
            </span>
            <span className="text-xs text-gray-500">
              ~{lock.estimatedDuration}m remaining
            </span>
          </div>

          {/* Reason */}
          {lock.reason && (
            <p className="mt-2 text-xs text-gray-400 italic">{lock.reason}</p>
          )}
        </div>
      ))}
    </div>
  );
}
