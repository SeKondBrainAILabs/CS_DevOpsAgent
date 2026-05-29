/**
 * MainLayout Component
 * Main application layout with sidebar and content area
 */

import React, { ReactNode, useState, useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';

interface MainLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  statusBar?: ReactNode;
}

interface OrphanedSession {
  sessionId: string;
  repoPath: string;
  sessionData: { task?: string; branchName?: string; agentType?: string };
  lastModified: Date;
}

export function MainLayout({
  sidebar,
  children,
  statusBar,
}: MainLayoutProps): React.ReactElement {
  const { sidebarCollapsed, sidebarWidth } = useUIStore();
  const [orphanedSessions, setOrphanedSessions] = useState<OrphanedSession[]>([]);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Listen for orphaned sessions from main process
  useEffect(() => {
    const unsubscribe = window.api?.recovery?.onOrphanedSessionsFound?.((sessions) => {
      setOrphanedSessions(sessions);
      setShowRecoveryBanner(sessions.length > 0);
    });

    return () => unsubscribe?.();
  }, []);

  const handleRecoverAll = async () => {
    setIsRecovering(true);
    try {
      const sessionsToRecover = orphanedSessions.map(s => ({
        sessionId: s.sessionId,
        repoPath: s.repoPath,
      }));
      const result = await window.api?.recovery?.recoverMultiple?.(sessionsToRecover);
      if (result?.success) {
        setShowRecoveryBanner(false);
        setOrphanedSessions([]);
      }
    } catch (error) {
      console.error('Recovery failed:', error);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDismiss = () => {
    setShowRecoveryBanner(false);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" data-density="cozy">
      {/* Recovery Banner */}
      {showRecoveryBanner && orphanedSessions.length > 0 && (
        <div className="border-b px-4 py-2" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.20)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-amber-500">⚠️</span>
              <div>
                <span className="text-sm font-medium text-text-primary">
                  Found {orphanedSessions.length} session{orphanedSessions.length > 1 ? 's' : ''} from a previous run
                </span>
                <span className="text-xs text-text-secondary ml-2">
                  These sessions may have work in progress
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRecoverAll}
                disabled={isRecovering}
                className="btn-primary"
                style={{ height: 30, fontSize: 12 }}
              >
                {isRecovering ? 'Recovering...' : 'Recover All'}
              </button>
              <button
                onClick={handleDismiss}
                className="kb-btn"
                style={{ height: 30, fontSize: 12 }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <aside
            className="flex-shrink-0 border-r border-[rgba(0,0,0,0.10)] overflow-y-auto bg-surface-secondary"
            style={{ width: sidebarWidth }}
          >
            {sidebar}
          </aside>
        )}

        {/* Main content — paper bg */}
        <main className="flex-1 min-h-0 overflow-hidden bg-surface-secondary flex flex-col">{children}</main>
      </div>

      {/* Status bar */}
      {statusBar && (
        <footer className="h-7 bg-white border-t border-[rgba(0,0,0,0.10)] px-3 flex items-center text-xs">
          {statusBar}
        </footer>
      )}
    </div>
  );
}
