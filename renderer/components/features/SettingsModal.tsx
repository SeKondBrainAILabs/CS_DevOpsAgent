/**
 * SettingsModal Component
 * Application settings, credentials, and maintenance
 */

import React, { useState, useEffect } from 'react';
import type { AppConfig, AgentType } from '../../../shared/types';

interface SettingsModalProps {
  onClose: () => void;
}

interface OrphanedSession {
  sessionId: string;
  repoPath: string;
  sessionData: {
    task?: string;
    branchName?: string;
    agentType?: string;
  };
  lastModified: Date;
}

const agentTypes: { value: AgentType; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'copilot', label: 'GitHub Copilot' },
  { value: 'cline', label: 'Cline' },
  { value: 'aider', label: 'Aider' },
  { value: 'warp', label: 'Warp' },
  { value: 'custom', label: 'Custom' },
];

type Tab = 'general' | 'credentials' | 'maintenance' | 'debug';

export function SettingsModal({ onClose }: SettingsModalProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Maintenance state
  const [orphanedSessions, setOrphanedSessions] = useState<OrphanedSession[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  // Debug log state
  const [logStats, setLogStats] = useState<{ memoryEntries: number; fileSize: number; rotatedFiles: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  // Load settings
  useEffect(() => {
    window.api.config.getAll().then((result) => {
      if (result.success && result.data) {
        setConfig(result.data);
      }
    });

    window.api.credential.has('groqApiKey').then((result) => {
      if (result.success) {
        setHasGroqKey(result.data ?? false);
      }
    });
  }, []);

  const handleSaveGeneral = async () => {
    if (!config) return;
    setIsSaving(true);
    setMessage(null);

    try {
      await window.api.config.set('theme', config.theme);
      await window.api.config.set('defaultAgentType', config.defaultAgentType);
      await window.api.config.set('autoWatch', config.autoWatch);
      await window.api.config.set('autoPush', config.autoPush);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!groqApiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const result = await window.api.credential.set('groqApiKey', groqApiKey.trim());
      if (result.success) {
        setHasGroqKey(true);
        setGroqApiKey('');
        setMessage({ type: 'success', text: 'API key saved successfully' });
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Failed to save API key' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setIsSaving(false);
    }
  };

  // Maintenance handlers
  const handleScanOrphaned = async () => {
    setIsScanning(true);
    setMessage(null);
    try {
      const result = await window.api.recovery?.scanAll?.();
      if (result?.success && result.data) {
        setOrphanedSessions(result.data);
        setMessage({
          type: 'success',
          text: `Found ${result.data.length} orphaned session(s)`,
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to scan for orphaned sessions' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Scan failed' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleRecoverSession = async (sessionId: string, repoPath: string) => {
    setIsRecovering(true);
    setMessage(null);
    try {
      const result = await window.api.recovery?.recoverSession?.(sessionId, repoPath);
      if (result?.success) {
        setOrphanedSessions(prev => prev.filter(s => s.sessionId !== sessionId));
        setMessage({ type: 'success', text: 'Session recovered successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to recover session' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Recovery failed' });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDeleteOrphaned = async (sessionId: string, repoPath: string) => {
    try {
      const result = await window.api.recovery?.deleteOrphaned?.(sessionId, repoPath);
      if (result?.success) {
        setOrphanedSessions(prev => prev.filter(s => s.sessionId !== sessionId));
        setMessage({ type: 'success', text: 'Orphaned session deleted' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  const handleQuickCleanup = async () => {
    if (!selectedRepo) {
      setMessage({ type: 'error', text: 'Please select a repository first' });
      return;
    }
    setIsCleaning(true);
    setMessage(null);
    try {
      const result = await window.api.cleanup?.quick?.(selectedRepo);
      if (result?.success) {
        setMessage({
          type: 'success',
          text: `Cleanup complete: pruned worktrees, removed ${result.data?.kanvasCleanup?.removedSessionFiles || 0} stale files`,
        });
      } else {
        setMessage({ type: 'error', text: 'Cleanup failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Cleanup failed' });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSelectRepo = async () => {
    const result = await window.api.dialog.openDirectory();
    if (result.success && result.data) {
      setSelectedRepo(result.data);
    }
  };

  const handleClearAllSessions = async () => {
    if (!confirm('Are you sure you want to clear all sessions? This cannot be undone.')) {
      return;
    }
    setIsClearing(true);
    setMessage(null);
    try {
      const result = await window.api.instance?.clearAll?.();
      if (result?.success) {
        setMessage({
          type: 'success',
          text: `Cleared ${result.data?.count || 0} session(s)`,
        });
        // Force reload the page to reset all state
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage({ type: 'error', text: 'Failed to clear sessions' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to clear sessions' });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-secondary border border-border rounded-lg w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-gray-100">Settings</h2>
          <button onClick={onClose} className="btn-icon">
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

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-accent border-b-2 border-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'credentials'
                ? 'text-accent border-b-2 border-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Credentials
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'maintenance'
                ? 'text-accent border-b-2 border-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Maintenance
          </button>
          <button
            onClick={() => {
              setActiveTab('debug');
              // Load log stats when switching to debug tab
              window.api.debugLog?.getStats?.().then((result) => {
                if (result?.success && result.data) {
                  setLogStats(result.data);
                }
              });
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'debug'
                ? 'text-accent border-b-2 border-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Debug
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {activeTab === 'general' && config && (
            <>
              {/* Theme */}
              <div>
                <label className="label">Theme</label>
                <select
                  value={config.theme}
                  onChange={(e) => setConfig({ ...config, theme: e.target.value as AppConfig['theme'] })}
                  className="select"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>

              {/* Default agent */}
              <div>
                <label className="label">Default Agent Type</label>
                <select
                  value={config.defaultAgentType}
                  onChange={(e) => setConfig({ ...config, defaultAgentType: e.target.value as AgentType })}
                  className="select"
                >
                  {agentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto watch */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoWatch}
                    onChange={(e) => setConfig({ ...config, autoWatch: e.target.checked })}
                    className="w-4 h-4 rounded border-border bg-surface-tertiary"
                  />
                  <span className="text-gray-300">Auto-start file watcher</span>
                </label>
              </div>

              {/* Auto push */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoPush}
                    onChange={(e) => setConfig({ ...config, autoPush: e.target.checked })}
                    className="w-4 h-4 rounded border-border bg-surface-tertiary"
                  />
                  <span className="text-gray-300">Auto-push after commits</span>
                </label>
              </div>

              <button
                onClick={handleSaveGeneral}
                className="btn-primary w-full"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </>
          )}

          {activeTab === 'credentials' && (
            <>
              {/* Groq API Key */}
              <div>
                <label className="label">Groq API Key</label>
                {hasGroqKey ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value="••••••••••••••••"
                      disabled
                      className="input flex-1"
                    />
                    <span className="badge badge-success">Configured</span>
                  </div>
                ) : (
                  <input
                    type="password"
                    value={groqApiKey}
                    onChange={(e) => setGroqApiKey(e.target.value)}
                    placeholder="gsk_..."
                    className="input"
                  />
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key at{' '}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    console.groq.com
                  </a>
                </p>
              </div>

              {!hasGroqKey && (
                <button
                  onClick={handleSaveCredentials}
                  className="btn-primary w-full"
                  disabled={isSaving || !groqApiKey.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save API Key'}
                </button>
              )}

              {hasGroqKey && (
                <button
                  onClick={() => {
                    setHasGroqKey(false);
                    setGroqApiKey('');
                  }}
                  className="btn-secondary w-full"
                >
                  Update API Key
                </button>
              )}
            </>
          )}

          {activeTab === 'maintenance' && (
            <>
              {/* Session Recovery */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-200">Session Recovery</h3>
                <p className="text-xs text-gray-400">
                  Scan for orphaned sessions in your repositories that can be recovered.
                </p>
                <button
                  onClick={handleScanOrphaned}
                  disabled={isScanning}
                  className="btn-secondary w-full"
                >
                  {isScanning ? 'Scanning...' : 'Scan for Orphaned Sessions'}
                </button>

                {orphanedSessions.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {orphanedSessions.map((session) => (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between p-2 bg-surface-tertiary rounded-lg text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-gray-200 truncate">
                            {session.sessionData.task || session.sessionData.branchName || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {session.repoPath.split('/').pop()}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleRecoverSession(session.sessionId, session.repoPath)}
                            disabled={isRecovering}
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                          >
                            Recover
                          </button>
                          <button
                            onClick={() => handleDeleteOrphaned(session.sessionId, session.repoPath)}
                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border my-4" />

              {/* Clear All Sessions */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-200">Clear All Sessions</h3>
                <p className="text-xs text-gray-400">
                  Remove all sessions from Kanvas. This clears the session list but does not delete files from repositories.
                </p>
                <button
                  onClick={handleClearAllSessions}
                  disabled={isClearing}
                  className="w-full py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isClearing ? 'Clearing...' : 'Clear All Sessions'}
                </button>
              </div>

              <div className="border-t border-border my-4" />

              {/* Repo Cleanup */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-200">Repository Cleanup</h3>
                <p className="text-xs text-gray-400">
                  Clean up stale worktrees, branches, and Kanvas files.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedRepo}
                    placeholder="Select a repository..."
                    readOnly
                    className="input flex-1 text-sm"
                  />
                  <button onClick={handleSelectRepo} className="btn-secondary px-3">
                    Browse
                  </button>
                </div>

                <button
                  onClick={handleQuickCleanup}
                  disabled={isCleaning || !selectedRepo}
                  className="btn-primary w-full"
                >
                  {isCleaning ? 'Cleaning...' : 'Quick Cleanup'}
                </button>

                <p className="text-xs text-gray-500">
                  Quick cleanup will prune stale worktrees and remove old session files.
                </p>
              </div>
            </>
          )}

          {activeTab === 'debug' && (
            <>
              {/* Log Statistics */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-200">Debug Logs</h3>
                <p className="text-xs text-gray-400">
                  Export debug logs to share with support or diagnose issues.
                </p>

                {logStats && (
                  <div className="bg-surface-tertiary rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-300">
                      <span>In-memory entries:</span>
                      <span className="font-mono">{logStats.memoryEntries}</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Log file size:</span>
                      <span className="font-mono">{(logStats.fileSize / 1024).toFixed(1)} KB</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Rotated files:</span>
                      <span className="font-mono">{logStats.rotatedFiles}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setIsExporting(true);
                      setMessage(null);
                      try {
                        const result = await window.api.debugLog?.export?.();
                        if (result?.success && result.data) {
                          // Create and download JSON file
                          const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `kanvas-debug-log-${new Date().toISOString().split('T')[0]}.json`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          setMessage({ type: 'success', text: `Exported ${result.data.entries.length} log entries` });
                        } else {
                          setMessage({ type: 'error', text: 'Failed to export logs' });
                        }
                      } catch {
                        setMessage({ type: 'error', text: 'Export failed' });
                      } finally {
                        setIsExporting(false);
                      }
                    }}
                    disabled={isExporting}
                    className="btn-primary flex-1"
                  >
                    {isExporting ? 'Exporting...' : 'Export Logs'}
                  </button>

                  <button
                    onClick={() => {
                      window.api.debugLog?.openFolder?.();
                    }}
                    className="btn-secondary px-4"
                    title="Open log folder"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="border-t border-border my-4" />

              {/* Clear Logs */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-200">Clear Logs</h3>
                <p className="text-xs text-gray-400">
                  Remove all debug logs from memory and disk.
                </p>
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to clear all debug logs?')) return;
                    setIsClearingLogs(true);
                    setMessage(null);
                    try {
                      const result = await window.api.debugLog?.clear?.();
                      if (result?.success) {
                        setLogStats({ memoryEntries: 0, fileSize: 0, rotatedFiles: 0 });
                        setMessage({ type: 'success', text: 'Debug logs cleared' });
                      } else {
                        setMessage({ type: 'error', text: 'Failed to clear logs' });
                      }
                    } catch {
                      setMessage({ type: 'error', text: 'Clear failed' });
                    } finally {
                      setIsClearingLogs(false);
                    }
                  }}
                  disabled={isClearingLogs}
                  className="btn-secondary w-full"
                >
                  {isClearingLogs ? 'Clearing...' : 'Clear All Logs'}
                </button>
              </div>
            </>
          )}

          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
