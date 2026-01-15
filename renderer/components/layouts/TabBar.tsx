/**
 * TabBar Component
 * Multi-session tab bar with new/close buttons
 */

import React from 'react';

interface Tab {
  id: string;
  title: string;
  icon?: React.ReactNode;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onNew,
}: TabBarProps): React.ReactElement {
  return (
    <div className="h-9 bg-surface-tertiary flex items-center border-b border-border">
      {/* Drag region for window (macOS) */}
      <div className="w-20 h-full app-drag-region" />

      {/* Tabs */}
      <div className="flex-1 flex items-center gap-0.5 overflow-x-auto px-1 no-drag">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`
              group flex items-center gap-2 px-3 py-1.5 rounded-t-md text-sm
              transition-colors min-w-[120px] max-w-[200px]
              ${
                activeTabId === tab.id
                  ? 'bg-surface text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface/50'
              }
            `}
          >
            {tab.icon}
            <span className="truncate flex-1 text-left">{tab.title}</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {/* New tab button */}
      <button
        onClick={onNew}
        className="p-2 text-gray-400 hover:text-white hover:bg-surface/50 rounded no-drag"
        title="New Session (Ctrl+N)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Window controls space (for frameless) */}
      <div className="w-32 h-full app-drag-region" />
    </div>
  );
}
