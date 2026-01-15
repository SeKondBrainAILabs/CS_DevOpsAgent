/**
 * CloseSessionDialog Component
 * Confirmation dialog for closing sessions with merge options
 */

import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import type { BranchInfo } from '../../../shared/types';

interface CloseSessionDialogProps {
  sessionId: string;
  onClose: () => void;
}

export function CloseSessionDialog({
  sessionId,
  onClose,
}: CloseSessionDialogProps): React.ReactElement {
  const { getSessionById, removeSession } = useSessionStore();
  const session = getSessionById(sessionId);

  const [merge, setMerge] = useState(true);
  const [mergeTarget, setMergeTarget] = useState(session?.baseBranch || 'main');
  const [deleteRemote, setDeleteRemote] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    if (sessionId) {
      window.api.git.branches(sessionId).then((result) => {
        if (result.success && result.data) {
          setBranches(result.data.filter((b) => !b.name.startsWith('session/')));
        }
      });
    }
  }, [sessionId]);

  if (!session) {
    return <div>Session not found</div>;
  }

  const handleClose = async () => {
    setError(null);
    setIsClosing(true);

    try {
      const result = await window.api.session.close({
        sessionId,
        merge,
        mergeTarget: merge ? mergeTarget : undefined,
        deleteRemote,
      });

      if (result.success) {
        removeSession(sessionId);
        onClose();
      } else {
        setError(result.error?.message || 'Failed to close session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-secondary border border-border rounded-lg w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-gray-100">Close Session</h2>
          <button onClick={onClose} className="btn-icon" disabled={isClosing}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Session info */}
          <div className="p-3 bg-surface-tertiary rounded-md">
            <p className="font-medium text-gray-200">{session.name}</p>
            <p className="text-sm text-gray-400 mt-1">{session.branchName}</p>
            <p className="text-sm text-gray-500 mt-1">
              {session.commitCount} commits
            </p>
          </div>

          {/* Warning about uncommitted changes */}
          {session.status === 'watching' && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-yellow-400 text-sm">
              <strong>Warning:</strong> This session is actively watching for
              changes. Make sure all changes are committed before closing.
            </div>
          )}

          {/* Merge options */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={merge}
                onChange={(e) => setMerge(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface-tertiary"
                disabled={isClosing}
              />
              <span className="text-gray-300">Merge before closing</span>
            </label>
          </div>

          {merge && (
            <div>
              <label className="label">Merge target branch</label>
              <select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                className="select"
                disabled={isClosing}
              >
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Delete remote option */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteRemote}
                onChange={(e) => setDeleteRemote(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface-tertiary"
                disabled={isClosing}
              />
              <span className="text-gray-300">Delete remote branch</span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isClosing}
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
              disabled={isClosing}
            >
              {isClosing ? 'Closing...' : 'Close Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
