/**
 * SessionDetailView Component
 * Shows detailed view of a selected session including prompt, activity, files, and contracts
 */

import React, { useState, useEffect } from 'react';
import type { SessionReport } from '../../../shared/agent-protocol';
import type { AgentInstance, ContractType, Contract } from '../../../shared/types';
import { useAgentStore } from '../../store/agentStore';

type DetailTab = 'prompt' | 'activity' | 'files' | 'contracts';

interface SessionDetailViewProps {
  session: SessionReport;
  onBack: () => void;
  onDelete?: (sessionId: string) => void;
  onRestart?: (sessionId: string) => void;
}

export function SessionDetailView({ session, onBack, onDelete, onRestart }: SessionDetailViewProps): React.ReactElement {
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('prompt');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load instance data to get the prompt
  useEffect(() => {
    async function loadInstance() {
      if (window.api?.instance?.list) {
        const result = await window.api.instance.list();
        if (result.success && result.data) {
          // Find instance matching this session
          const found = result.data.find(inst => inst.sessionId === session.sessionId);
          setInstance(found || null);
        }
      }
    }
    loadInstance();
  }, [session.sessionId]);

  const handleCopyPrompt = async () => {
    const textToCopy = instance?.prompt || generateDefaultPrompt(session);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyInstructions = async () => {
    const textToCopy = instance?.instructions || '';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete?.(session.sessionId);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      // Auto-hide confirm after 3 seconds
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  const handleRestart = () => {
    onRestart?.(session.sessionId);
  };

  const statusColors = {
    active: 'text-green-500',
    idle: 'text-yellow-500',
    error: 'text-red-500',
    completed: 'text-gray-400',
  };

  const repoName = session.repoPath?.split('/').pop() || 'Unknown';

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-surface-secondary transition-colors"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-text-primary">
              {session.task || session.branchName || 'Session Details'}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
              <span className={statusColors[session.status] || 'text-gray-400'}>
                {session.status}
              </span>
              <span>{repoName}</span>
              <span className="font-mono text-xs">{session.branchName}</span>
            </div>
          </div>

          {/* Session Actions */}
          <div className="flex items-center gap-2">
            {onRestart && (
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                  bg-surface-secondary text-text-primary hover:bg-surface-tertiary transition-colors"
                title="Restart session"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restart
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${showDeleteConfirm
                    ? 'bg-red-500 text-white'
                    : 'bg-surface-secondary text-text-secondary hover:text-red-500 hover:bg-red-50'
                  }`}
                title={showDeleteConfirm ? 'Click again to confirm' : 'Delete session'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {showDeleteConfirm ? 'Confirm?' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['prompt', 'activity', 'files', 'contracts'] as DetailTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab
                  ? 'bg-kanvas-blue text-white'
                  : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'prompt' && (
          <PromptTab
            session={session}
            instance={instance}
            onCopyPrompt={handleCopyPrompt}
            onCopyInstructions={handleCopyInstructions}
            copySuccess={copySuccess}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityTab sessionId={session.sessionId} />
        )}
        {activeTab === 'files' && (
          <FilesTab session={session} />
        )}
        {activeTab === 'contracts' && (
          <ContractsTab session={session} />
        )}
      </div>
    </div>
  );
}

interface PromptTabProps {
  session: SessionReport;
  instance: AgentInstance | null;
  onCopyPrompt: () => void;
  onCopyInstructions: () => void;
  copySuccess: boolean;
}

function PromptTab({
  session,
  instance,
  onCopyPrompt,
  onCopyInstructions,
  copySuccess
}: PromptTabProps): React.ReactElement {
  const prompt = instance?.prompt || generateDefaultPrompt(session);

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      {/* Copy buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onCopyPrompt}
          className="flex items-center gap-2 px-4 py-2 bg-kanvas-blue text-white rounded-lg
            hover:bg-kanvas-blue/90 transition-colors"
        >
          {copySuccess ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Prompt
            </>
          )}
        </button>
        {instance?.instructions && (
          <button
            onClick={onCopyInstructions}
            className="flex items-center gap-2 px-4 py-2 bg-surface-secondary text-text-primary rounded-lg
              hover:bg-surface-tertiary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Copy Full Instructions
          </button>
        )}
      </div>

      {/* Session info cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <InfoCard label="Repository" value={session.repoPath || 'Unknown'} mono />
        <InfoCard label="Branch" value={session.branchName} mono />
        <InfoCard label="Session ID" value={session.sessionId.slice(0, 16) + '...'} mono />
        <InfoCard label="Commits" value={String(session.commitCount || 0)} />
      </div>

      {/* Prompt display */}
      <div className="flex-1 min-h-0">
        <h3 className="text-sm font-medium text-text-secondary mb-2">Prompt for Agent</h3>
        <div className="h-full bg-surface-secondary rounded-xl border border-border overflow-auto">
          <pre className="p-4 text-sm text-text-primary whitespace-pre-wrap font-mono">
            {prompt}
          </pre>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }): React.ReactElement {
  return (
    <div className="p-3 bg-surface-secondary rounded-lg border border-border">
      <div className="text-xs text-text-secondary mb-1">{label}</div>
      <div className={`text-sm text-text-primary truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * ActivityTab - Shows activity log for this session
 */
function ActivityTab({ sessionId }: { sessionId: string }): React.ReactElement {
  const recentActivity = useAgentStore((state) => state.recentActivity);

  // Filter activity for this session
  const sessionActivity = recentActivity.filter(a => a.sessionId === sessionId);

  if (sessionActivity.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
            <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">No Activity Yet</h3>
          <p className="text-sm text-text-secondary max-w-xs">
            Activity will appear here as the agent reports progress.
          </p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const logTypeStyles: Record<string, { color: string; bg: string }> = {
    success: { color: 'text-green-600', bg: 'bg-green-50' },
    error: { color: 'text-red-600', bg: 'bg-red-50' },
    warning: { color: 'text-yellow-600', bg: 'bg-yellow-50' },
    info: { color: 'text-kanvas-blue', bg: 'bg-kanvas-blue/5' },
    commit: { color: 'text-purple-600', bg: 'bg-purple-50' },
    file: { color: 'text-text-secondary', bg: 'bg-surface-tertiary' },
    git: { color: 'text-orange-600', bg: 'bg-orange-50' },
  };

  return (
    <div className="h-full overflow-auto">
      <div className="divide-y divide-border">
        {sessionActivity.map((entry, index) => {
          const style = logTypeStyles[entry.type] || logTypeStyles.info;
          return (
            <div
              key={`${entry.timestamp}-${index}`}
              className="px-4 py-3 hover:bg-surface-secondary transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full ${style.bg} flex items-center justify-center mt-0.5`}>
                  <span className={`text-xs font-bold ${style.color}`}>
                    {entry.type.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary break-words">{entry.message}</p>
                  <span className="text-xs text-text-secondary">{formatTime(entry.timestamp)}</span>
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <div className="mt-2 p-2 rounded-lg bg-surface-tertiary">
                      <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * FilesTab - Shows files changed in this session
 */
function FilesTab({ session }: { session: SessionReport }): React.ReactElement {
  const [files, setFiles] = useState<Array<{ path: string; status: string; additions: number; deletions: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load actual file changes from git diff
    // For now, show placeholder
    setLoading(false);
    setFiles([]);
  }, [session.sessionId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-kanvas-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
            <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">No File Changes Yet</h3>
          <p className="text-sm text-text-secondary max-w-xs">
            File changes will appear here once the agent starts making modifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.path} className="p-3 bg-surface-secondary rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <FileStatusIcon status={file.status} />
              <span className="flex-1 font-mono text-sm text-text-primary truncate">{file.path}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-500">+{file.additions}</span>
                <span className="text-red-500">-{file.deletions}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileStatusIcon({ status }: { status: string }): React.ReactElement {
  const colors: Record<string, string> = {
    added: 'text-green-500',
    modified: 'text-yellow-500',
    deleted: 'text-red-500',
    renamed: 'text-blue-500',
  };

  return (
    <span className={`text-xs font-medium ${colors[status] || 'text-text-secondary'}`}>
      {status.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * ContractsTab - Shows contracts from House_Rules_Contracts/ directory
 * Matches the existing contract structure in the repo
 */
function ContractsTab({ session }: { session: SessionReport }): React.ReactElement {
  const [activeContractType, setActiveContractType] = useState<ContractType | 'all'>('all');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractChanges, setContractChanges] = useState<Array<{ file: string; type: string; changeType: string; impactLevel: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Contract categories matching House_Rules_Contracts/
  const contractTypes: { type: ContractType | 'all'; label: string; icon: string; file?: string }[] = [
    { type: 'all', label: 'All', icon: '📋' },
    { type: 'api', label: 'API', icon: '🔌', file: 'API_CONTRACT.md' },
    { type: 'schema', label: 'Schema', icon: '📐', file: 'DATABASE_SCHEMA_CONTRACT.md' },
    { type: 'events', label: 'Events', icon: '⚡', file: 'EVENTS_CONTRACT.md' },
    { type: 'css', label: 'CSS', icon: '🎨' },
    { type: 'features', label: 'Features', icon: '✨', file: 'FEATURES_CONTRACT.md' },
    { type: 'infra', label: 'Infra', icon: '🏗️', file: 'INFRA_CONTRACT.md' },
    { type: 'integrations', label: '3rd Party', icon: '🔗', file: 'THIRD_PARTY_INTEGRATIONS.md' },
  ];

  useEffect(() => {
    async function loadContracts() {
      setLoading(true);
      try {
        // Try to get contract changes for this session
        if (window.api?.contracts?.analyzeCommit && session.repoPath) {
          const result = await window.api.contracts.analyzeCommit(session.repoPath);
          if (result.success && result.data?.changes) {
            setContractChanges(result.data.changes);
          }
        }

        // Load contract files from House_Rules_Contracts/
        // For now, create placeholder entries based on known contract files
        const repoPath = session.repoPath || session.worktreePath;
        const knownContracts: Contract[] = [
          {
            id: 'api-contract',
            type: 'api',
            name: 'API Contract',
            description: 'REST/GraphQL API endpoints and authentication',
            filePath: `${repoPath}/House_Rules_Contracts/API_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'schema-contract',
            type: 'schema',
            name: 'Database Schema Contract',
            description: 'Database tables, migrations, and data models',
            filePath: `${repoPath}/House_Rules_Contracts/DATABASE_SCHEMA_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'events-contract',
            type: 'events',
            name: 'Events Contract (Feature Bus)',
            description: 'Domain events for cross-service communication',
            filePath: `${repoPath}/House_Rules_Contracts/EVENTS_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'features-contract',
            type: 'features',
            name: 'Features Contract',
            description: 'Feature flags and toggles',
            filePath: `${repoPath}/House_Rules_Contracts/FEATURES_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'infra-contract',
            type: 'infra',
            name: 'Infrastructure Contract',
            description: 'Deployment, services, and infrastructure',
            filePath: `${repoPath}/House_Rules_Contracts/INFRA_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'integrations-contract',
            type: 'integrations',
            name: 'Third-Party Integrations',
            description: 'External service integrations and SDKs',
            filePath: `${repoPath}/House_Rules_Contracts/THIRD_PARTY_INTEGRATIONS.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
        ];

        setContracts(knownContracts);
      } catch (error) {
        console.error('Failed to load contracts:', error);
      } finally {
        setLoading(false);
      }
    }
    loadContracts();
  }, [session.sessionId, session.repoPath, session.worktreePath]);

  const filteredContracts = activeContractType === 'all'
    ? contracts
    : contracts.filter(c => c.type === activeContractType);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-kanvas-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Contract Type Filter Tabs */}
      <div className="p-4 border-b border-border bg-surface">
        <div className="flex gap-2 flex-wrap">
          {contractTypes.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => setActiveContractType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5
                ${activeContractType === type
                  ? 'bg-kanvas-blue text-white'
                  : 'bg-surface-secondary text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
                }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
              {type !== 'all' && (
                <span className="text-xs opacity-70">
                  ({contracts.filter(c => c.type === type).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contract Changes Alert */}
      {contractChanges.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex items-start gap-2">
            <span className="text-yellow-600">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {contractChanges.length} contract file(s) changed
              </p>
              <p className="text-xs text-yellow-700 mt-0.5">
                {contractChanges.filter(c => c.impactLevel === 'breaking').length} potentially breaking changes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contracts List */}
      <div className="flex-1 overflow-auto p-4">
        {filteredContracts.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
                <span className="text-3xl">📋</span>
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Contracts Found</h3>
              <p className="text-sm text-text-secondary max-w-xs">
                Create a <code className="text-kanvas-blue">House_Rules_Contracts/</code> directory to track contracts.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ContractCard - Individual contract display matching House_Rules_Contracts format
 */
function ContractCard({ contract }: { contract: Contract }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    modified: 'bg-yellow-100 text-yellow-700',
    deprecated: 'bg-gray-100 text-gray-600',
    breaking: 'bg-red-100 text-red-700',
    beta: 'bg-blue-100 text-blue-700',
  };

  const typeIcons: Record<string, string> = {
    api: '🔌',
    schema: '📐',
    events: '⚡',
    css: '🎨',
    features: '✨',
    infra: '🏗️',
    integrations: '🔗',
  };

  const typeLabels: Record<string, string> = {
    api: 'API Contract',
    schema: 'Schema',
    events: 'Feature Bus',
    css: 'CSS/Design',
    features: 'Feature Flags',
    infra: 'Infrastructure',
    integrations: '3rd Party',
  };

  const handleOpenFile = async () => {
    // Try to open the contract file
    console.log('Open contract file:', contract.filePath);
    // Could add shell.openPath or similar here
  };

  return (
    <div
      className={`
        bg-surface rounded-xl border transition-all cursor-pointer
        ${expanded ? 'border-kanvas-blue shadow-kanvas' : 'border-border hover:border-kanvas-blue/30 hover:shadow-card-hover'}
      `}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center flex-shrink-0">
            <span className="text-xl">{typeIcons[contract.type]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-text-primary truncate">{contract.name}</h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[contract.status]}`}>
                {contract.status}
              </span>
              {contract.breaking && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  ⚠️ Breaking
                </span>
              )}
            </div>
            {contract.description && (
              <p className="text-sm text-text-secondary">{contract.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">v{contract.version}</span>
            <svg
              className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {/* File path */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">File:</span>
            <code className="text-xs text-kanvas-blue bg-surface-secondary px-2 py-0.5 rounded truncate flex-1">
              {contract.filePath.split('/').slice(-2).join('/')}
            </code>
            <button
              onClick={(e) => { e.stopPropagation(); handleOpenFile(); }}
              className="text-xs text-kanvas-blue hover:underline"
            >
              Open
            </button>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text-secondary">Type:</span>
              <span className="ml-2 text-text-primary">{typeLabels[contract.type]}</span>
            </div>
            <div>
              <span className="text-text-secondary">Last Updated:</span>
              <span className="ml-2 text-text-primary">
                {new Date(contract.lastUpdated).toLocaleDateString()}
              </span>
            </div>
            {contract.modifiedBy && (
              <div className="col-span-2">
                <span className="text-text-secondary">Modified By:</span>
                <span className="ml-2 text-text-primary">{contract.modifiedBy}</span>
              </div>
            )}
          </div>

          {/* Changelog preview */}
          {contract.changeLog && contract.changeLog.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-text-secondary mb-1">Recent Changes:</p>
              <div className="bg-surface-secondary rounded-lg p-2 text-xs">
                {contract.changeLog.slice(0, 2).map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-text-secondary">{entry.date}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      entry.impact === 'breaking' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {entry.impact}
                    </span>
                    <span className="text-text-primary truncate">{entry.changes}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function generateDefaultPrompt(session: SessionReport): string {
  const shortSessionId = session.sessionId.replace('sess_', '').slice(0, 8);
  const timestamp = new Date().toISOString();
  const task = session.task || session.branchName || 'development';

  return `I'm working in a DevOps-managed session with the following setup:
- Session ID: ${shortSessionId}
- Working Directory: ${session.repoPath || session.worktreePath}
- Task: ${task}

Please switch to this directory before making any changes:
cd "${session.repoPath || session.worktreePath}"

IMPORTANT - READ PROJECT RULES FIRST:
Before making ANY changes, you MUST read the project's house rules at:
${session.repoPath}/houserules.md

The house rules file contains:
- Project coding conventions and standards
- Required commit message formats
- File coordination protocols
- Branch naming and workflow rules
- Testing and review requirements

You must follow ALL rules in this file. Read it carefully before proceeding.

FILE COORDINATION (MANDATORY):
Shared coordination directory: ${session.repoPath}/.file-coordination/

BEFORE editing ANY files:
1. Check for conflicts: ls ${session.repoPath}/.file-coordination/active-edits/
2. Create declaration: ${session.repoPath}/.file-coordination/active-edits/<agent>-${shortSessionId}.json

Example declaration:
{
  "agent": "${session.agentType}", "session": "${shortSessionId}",
  "files": ["src/app.js"], "operation": "edit",
  "reason": "${task}", "declaredAt": "${timestamp}",
  "estimatedDuration": 300
}

Write commit messages to: .devops-commit-${shortSessionId}.msg
(Use '>>' to append if you want to add to an existing message)
The DevOps agent will automatically commit and push changes.

IMPORTANT: STOP HERE AND WAIT
Do NOT start coding or making changes yet!
Follow the steps above in order when instructed by the user.
Wait for further instructions before proceeding.`;
}
