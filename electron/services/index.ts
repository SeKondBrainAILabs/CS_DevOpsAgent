/**
 * Service Initialization and Export
 * Creates and manages all main process services
 */

import { BrowserWindow } from 'electron';
import { SessionService } from './SessionService';
import { GitService } from './GitService';
import { WatcherService } from './WatcherService';
import { LockService } from './LockService';
import { ConfigService } from './ConfigService';
import { AIService } from './AIService';
import { ActivityService } from './ActivityService';
import { AgentListenerService } from './AgentListenerService';
import { AgentInstanceService } from './AgentInstanceService';
import { SessionRecoveryService } from './SessionRecoveryService';
import { RepoCleanupService } from './RepoCleanupService';
import { ContractDetectionService } from './ContractDetectionService';
import { RebaseWatcherService } from './RebaseWatcherService';

export interface Services {
  session: SessionService;
  git: GitService;
  watcher: WatcherService;
  lock: LockService;
  config: ConfigService;
  ai: AIService;
  activity: ActivityService;
  agentListener: AgentListenerService;
  agentInstance: AgentInstanceService;
  sessionRecovery: SessionRecoveryService;
  repoCleanup: RepoCleanupService;
  contractDetection: ContractDetectionService;
  rebaseWatcher: RebaseWatcherService;
}

let services: Services | null = null;

/**
 * Initialize all services with the main window reference
 */
export async function initializeServices(mainWindow: BrowserWindow): Promise<Services> {
  // Initialize config service first (other services may depend on it)
  const config = new ConfigService();
  await config.initialize();

  // Initialize activity service (used by other services for logging)
  const activity = new ActivityService();
  activity.setMainWindow(mainWindow);

  // Initialize core services
  const git = new GitService();
  git.setMainWindow(mainWindow);

  const lock = new LockService();
  lock.setMainWindow(mainWindow);

  const watcher = new WatcherService(git, activity);
  watcher.setMainWindow(mainWindow);

  const session = new SessionService(git, watcher, lock, activity);
  session.setMainWindow(mainWindow);

  // Initialize AI service with credentials from config
  const ai = new AIService(config);
  ai.setMainWindow(mainWindow);

  // Initialize Agent Listener service
  // Kanvas monitors agents that report into it (dashboard pattern)
  const agentListener = new AgentListenerService();

  // Initialize Agent Instance service
  // For creating new agent instances from Kanvas dashboard
  const agentInstance = new AgentInstanceService();

  // Initialize Session Recovery service
  // For recovering orphaned sessions from repository .kanvas directories
  const sessionRecovery = new SessionRecoveryService();

  // Initialize Repo Cleanup service
  // For cleaning up worktrees, branches, and Kanvas files
  const repoCleanup = new RepoCleanupService();

  // Initialize Contract Detection service
  // For detecting contract changes in commits (API specs, schemas, interfaces)
  const contractDetection = new ContractDetectionService();

  // Initialize Rebase Watcher service
  // For auto-rebasing when remote changes are detected (on-demand mode)
  const rebaseWatcher = new RebaseWatcherService(git);
  rebaseWatcher.setMainWindow(mainWindow);

  services = {
    session,
    git,
    watcher,
    lock,
    config,
    ai,
    activity,
    agentListener,
    agentInstance,
    sessionRecovery,
    repoCleanup,
    contractDetection,
    rebaseWatcher,
  };

  return services;
}

/**
 * Dispose all services (cleanup on app quit)
 */
export async function disposeServices(): Promise<void> {
  if (!services) return;

  // Stop all watchers
  await services.watcher.dispose();

  // Release all locks
  await services.lock.dispose();

  // Cleanup AI streams
  services.ai.dispose();

  // Cleanup agent listener
  await services.agentListener.destroy();

  // Cleanup rebase watcher
  await services.rebaseWatcher.dispose();

  services = null;
}

// Re-export service classes
export { SessionService } from './SessionService';
export { GitService } from './GitService';
export { WatcherService } from './WatcherService';
export { LockService } from './LockService';
export { ConfigService } from './ConfigService';
export { AIService } from './AIService';
export { ActivityService } from './ActivityService';
export { AgentListenerService } from './AgentListenerService';
export { AgentInstanceService } from './AgentInstanceService';
export { SessionRecoveryService } from './SessionRecoveryService';
export { RepoCleanupService } from './RepoCleanupService';
export { ContractDetectionService } from './ContractDetectionService';
export { RebaseWatcherService } from './RebaseWatcherService';
