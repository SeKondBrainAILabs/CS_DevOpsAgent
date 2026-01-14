/**
 * CreateAgentWizard Component
 * Conversational wizard for creating new agent instances
 */

import React, { useState } from 'react';
import { RepoSelector } from './RepoSelector';
import { AgentTypeSelector } from './AgentTypeSelector';
import { InstructionsModal } from './InstructionsModal';
import { KanvasLogo } from '../ui/KanvasLogo';
import type { AgentType, RepoValidation, AgentInstance, AgentInstanceConfig, RebaseFrequency } from '../../../shared/types';

interface CreateAgentWizardProps {
  onClose: () => void;
}

type WizardStep = 'repo' | 'agent' | 'workflow' | 'prompt' | 'complete';

interface AgentSettings {
  branchName: string;
  baseBranch: string;
  rebaseFrequency: RebaseFrequency;
  autoCommit: boolean;
  systemPrompt: string;
  contextPreservation: string;
}

const DEFAULT_SYSTEM_PROMPT = `Follow existing code style and patterns
Write clean, maintainable code
Add tests for new functionality
Use clear, descriptive commit messages
Ask before making major architectural changes`;

const DEFAULT_CONTEXT_PRESERVATION = `SESSION_ID: [will be filled automatically]
WORKTREE: [will be filled automatically]
BRANCH: [will be filled automatically]
TASK: [describe the task]

Key things to remember after context compaction:
- Always re-read houserules.md after compaction
- Check .file-coordination/active-edits/ for file claims
- Write commits to .devops-commit-<session>.msg`;

