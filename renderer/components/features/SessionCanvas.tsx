/**
 * SessionCanvas Component
 * Main work area with split pane for chat and activity
 */

import React from 'react';
import type { Session } from '../../../shared/types';
import { SplitPane } from '../composites/SplitPane';
import { ChatPanel } from './ChatPanel';
import { ActivityLog } from './ActivityLog';

interface SessionCanvasProps {
  session: Session;
}

export function SessionCanvas({ session }: SessionCanvasProps): React.ReactElement {
  return (
    <div className="h-full flex flex-col">
      {/* Session header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-gray-100">{session.name}</h1>
        <p className="text-sm text-gray-400 mt-1">{session.task}</p>
      </div>

      {/* Split pane content */}
      <div className="flex-1 overflow-hidden">
        <SplitPane
          left={<ChatPanel sessionId={session.id} />}
          right={<ActivityLog sessionId={session.id} />}
          defaultSplit={60}
          minLeft={300}
          minRight={250}
        />
      </div>
    </div>
  );
}
