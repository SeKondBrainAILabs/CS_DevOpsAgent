/**
 * Contract Generation Subscription Hook
 * Registers event listeners at app-level so they persist across tab switches
 * Call this once in App.tsx to maintain event subscription
 */

import { useEffect } from 'react';
import { useContractStore } from '../store/contractStore';

export function useContractGenerationSubscription(): void {
  const setIsGenerating = useContractStore((state) => state.setIsGenerating);
  const setGenerationProgress = useContractStore((state) => state.setGenerationProgress);
  const setGenerationResult = useContractStore((state) => state.setGenerationResult);
  const addActivityLog = useContractStore((state) => state.addActivityLog);

  useEffect(() => {
    // Step labels for activity log
    const stepLabels: Record<string, string> = {
      discovering: 'Discovering features',
      analyzing: 'Analyzing code',
      generating: 'Generating contract',
      saving: 'Saving contract',
    };
    const contractTypeLabels: Record<string, string> = {
      markdown: 'Markdown',
      json: 'JSON',
      admin: 'Admin',
    };

    // Subscribe to progress events
    const unsubProgress = window.api?.contractGeneration?.onProgress((progress) => {
      setGenerationProgress({
        total: progress.total,
        completed: progress.completed,
        currentFeature: progress.currentFeature,
        currentStep: progress.currentStep,
        contractType: (progress as { contractType?: 'markdown' | 'json' | 'admin' }).contractType,
        errors: progress.errors,
      });

      // Add activity log entry
      const time = new Date().toLocaleTimeString();
      const stepLabel = stepLabels[progress.currentStep] || progress.currentStep;
      const contractType = (progress as { contractType?: string }).contractType;
      const contractTypeLabel = contractType ? ` [${contractTypeLabels[contractType] || contractType}]` : '';
      addActivityLog({
        time,
        message: `${stepLabel}${contractTypeLabel}: ${progress.currentFeature}`,
        type: 'info',
      });
    });

    // Subscribe to completion events
    const unsubComplete = window.api?.contractGeneration?.onComplete((result) => {
      setIsGenerating(false);
      setGenerationProgress(null);

      // Add completion log
      const time = new Date().toLocaleTimeString();
      addActivityLog({
        time,
        message: `Completed: ${result.generated} contracts generated, ${result.failed} failed (${(result.duration / 1000).toFixed(1)}s)`,
        type: result.failed > 0 ? 'error' : 'success',
      });

      setGenerationResult({
        generated: result.generated,
        failed: result.failed,
        duration: result.duration,
      });

      // Clear result after 5 seconds
      setTimeout(() => {
        useContractStore.getState().clearGenerationResult();
      }, 5000);
    });

    // Cleanup on unmount
    return () => {
      unsubProgress?.();
      unsubComplete?.();
    };
  }, [setIsGenerating, setGenerationProgress, setGenerationResult, addActivityLog]);
}
