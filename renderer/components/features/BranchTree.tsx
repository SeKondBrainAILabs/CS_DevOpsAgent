/**
 * BranchTree Component
 * Hierarchical branch visualization
 */

import React, { useState, useEffect } from 'react';
import type { BranchInfo } from '../../../shared/types';

interface BranchTreeProps {
  sessionId: string;
}

interface BranchNode {
  name: string;
  fullName: string;
  current: boolean;
  children: BranchNode[];
}

function buildTree(branches: BranchInfo[]): BranchNode[] {
  const root: BranchNode[] = [];
  const nodeMap = new Map<string, BranchNode>();

  // Sort branches for consistent ordering
  const sortedBranches = [...branches].sort((a, b) => a.name.localeCompare(b.name));

  for (const branch of sortedBranches) {
    const parts = branch.name.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = i === parts.length - 1;

      let node = nodeMap.get(currentPath);
      if (!node) {
        node = {
          name: part,
          fullName: currentPath,
          current: isLeaf && branch.current,
          children: [],
        };
        nodeMap.set(currentPath, node);
        currentLevel.push(node);
      }
      currentLevel = node.children;
    }
  }

  return root;
}

function TreeNode({
  node,
  depth,
  onSelect,
}: {
  node: BranchNode;
  depth: number;
  onSelect: (branchName: string) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren;

  return (
    <div>
      <button
        onClick={() => (hasChildren ? setExpanded(!expanded) : onSelect(node.fullName))}
        className={`
          w-full flex items-center gap-1 px-2 py-1 text-sm rounded
          hover:bg-surface-tertiary transition-colors text-left
          ${node.current ? 'text-accent font-medium' : 'text-gray-300'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Expand/collapse icon or branch icon */}
        {hasChildren ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-500"
          >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
        )}
        <span className="truncate">{node.name}</span>
        {node.current && (
          <span className="ml-auto text-xs text-accent">current</span>
        )}
      </button>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.fullName}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BranchTree({ sessionId }: BranchTreeProps): React.ReactElement {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.api.git.branches(sessionId).then((result) => {
      if (result.success && result.data) {
        setBranches(result.data);
      }
      setLoading(false);
    });
  }, [sessionId]);

  const tree = buildTree(branches);

  const handleSelect = (branchName: string) => {
    console.log('Selected branch:', branchName);
    // Could implement checkout or other branch operations
  };

  if (loading) {
    return (
      <div className="p-4 text-gray-500 text-sm">Loading branches...</div>
    );
  }

  if (branches.length === 0) {
    return <div className="p-4 text-gray-500 text-sm">No branches found</div>;
  }

  return (
    <div className="py-2">
      {tree.map((node) => (
        <TreeNode
          key={node.fullName}
          node={node}
          depth={0}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
