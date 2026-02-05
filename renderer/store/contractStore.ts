/**
 * Contract Store
 * Global state for contract generation that persists across tab switches
 */

import { create } from 'zustand';

export interface ContractGenerationProgress {
  total: number;
  completed: number;
  currentFeature: string;
  currentStep: 'discovering' | 'analyzing' | 'generating' | 'saving';
  contractType?: 'markdown' | 'json' | 'admin';
  errors: string[];
}

export interface ContractGenerationResult {
  generated: number;
  failed: number;
  duration: number;
}

export interface ActivityLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface ContractState {
  // Contract generation state
  isGenerating: boolean;
  generationProgress: ContractGenerationProgress | null;
  generationResult: ContractGenerationResult | null;
  activityLogs: ActivityLog[];

  // Actions
  setIsGenerating: (val: boolean) => void;
  setGenerationProgress: (progress: ContractGenerationProgress | null) => void;
  setGenerationResult: (result: ContractGenerationResult | null) => void;
  addActivityLog: (log: ActivityLog) => void;
  clearActivityLogs: () => void;
  clearGenerationResult: () => void;
}

export const useContractStore = create<ContractState>((set) => ({
  // Initial state
  isGenerating: false,
  generationProgress: null,
  generationResult: null,
  activityLogs: [],

  // Actions
  setIsGenerating: (val) => set({ isGenerating: val }),

  setGenerationProgress: (progress) => set({ generationProgress: progress }),

  setGenerationResult: (result) => set({ generationResult: result }),

  addActivityLog: (log) =>
    set((state) => ({
      activityLogs: [...state.activityLogs.slice(-49), log],
    })),

  clearActivityLogs: () => set({ activityLogs: [] }),

  clearGenerationResult: () => set({ generationResult: null }),
}));
