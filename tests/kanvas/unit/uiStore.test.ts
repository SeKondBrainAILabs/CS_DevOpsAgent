/**
 * UI Store Tests
 * Tests for the Zustand UI state management store
 */

import { renderHook, act } from '@testing-library/react';
import { useUIStore } from '../../../renderer/store/uiStore';

describe('UI Store', () => {
  // Reset store state before each test
  beforeEach(() => {
    const { result } = renderHook(() => useUIStore());
    act(() => {
      result.current.setShowNewSessionWizard(false);
      result.current.setShowCloseSessionDialog(false);
      result.current.setShowSettingsModal(false);
      result.current.setShowCreateAgentWizard(false);
      result.current.setSidebarWidth(256);
      result.current.setMainSplitPosition(60);
    });
  });

  describe('Sidebar State', () => {
    it('should have sidebar expanded by default', () => {
      const { result } = renderHook(() => useUIStore());
      expect(result.current.sidebarCollapsed).toBe(false);
    });

    it('should toggle sidebar collapsed state', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.sidebarCollapsed).toBe(true);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.sidebarCollapsed).toBe(false);
    });

    it('should set sidebar width', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSidebarWidth(300);
      });

      expect(result.current.sidebarWidth).toBe(300);
    });

    it('should have default sidebar width of 256', () => {
      const { result } = renderHook(() => useUIStore());
      expect(result.current.sidebarWidth).toBe(256);
    });
  });

  describe('Modal State', () => {
    it('should have all modals closed by default', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.showNewSessionWizard).toBe(false);
      expect(result.current.showCloseSessionDialog).toBe(false);
      expect(result.current.showSettingsModal).toBe(false);
      expect(result.current.showCreateAgentWizard).toBe(false);
    });

    it('should open and close NewSessionWizard', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setShowNewSessionWizard(true);
      });

      expect(result.current.showNewSessionWizard).toBe(true);

      act(() => {
        result.current.setShowNewSessionWizard(false);
      });

      expect(result.current.showNewSessionWizard).toBe(false);
    });

    it('should open and close CloseSessionDialog with sessionId', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setShowCloseSessionDialog(true, 'session-123');
      });

      expect(result.current.showCloseSessionDialog).toBe(true);
      expect(result.current.closeSessionId).toBe('session-123');

      act(() => {
        result.current.setShowCloseSessionDialog(false);
      });

      expect(result.current.showCloseSessionDialog).toBe(false);
      expect(result.current.closeSessionId).toBeNull();
    });

    it('should open and close SettingsModal', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setShowSettingsModal(true);
      });

      expect(result.current.showSettingsModal).toBe(true);

      act(() => {
        result.current.setShowSettingsModal(false);
      });

      expect(result.current.showSettingsModal).toBe(false);
    });

    it('should open and close CreateAgentWizard', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setShowCreateAgentWizard(true);
      });

      expect(result.current.showCreateAgentWizard).toBe(true);

      act(() => {
        result.current.setShowCreateAgentWizard(false);
      });

      expect(result.current.showCreateAgentWizard).toBe(false);
    });
  });

  describe('Split Pane State', () => {
    it('should have default main split position of 60', () => {
      const { result } = renderHook(() => useUIStore());
      expect(result.current.mainSplitPosition).toBe(60);
    });

    it('should set main split position', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setMainSplitPosition(40);
      });

      expect(result.current.mainSplitPosition).toBe(40);
    });

    it('should allow extreme split positions', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setMainSplitPosition(10);
      });
      expect(result.current.mainSplitPosition).toBe(10);

      act(() => {
        result.current.setMainSplitPosition(90);
      });
      expect(result.current.mainSplitPosition).toBe(90);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useUIStore());

      act(() => {
        result1.current.setShowCreateAgentWizard(true);
        result1.current.setSidebarWidth(400);
      });

      const { result: result2 } = renderHook(() => useUIStore());

      expect(result2.current.showCreateAgentWizard).toBe(true);
      expect(result2.current.sidebarWidth).toBe(400);
    });
  });
});
