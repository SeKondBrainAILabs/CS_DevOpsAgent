/**
 * TaskInput Component Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskInput } from '../../../renderer/components/features/TaskInput';

describe('TaskInput', () => {
  const defaultProps = {
    taskDescription: '',
    branchName: '',
    baseBranch: 'main',
    branches: ['main', 'develop', 'feature/existing'],
    onTaskChange: jest.fn(),
    onBranchChange: jest.fn(),
    onBaseBranchChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task Description Input', () => {
    it('should render task description textarea', () => {
      render(<TaskInput {...defaultProps} />);

      expect(screen.getByText(/task description/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/what should the agent work on/i)).toBeInTheDocument();
    });

    it('should call onTaskChange when task is typed', async () => {
      const user = userEvent.setup();
      render(<TaskInput {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/what should the agent work on/i);
      await user.type(textarea, 'Add dark mode');

      expect(defaultProps.onTaskChange).toHaveBeenCalled();
    });

    it('should display the current task description', () => {
      render(<TaskInput {...defaultProps} taskDescription="Implement feature X" />);

      const textarea = screen.getByPlaceholderText(/what should the agent work on/i);
      expect(textarea).toHaveValue('Implement feature X');
    });
  });

  describe('Branch Name Input', () => {
    it('should render branch name input', () => {
      render(<TaskInput {...defaultProps} />);

      expect(screen.getByText(/branch name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/feature\/my-feature/i)).toBeInTheDocument();
    });

    it('should display the current branch name', () => {
      render(<TaskInput {...defaultProps} branchName="feature/new-feature" />);

      const input = screen.getByPlaceholderText(/feature\/my-feature/i);
      expect(input).toHaveValue('feature/new-feature');
    });

    it('should call onBranchChange when branch name is edited', async () => {
      const user = userEvent.setup();
      render(<TaskInput {...defaultProps} branchName="feature/test" />);

      const input = screen.getByPlaceholderText(/feature\/my-feature/i);
      await user.clear(input);
      await user.type(input, 'feature/custom');

      expect(defaultProps.onBranchChange).toHaveBeenCalled();
    });

    it('should show Auto badge when auto-generation is active', () => {
      render(
        <TaskInput
          {...defaultProps}
          taskDescription="Add dark mode"
          branchName="feature/add-dark-mode"
        />
      );

      // The Auto badge appears when auto-generation is active and branchName is set
      expect(screen.getByText('Auto')).toBeInTheDocument();
    });
  });

  describe('Base Branch Selection', () => {
    it('should render base branch dropdown', () => {
      render(<TaskInput {...defaultProps} />);

      // Use getAllByText since "base branch" appears multiple times (label + helper text)
      const baseBranchTexts = screen.getAllByText(/base branch/i);
      expect(baseBranchTexts.length).toBeGreaterThan(0);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should display available branches in dropdown', () => {
      render(<TaskInput {...defaultProps} />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('main');

      // Check dropdown options
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(3); // main, develop, feature/existing
    });

    it('should call onBaseBranchChange when selection changes', async () => {
      const user = userEvent.setup();
      render(<TaskInput {...defaultProps} />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'develop');

      expect(defaultProps.onBaseBranchChange).toHaveBeenCalledWith('develop');
    });
  });

  describe('Advanced Options', () => {
    it('should have collapsible advanced options section', () => {
      render(<TaskInput {...defaultProps} />);

      expect(screen.getByText(/advanced options/i)).toBeInTheDocument();
    });
  });
});
