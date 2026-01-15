/**
 * RepoSelector Component Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepoSelector } from '../../../renderer/components/features/RepoSelector';
import { mockApi } from '../setup';

describe('RepoSelector', () => {
  const defaultProps = {
    selectedPath: null,
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockApi.instance.validateRepo.mockResolvedValue({
      success: true,
      data: {
        isValid: true,
        isGitRepo: true,
        repoName: 'test-repo',
        currentBranch: 'main',
        hasKanvasDir: false,
        branches: ['main', 'develop'],
      },
    });

    mockApi.instance.getRecentRepos.mockResolvedValue({
      success: true,
      data: [],
    });

    // Mock openDirectory to return the expected format
    mockApi.dialog.openDirectory.mockResolvedValue({
      success: true,
      data: '/Users/test/my-project',
    });
  });

  describe('Rendering', () => {
    it('should render the repository selector', () => {
      render(<RepoSelector {...defaultProps} />);

      expect(screen.getByText(/repository folder/i)).toBeInTheDocument();
    });

    it('should render browse button', () => {
      render(<RepoSelector {...defaultProps} />);

      expect(screen.getByText(/browse/i)).toBeInTheDocument();
    });

    it('should render path input', () => {
      render(<RepoSelector {...defaultProps} />);

      expect(screen.getByPlaceholderText(/select a repository folder/i)).toBeInTheDocument();
    });
  });

  describe('Recent Repositories', () => {
    it('should load recent repos on mount', async () => {
      mockApi.instance.getRecentRepos.mockResolvedValue({
        success: true,
        data: [
          { path: '/test/repo1', name: 'repo1', lastUsed: new Date().toISOString(), agentCount: 1 },
        ],
      });

      render(<RepoSelector {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.instance.getRecentRepos).toHaveBeenCalled();
      });
    });

    it('should display recent repos when available', async () => {
      mockApi.instance.getRecentRepos.mockResolvedValue({
        success: true,
        data: [
          { path: '/test/repo1', name: 'repo1', lastUsed: new Date().toISOString(), agentCount: 1 },
        ],
      });

      render(<RepoSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('repo1')).toBeInTheDocument();
      });
    });

    it('should select recent repo when clicked', async () => {
      const user = userEvent.setup();
      mockApi.instance.getRecentRepos.mockResolvedValue({
        success: true,
        data: [
          { path: '/test/repo1', name: 'repo1', lastUsed: new Date().toISOString(), agentCount: 1 },
        ],
      });

      render(<RepoSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('repo1')).toBeInTheDocument();
      });

      await user.click(screen.getByText('repo1'));

      await waitFor(() => {
        expect(mockApi.instance.validateRepo).toHaveBeenCalledWith('/test/repo1');
      });
    });
  });

  describe('Browse Functionality', () => {
    it('should open file dialog when browse is clicked', async () => {
      const user = userEvent.setup();
      render(<RepoSelector {...defaultProps} />);

      await user.click(screen.getByText(/browse/i));

      expect(mockApi.dialog.openDirectory).toHaveBeenCalled();
    });

    it('should validate selected path from dialog', async () => {
      const user = userEvent.setup();
      render(<RepoSelector {...defaultProps} />);

      await user.click(screen.getByText(/browse/i));

      await waitFor(() => {
        expect(mockApi.instance.validateRepo).toHaveBeenCalledWith('/Users/test/my-project');
      });
    });

    it('should not validate if dialog returns no data', async () => {
      const user = userEvent.setup();
      mockApi.dialog.openDirectory.mockResolvedValue({
        success: false,
        data: undefined,
      });

      render(<RepoSelector {...defaultProps} />);

      await user.click(screen.getByText(/browse/i));

      // Wait a tick to ensure no validation was triggered
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockApi.instance.validateRepo).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should call validateRepo when browse returns a path', async () => {
      const user = userEvent.setup();
      render(<RepoSelector {...defaultProps} />);

      await user.click(screen.getByText(/browse/i));

      await waitFor(() => {
        expect(mockApi.instance.validateRepo).toHaveBeenCalledWith('/Users/test/my-project');
      });
    });

    it('should call onSelect with valid repo data', async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();
      render(<RepoSelector {...defaultProps} onSelect={onSelect} />);

      await user.click(screen.getByText(/browse/i));

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(
          '/Users/test/my-project',
          expect.objectContaining({
            isValid: true,
            isGitRepo: true,
            repoName: 'test-repo',
          })
        );
      });
    });

    it('should not call onSelect for invalid repo', async () => {
      mockApi.instance.validateRepo.mockResolvedValue({
        success: true,
        data: {
          isValid: false,
          isGitRepo: false,
          repoName: '',
          currentBranch: '',
          hasKanvasDir: false,
          branches: [],
          error: 'Not a Git repository',
        },
      });

      const user = userEvent.setup();
      const onSelect = jest.fn();
      render(<RepoSelector {...defaultProps} onSelect={onSelect} />);

      await user.click(screen.getByText(/browse/i));

      await waitFor(() => {
        expect(mockApi.instance.validateRepo).toHaveBeenCalled();
      });

      // onSelect should not be called for invalid repos
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Selected Path Display', () => {
    it('should display selected path', () => {
      render(<RepoSelector {...defaultProps} selectedPath="/Users/test/my-repo" />);

      const input = screen.getByPlaceholderText(/select a repository folder/i);
      expect(input).toHaveValue('/Users/test/my-repo');
    });
  });
});