export function CreateAgentWizard({ onClose }: CreateAgentWizardProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState<WizardStep>('repo');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [repoValidation, setRepoValidation] = useState<RepoValidation | null>(null);
  const [agentType, setAgentType] = useState<AgentType | null>(null);
  const [settings, setSettings] = useState<AgentSettings>({
    branchName: '',
    baseBranch: 'main',
    rebaseFrequency: 'on-demand',
    autoCommit: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    contextPreservation: DEFAULT_CONTEXT_PRESERVATION,
  });

  // Result
  const [createdInstance, setCreatedInstance] = useState<AgentInstance | null>(null);

  const handleRepoSelect = (path: string, validation: RepoValidation) => {
    setRepoPath(path);
    setRepoValidation(validation);
    setError(null);
    if (validation.currentBranch) {
      setSettings(s => ({ ...s, baseBranch: validation.currentBranch || 'main' }));
    }
    setTimeout(() => setCurrentStep('agent'), 300);
  };

  const handleAgentSelect = (type: AgentType) => {
    setAgentType(type);
    setError(null);
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setSettings(s => ({ ...s, branchName: `${type}-session-${timestamp}` }));
    setTimeout(() => setCurrentStep('workflow'), 300);
  };

  const handleCreate = async () => {
    if (!repoPath || !agentType) {
      setError('Please complete all steps');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const config: AgentInstanceConfig = {
        repoPath,
        agentType,
        taskDescription: settings.branchName || `${agentType} session`,
        branchName: settings.branchName,
        baseBranch: settings.baseBranch,
        useWorktree: false,
        autoCommit: settings.autoCommit,
        commitInterval: 30000,
        rebaseFrequency: settings.rebaseFrequency,
        systemPrompt: settings.systemPrompt,
        contextPreservation: settings.contextPreservation,
      };

      const result = await window.api?.instance?.create(config);

      if (result?.success && result.data) {
        setCreatedInstance(result.data);
        setCurrentStep('complete');
      } else {
        setError(result?.error?.message || 'Failed to create agent instance');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  // Show instructions modal if complete
  if (currentStep === 'complete' && createdInstance) {
    return (
      <InstructionsModal
        instance={createdInstance}
        onClose={onClose}
      />
    );
  }

  const stepNumber = {
    repo: 1,
    agent: 2,
    workflow: 3,
    prompt: 4,
    complete: 5,
  }[currentStep];

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="modal w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KanvasLogo size="lg" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Set Up Agent Session</h2>
              <p className="text-sm text-text-secondary">Step {stepNumber} of 4</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-2 bg-surface-secondary border-b border-border">
          <div className="flex gap-2">
            {['repo', 'agent', 'workflow', 'prompt'].map((step, idx) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  idx < stepNumber ? 'bg-kanvas-blue' : 'bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Repository */}
          {currentStep === 'repo' && (
            <div className="space-y-6">
              <ConversationBubble>
                <p className="text-lg font-medium">Which repository should the agent work on?</p>
                <p className="text-sm text-text-secondary mt-1">
                  Select a Git repository for this coding session.
                </p>
              </ConversationBubble>

              <div className="mt-6">
                <RepoSelector
                  selectedPath={repoPath}
                  onSelect={handleRepoSelect}
                />
              </div>
            </div>
          )}

          {/* Step 2: Agent Type */}
          {currentStep === 'agent' && (
            <div className="space-y-6">
              <CompletedStep>
                {repoValidation?.repoName || 'Repository'} selected
              </CompletedStep>

              <ConversationBubble>
                <p className="text-lg font-medium">What type of AI agent will be working?</p>
                <p className="text-sm text-text-secondary mt-1">
                  Choose the coding assistant you'll be using.
                </p>
              </ConversationBubble>

              <div className="mt-4">
                <AgentTypeSelector
                  selectedType={agentType}
                  onSelect={handleAgentSelect}
                />
              </div>
            </div>
          )}

          {/* Step 3: Git Workflow */}
          {currentStep === 'workflow' && (
            <div className="space-y-6">
              <CompletedStep>
                {agentType?.charAt(0).toUpperCase()}{agentType?.slice(1)} agent for {repoValidation?.repoName}
              </CompletedStep>

              <ConversationBubble>
                <p className="text-lg font-medium">How should the agent manage branches?</p>
                <p className="text-sm text-text-secondary mt-1">
                  Configure the Git workflow for this session.
                </p>
              </ConversationBubble>

              <div className="space-y-4 mt-4">
                {/* Branch Name */}
                <SettingCard
                  title="Working Branch"
                  description="The agent will commit changes to this branch"
                >
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={settings.branchName}
                      onChange={(e) => setSettings(s => ({ ...s, branchName: e.target.value }))}
                      className="input flex-1"
                      placeholder="feature/agent-work"
                    />
                    <select
                      value={settings.baseBranch}
                      onChange={(e) => setSettings(s => ({ ...s, baseBranch: e.target.value }))}
                      className="select w-40"
                    >
                      {(repoValidation?.branches || ['main']).map(branch => (
                        <option key={branch} value={branch}>from {branch}</option>
                      ))}
                    </select>
                  </div>
                </SettingCard>

                {/* Rebase Frequency */}
                <SettingCard
                  title="Rebase Frequency"
                  description="How often should the branch be rebased from the base branch?"
                >
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'never', label: 'Never' },
                      { value: 'on-demand', label: 'On-demand' },
                      { value: 'daily', label: 'Daily' },
                      { value: 'weekly', label: 'Weekly' },
                    ].map(option => (
                      <OptionButton
                        key={option.value}
                        selected={settings.rebaseFrequency === option.value}
                        onClick={() => setSettings(s => ({ ...s, rebaseFrequency: option.value as RebaseFrequency }))}
                      >
                        {option.label}
                      </OptionButton>
                    ))}
                  </div>
                </SettingCard>

                {/* Auto-commit */}
                <SettingCard
                  title="Auto-commit Changes"
                  description="Automatically commit changes as the agent works?"
                >
                  <div className="flex gap-3">
                    <OptionButton
                      selected={settings.autoCommit}
                      onClick={() => setSettings(s => ({ ...s, autoCommit: true }))}
                    >
                      Yes, auto-commit
                    </OptionButton>
                    <OptionButton
                      selected={!settings.autoCommit}
                      onClick={() => setSettings(s => ({ ...s, autoCommit: false }))}
                    >
                      Manual commits only
                    </OptionButton>
                  </div>
                </SettingCard>
              </div>
            </div>
          )}

          {/* Step 4: System Prompt & Context */}
          {currentStep === 'prompt' && (
            <div className="space-y-6">
              <CompletedStep>
                Branch: {settings.branchName} (rebase: {settings.rebaseFrequency})
              </CompletedStep>

              <ConversationBubble>
                <p className="text-lg font-medium">Set up the agent's instructions</p>
                <p className="text-sm text-text-secondary mt-1">
                  Define the system prompt and context preservation rules.
                </p>
              </ConversationBubble>

              <div className="space-y-4 mt-4">
                {/* System Prompt */}
                <SettingCard
                  title="System Prompt"
                  description="Instructions for the coding agent when starting the session"
                >
                  <textarea
                    value={settings.systemPrompt}
                    onChange={(e) => setSettings(s => ({ ...s, systemPrompt: e.target.value }))}
                    className="input w-full h-32 font-mono text-sm resize-y"
                    placeholder="Enter instructions for the agent..."
                  />
                </SettingCard>

                {/* Context Preservation */}
                <SettingCard
                  title="Context Preservation (Memory Block)"
                  description="Information to preserve when context is compacted"
                >
                  <textarea
                    value={settings.contextPreservation}
                    onChange={(e) => setSettings(s => ({ ...s, contextPreservation: e.target.value }))}
                    className="input w-full h-40 font-mono text-sm resize-y"
                    placeholder="SESSION_ID: abc123&#10;WORKTREE: /path/to/repo&#10;..."
                  />
                  <p className="text-xs text-text-secondary mt-2">
                    This will be included in the prompt to help the agent recover context after compaction.
                    House rules are stored in <code className="text-kanvas-blue">houserules.md</code>.
                  </p>
                </SettingCard>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-surface">
          <div>
            {currentStep !== 'repo' && (
              <button
                type="button"
                onClick={() => {
                  const prevStep: Record<WizardStep, WizardStep> = {
                    repo: 'repo',
                    agent: 'repo',
                    workflow: 'agent',
                    prompt: 'workflow',
                    complete: 'prompt',
                  };
                  setCurrentStep(prevStep[currentStep]);
                }}
                className="btn-ghost"
                disabled={isCreating}
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isCreating}
            >
              Cancel
            </button>

            {currentStep === 'workflow' && (
              <button
                type="button"
                onClick={() => setCurrentStep('prompt')}
                className="btn-primary"
                disabled={!settings.branchName}
              >
                Next: Agent Instructions
              </button>
            )}

            {currentStep === 'prompt' && (
              <button
                type="button"
                onClick={handleCreate}
                className="btn-primary"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Session'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Conversation bubble
 */
function ConversationBubble({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="animate-fade-in">
      <div className="p-4 rounded-2xl rounded-tl-md bg-surface-secondary text-text-primary">
        {children}
      </div>
    </div>
  );
}

/**
 * Completed step indicator
 */
function CompletedStep({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="text-text-secondary">{children}</span>
    </div>
  );
}

/**
 * Setting card
 */
function SettingCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="p-4 rounded-xl border border-border bg-surface">
      <h4 className="font-medium text-text-primary mb-1">{title}</h4>
      <p className="text-sm text-text-secondary mb-3">{description}</p>
      {children}
    </div>
  );
}

/**
 * Option button
 */
function OptionButton({
  selected,
  onClick,
  children
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-4 py-2 rounded-lg text-sm font-medium transition-all
        ${selected
          ? 'bg-kanvas-blue text-white'
          : 'bg-surface-secondary text-text-primary hover:bg-surface-tertiary border border-border'
        }
      `}
    >
      {children}
    </button>
  );
}
