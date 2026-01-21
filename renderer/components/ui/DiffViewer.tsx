/**
 * DiffViewer Component
 * Displays git diff output with syntax highlighting
 * Supports collapsed/expanded state and line numbers
 */

import React, { useState, useMemo } from 'react';

interface DiffViewerProps {
  diff: string;
  filePath: string;
  language?: string;
  defaultCollapsed?: boolean;
  maxLines?: number;
  additions?: number;
  deletions?: number;
}

interface DiffLine {
  content: string;
  type: 'added' | 'removed' | 'context' | 'header' | 'info';
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function DiffViewer({
  diff,
  filePath,
  language,
  defaultCollapsed = false,
  maxLines = 100,
  additions = 0,
  deletions = 0,
}: DiffViewerProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);

  const parsedLines = useMemo(() => {
    const lines: DiffLine[] = [];
    const rawLines = diff.split('\n');

    let oldLine = 0;
    let newLine = 0;

    for (const line of rawLines) {
      if (line.startsWith('@@')) {
        // Parse hunk header: @@ -10,5 +10,7 @@
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        lines.push({ content: line, type: 'header' });
      } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
        lines.push({ content: line, type: 'info' });
      } else if (line.startsWith('+')) {
        lines.push({
          content: line.slice(1),
          type: 'added',
          newLineNumber: newLine++,
        });
      } else if (line.startsWith('-')) {
        lines.push({
          content: line.slice(1),
          type: 'removed',
          oldLineNumber: oldLine++,
        });
      } else if (line.startsWith(' ')) {
        lines.push({
          content: line.slice(1),
          type: 'context',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
        });
      } else if (line.trim()) {
        lines.push({ content: line, type: 'context' });
      }
    }

    return lines;
  }, [diff]);

  const displayLines = showAll ? parsedLines : parsedLines.slice(0, maxLines);
  const hasMore = parsedLines.length > maxLines;

  const getLineStyle = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'removed':
        return 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'header':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 font-medium';
      case 'info':
        return 'text-text-secondary bg-surface-secondary';
      default:
        return 'text-text-primary';
    }
  };

  const getLinePrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      default:
        return ' ';
    }
  };

  // Get file extension for display
  const fileExt = filePath.split('.').pop() || '';

  if (collapsed) {
    return (
      <div
        className="border border-border rounded-lg overflow-hidden cursor-pointer hover:border-kanvas-blue transition-colors"
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-surface-secondary">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-mono text-sm text-text-primary truncate">{filePath}</span>
            {language && (
              <span className="px-1.5 py-0.5 text-xs bg-surface-tertiary text-text-secondary rounded">
                {language}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            {additions > 0 && (
              <span className="text-green-600">+{additions}</span>
            )}
            {deletions > 0 && (
              <span className="text-red-600">-{deletions}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors"
        onClick={() => setCollapsed(true)}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="font-mono text-sm text-text-primary truncate">{filePath}</span>
          {language && (
            <span className="px-1.5 py-0.5 text-xs bg-surface-tertiary text-text-secondary rounded">
              {language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {additions > 0 && (
            <span className="text-green-600">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-red-600">-{deletions}</span>
          )}
          <span className="text-text-secondary">{parsedLines.length} lines</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {displayLines.map((line, index) => (
              <tr key={index} className={getLineStyle(line.type)}>
                {/* Line numbers */}
                <td className="w-10 text-right px-2 py-0.5 text-text-secondary select-none border-r border-border/50">
                  {line.oldLineNumber || ''}
                </td>
                <td className="w-10 text-right px-2 py-0.5 text-text-secondary select-none border-r border-border/50">
                  {line.newLineNumber || ''}
                </td>
                {/* Prefix (+/-/ ) */}
                <td className="w-4 px-1 py-0.5 select-none">
                  {line.type !== 'header' && line.type !== 'info' && getLinePrefix(line.type)}
                </td>
                {/* Content */}
                <td className="px-2 py-0.5 whitespace-pre">
                  {line.content}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show more button */}
      {hasMore && !showAll && (
        <div className="px-3 py-2 text-center border-t border-border bg-surface-secondary">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAll(true);
            }}
            className="text-xs text-kanvas-blue hover:underline"
          >
            Show {parsedLines.length - maxLines} more lines...
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact diff summary for use in commit lists
 */
export function DiffSummary({
  additions,
  deletions,
  filesChanged,
}: {
  additions: number;
  deletions: number;
  filesChanged?: number;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 text-xs">
      {filesChanged !== undefined && (
        <span className="text-text-secondary">{filesChanged} file{filesChanged !== 1 ? 's' : ''}</span>
      )}
      {additions > 0 && (
        <span className="text-green-600 font-medium">+{additions}</span>
      )}
      {deletions > 0 && (
        <span className="text-red-600 font-medium">-{deletions}</span>
      )}
    </div>
  );
}
