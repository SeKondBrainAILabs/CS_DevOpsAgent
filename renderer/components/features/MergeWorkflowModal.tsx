/**
 * MergeWorkflowModal Component
 * Guided merge workflow for bringing agent branches back to main
 */

import React, { useState, useEffect } from 'react';
import type { MergePreview, BranchInfo } from '../../../shared/types';

interface MergeWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  sourceBranch: string;
  targetBranch?: string;
  worktreePath?: string;
  sessionId?: string;
  onMergeComplete?: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

type Step = 'preview' | 'options' | 'executing' | 'complete' | 'error';

export function MergeWorkflowModal({
  isOpen,
  onClose,
  repoPath,
  sourceBranch,
  targetBranch: initialTargetBranch = 'main',
  worktreePath,
  sessionId,
  onMergeComplete,
  onDeleteSession,
}: MergeWorkflowModalProps): React.ReactElement | null {
  const [step, setStep] = useState<Step>('preview');
  const [targetBranch, setTargetBranch] = useState(initialTargetBranch);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Merge options
  const [deleteWorktree, setDeleteWorktree] = useState(true);
  const [deleteLocalBranch, setDeleteLocalBranch] = useState(false);
  const [deleteRemoteBranch, setDeleteRemoteBranch] = useState(false);
  const [deleteSession, setDeleteSession] = useState(true); // Delete session from Kanvas after merge

  // Merge result
  const [mergeResult, setMergeResult] = useState<{
    success: boolean;
    message: string;
    mergeCommitHash?: string;
    filesChanged?: number;
  } | null>(null);

  // Load branches when modal opens
  useEffect(() => {
    if (!isOpen) {
      setStep('preview');
      setPreview(null);
      setError(null);
      setMergeResult(null);
      setBranches([]);
      return;
    }

    // Fetch available branches
    const loadBranches = async () => {
      if (window.api?.git?.branches && repoPath) {
        // Use repoPath for branches, not sessionId
        const result = await window.api.git.branches(repoPath);
        if (result.success && result.data) {
          // Filter out the source branch and session branches
          setBranches(result.data.filter((b) =>
            b.name !== sourceBranch && !b.name.startsWith('session/')
          ));
        }
      }
    };

    loadBranches();
    loadPreview();
  }, [isOpen, sourceBranch, targetBranch, repoPath]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.api?.merge?.preview) {
        const result = await window.api.merge.preview(repoPath, sourceBranch, targetBranch);
        if (result.success && result.data) {
          setPreview(result.data);
        } else {
          setError(result.error?.message || 'Failed to load merge preview');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load merge preview');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteMerge = async () => {
    setStep('executing');
    setError(null);

    try {
      if (window.api?.merge?.execute) {
        const result = await window.api.merge.execute(
          repoPath,
          sourceBranch,
          targetBranch,
          {
            deleteWorktree: deleteWorktree && !!worktreePath,
            deleteLocalBranch,
            deleteRemoteBranch,
            worktreePath,
          }
        );

        if (result.success && result.data) {
          setMergeResult(result.data);
          if (result.data.success) {
            setStep('complete');
            onMergeComplete?.();
            // Delete the session from Kanvas if option is checked
            if (deleteSession && sessionId && onDeleteSession) {
              onDeleteSession(sessionId);
            }
          } else {
            setError(result.data.message);
            setStep('error');
          }
        } else {
          setError(result.error?.message || 'Merge failed');
          setStep('error');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Merge Workflow</h2>
              <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
                <span>Merge</span>
                <code className="text-kanvas-blue">{sourceBranch}</code>
                <span>into</span>
                {step === 'preview' && branches.length > 0 ? (
                  <select
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="px-2 py-1 rounded bg-surface-secondary border border-border text-kanvas-blue text-sm font-mono focus:outline-none focus:ring-2 focus:ring-kanvas-blue/50"
                  >
                    {/* Always include current target even if not in branches list */}
                    {!branches.find(b => b.name === targetBranch) && (
                      <option value={targetBranch}>{targetBranch}</option>
                    )}
                    {branches.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <code className="text-kanvas-blue">{targetBranch}</code>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {(['preview', 'options', 'executing', 'complete'] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? 'bg-kanvas-blue text-white'
                      : step === 'error' && s === 'executing'
                      ? 'bg-red-500 text-white'
                      : s === 'complete' && step === 'complete'
                      ? 'bg-green-500 text-white'
                      : 'bg-surface-tertiary text-text-secondary'
                  }`}
                >
                  {i + 1}
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-0.5 ${
                    i < ['preview', 'options', 'executing', 'complete'].indexOf(step)
                      ? 'bg-kanvas-blue'
                      : 'bg-surface-tertiary'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto max-h-[50vh]">
          {/* Step 1: Preview */}
          {step === 'preview' && (
            <div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-kanvas-blue border-t-transparent rounded-full" />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-red-700">{error}</p>
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  {/* Merge status */}
                  <div className={`p-4 rounded-xl border ${
                    preview.canMerge
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {preview.canMerge ? (
                        <>
                          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-medium text-green-700">Ready to merge</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="font-medium text-red-700">Conflicts detected</span>
                        </>
                      )}
                    </div>
                    {preview.hasConflicts && preview.conflictingFiles.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-red-600">Conflicting files:</p>
                        <ul className="mt-1 text-sm text-red-700 font-mono">
                          {preview.conflictingFiles.map((file) => (
                            <li key={file}>• {file}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-surface-secondary rounded-lg">
                      <div className="text-2xl font-bold text-text-primary">{preview.commitCount}</div>
                      <div className="text-sm text-text-secondary">Commits</div>
                    </div>
                    <div className="p-3 bg-surface-secondary rounded-lg">
                      <div className="text-2xl font-bold text-text-primary">{preview.filesChanged.length}</div>
                      <div className="text-sm text-text-secondary">Files Changed</div>
                    </div>
                    <div className="p-3 bg-surface-secondary rounded-lg">
                      <div className="text-2xl font-bold text-text-primary">
                        +{preview.aheadBy} / -{preview.behindBy}
                      </div>
                      <div className="text-sm text-text-secondary">Ahead/Behind</div>
                    </div>
                  </div>

                  {/* Files changed */}
                  {preview.filesChanged.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-text-primary mb-2">Files to be merged:</h4>
                      <div className="max-h-40 overflow-auto bg-surface-secondary rounded-lg p-2">
                        {preview.filesChanged.map((file) => (
                          <div key={file.path} className="flex items-center gap-2 py-1 text-sm">
                            <span className={`w-2 h-2 rounded-full ${
                              file.status === 'added' ? 'bg-green-500' :
                              file.status === 'deleted' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`} />
                            <span className="font-mono text-text-secondary flex-1 truncate">{file.path}</span>
                            <span className="text-green-500">+{file.additions}</span>
                            <span className="text-red-500">-{file.deletions}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Step 2: Options */}
          {step === 'options' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-primary">Post-merge cleanup options</h3>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors">
                <input
                  type="checkbox"
                  checked={deleteWorktree}
                  onChange={(e) => setDeleteWorktree(e.target.checked)}
                  disabled={!worktreePath}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-text-primary">Delete worktree</div>
                  <div className="text-sm text-text-secondary">
                    {worktreePath
                      ? `Remove the worktree directory at ${worktreePath.split('/').slice(-2).join('/')}`
                      : 'No worktree associated with this session'}
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors">
                <input
                  type="checkbox"
                  checked={deleteLocalBranch}
                  onChange={(e) => setDeleteLocalBranch(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-text-primary">Delete local branch</div>
                  <div className="text-sm text-text-secondary">
                    Delete <code>{sourceBranch}</code> from local repository after merge
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors">
                <input
                  type="checkbox"
                  checked={deleteRemoteBranch}
                  onChange={(e) => setDeleteRemoteBranch(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-text-primary">Delete remote branch</div>
                  <div className="text-sm text-text-secondary">
                    Delete <code>origin/{sourceBranch}</code> from remote after merge
                  </div>
                </div>
              </label>

              {sessionId && (
                <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors border-t border-border mt-2 pt-4">
                  <input
                    type="checkbox"
                    checked={deleteSession}
                    onChange={(e) => setDeleteSession(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-text-primary">Remove session from Kanvas</div>
                    <div className="text-sm text-text-secondary">
                      Remove this session from the Kanvas dashboard after merge
                    </div>
                  </div>
                </label>
              )}
            </div>
          )}

          {/* Step 3: Executing */}
          {step === 'executing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin w-12 h-12 border-3 border-kanvas-blue border-t-transparent rounded-full mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">Merging...</h3>
              <p className="text-sm text-text-secondary">Please wait while the merge is executed</p>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && mergeResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">Merge Complete!</h3>
              <p className="text-sm text-text-secondary mb-4">{mergeResult.message}</p>
              {mergeResult.mergeCommitHash && (
                <p className="text-xs text-text-secondary font-mono">
                  Commit: {mergeResult.mergeCommitHash.slice(0, 8)}
                </p>
              )}
              {mergeResult.filesChanged && (
                <p className="text-sm text-text-secondary mt-2">
                  {mergeResult.filesChanged} files changed
                </p>
              )}
            </div>
          )}

          {/* Error state */}
          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">Merge Failed</h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-secondary">
          <div className="flex items-center justify-between">
            {step === 'preview' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('options')}
                  disabled={!preview?.canMerge}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    preview?.canMerge
                      ? 'bg-kanvas-blue text-white hover:bg-kanvas-blue/90'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Continue
                </button>
              </>
            )}
            {step === 'options' && (
              <>
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleExecuteMerge}
                  className="px-4 py-2 rounded-lg bg-kanvas-blue text-white font-medium hover:bg-kanvas-blue/90 transition-colors"
                >
                  Execute Merge
                </button>
              </>
            )}
            {(step === 'complete' || step === 'error') && (
              <button
                onClick={onClose}
                className="ml-auto px-4 py-2 rounded-lg bg-surface text-text-primary hover:bg-surface-tertiary transition-colors font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
