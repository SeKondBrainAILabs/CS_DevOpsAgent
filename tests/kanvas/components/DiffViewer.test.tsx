/**
 * DiffViewer Component Tests
 * Tests for the diff display component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffViewer, DiffSummary } from '../../../renderer/components/ui/DiffViewer';

describe('DiffViewer', () => {
  const sampleDiff = `@@ -1,5 +1,8 @@
 import React from 'react';

+export interface Props {
+  name: string;
+}
+
 export function Component() {
-  return <div>Hello</div>;
+  return <div>Hello World</div>;
 }`;

  const defaultProps = {
    diff: sampleDiff,
    filePath: 'src/Component.tsx',
    language: 'typescript',
    additions: 5,
    deletions: 1,
  };

  describe('Rendering', () => {
    it('should render file path', () => {
      render(<DiffViewer {...defaultProps} />);
      expect(screen.getByText('src/Component.tsx')).toBeInTheDocument();
    });

    it('should render language tag', () => {
      render(<DiffViewer {...defaultProps} />);
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should render addition and deletion counts', () => {
      render(<DiffViewer {...defaultProps} />);
      expect(screen.getByText('+5')).toBeInTheDocument();
      expect(screen.getByText('-1')).toBeInTheDocument();
    });

    it('should render line count when expanded', () => {
      render(<DiffViewer {...defaultProps} />);
      // Check for the lines indicator in the header
      expect(screen.getByText(/lines/)).toBeInTheDocument();
    });
  });

  describe('Collapsed State', () => {
    it('should render collapsed when defaultCollapsed is true', () => {
      render(<DiffViewer {...defaultProps} defaultCollapsed={true} />);

      // In collapsed state, we should see the right arrow icon (expand)
      // and NOT see the diff content
      expect(screen.getByText('src/Component.tsx')).toBeInTheDocument();
      // Diff content should not be visible
      expect(screen.queryByText(/import React/)).not.toBeInTheDocument();
    });

    it('should expand when clicked in collapsed state', () => {
      render(<DiffViewer {...defaultProps} defaultCollapsed={true} />);

      // Click to expand
      const header = screen.getByText('src/Component.tsx').closest('div');
      fireEvent.click(header!);

      // Now diff content should be visible
      expect(screen.getByText(/import React/)).toBeInTheDocument();
    });
  });

  describe('Expanded State', () => {
    it('should render expanded by default', () => {
      render(<DiffViewer {...defaultProps} />);

      // Diff content should be visible
      expect(screen.getByText(/import React/)).toBeInTheDocument();
    });

    it('should collapse when header is clicked', () => {
      render(<DiffViewer {...defaultProps} />);

      // Click to collapse
      const header = screen.getByText('src/Component.tsx').closest('div');
      fireEvent.click(header!);

      // Diff content should not be visible
      expect(screen.queryByText(/export function/)).not.toBeInTheDocument();
    });

    it('should show line numbers', () => {
      render(<DiffViewer {...defaultProps} />);

      // Table cells with line numbers should exist
      const table = document.querySelector('table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('Diff Parsing', () => {
    it('should display added lines with + prefix', () => {
      render(<DiffViewer {...defaultProps} />);

      // Added lines should be in the diff
      expect(screen.getByText(/export interface Props/)).toBeInTheDocument();
    });

    it('should display removed lines with - prefix', () => {
      render(<DiffViewer {...defaultProps} />);

      // Look for the removed line content
      expect(screen.getByText(/return <div>Hello<\/div>/)).toBeInTheDocument();
    });

    it('should display hunk headers', () => {
      render(<DiffViewer {...defaultProps} />);

      expect(screen.getByText(/@@ -1,5 \+1,8 @@/)).toBeInTheDocument();
    });
  });

  describe('Max Lines', () => {
    it('should show "Show more" button when lines exceed maxLines', () => {
      const longDiff = Array(150).fill('+ new line').join('\n');

      render(<DiffViewer diff={longDiff} filePath="large-file.ts" maxLines={50} />);

      expect(screen.getByText(/Show .* more lines/)).toBeInTheDocument();
    });

    it('should expand to show all lines when "Show more" is clicked', () => {
      const longDiff = Array(150).fill('+new line').join('\n');

      render(<DiffViewer diff={longDiff} filePath="large-file.ts" maxLines={50} />);

      const showMoreButton = screen.getByText(/Show .* more lines/);
      fireEvent.click(showMoreButton);

      // Button should disappear after clicking
      expect(screen.queryByText(/Show .* more lines/)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty diff', () => {
      render(<DiffViewer diff="" filePath="empty.ts" />);

      expect(screen.getByText('empty.ts')).toBeInTheDocument();
    });

    it('should handle diff without hunk headers', () => {
      const simpleDiff = '+added line\n-removed line\n context line';

      render(<DiffViewer diff={simpleDiff} filePath="simple.ts" />);

      expect(screen.getByText('simple.ts')).toBeInTheDocument();
    });

    it('should handle binary file indicator', () => {
      render(<DiffViewer diff="(binary or large file)" filePath="image.png" />);

      expect(screen.getByText('image.png')).toBeInTheDocument();
    });
  });
});

describe('DiffSummary', () => {
  it('should render file count', () => {
    render(<DiffSummary filesChanged={5} additions={100} deletions={50} />);

    expect(screen.getByText('5 files')).toBeInTheDocument();
  });

  it('should render singular file when count is 1', () => {
    render(<DiffSummary filesChanged={1} additions={10} deletions={5} />);

    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('should render additions in green', () => {
    render(<DiffSummary additions={100} deletions={50} />);

    const additionsElement = screen.getByText('+100');
    expect(additionsElement).toHaveClass('text-green-600');
  });

  it('should render deletions in red', () => {
    render(<DiffSummary additions={100} deletions={50} />);

    const deletionsElement = screen.getByText('-50');
    expect(deletionsElement).toHaveClass('text-red-600');
  });

  it('should not render zero additions', () => {
    render(<DiffSummary additions={0} deletions={50} />);

    expect(screen.queryByText('+0')).not.toBeInTheDocument();
    expect(screen.getByText('-50')).toBeInTheDocument();
  });

  it('should not render zero deletions', () => {
    render(<DiffSummary additions={100} deletions={0} />);

    expect(screen.getByText('+100')).toBeInTheDocument();
    expect(screen.queryByText('-0')).not.toBeInTheDocument();
  });
});
