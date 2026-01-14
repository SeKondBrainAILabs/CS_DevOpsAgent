/**
 * SplitPane Component
 * Draggable resizable split pane
 */

import React, { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultSplit?: number; // percentage
  minLeft?: number; // pixels
  minRight?: number; // pixels
}

export function SplitPane({
  left,
  right,
  defaultSplit = 50,
  minLeft = 200,
  minRight = 200,
}: SplitPaneProps): React.ReactElement {
  const [split, setSplit] = useState(defaultSplit);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      const newSplit = (x / width) * 100;
      const minLeftPct = (minLeft / width) * 100;
      const maxSplit = 100 - (minRight / width) * 100;

      setSplit(Math.min(Math.max(newSplit, minLeftPct), maxSplit));
    },
    [minLeft, minRight]
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Attach global listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full">
      <div style={{ width: `${split}%` }} className="overflow-hidden">
        {left}
      </div>

      {/* Divider - more prominent and easier to grab */}
      <div
        onMouseDown={handleMouseDown}
        className="w-2 bg-border hover:bg-kanvas-blue cursor-col-resize flex-shrink-0 transition-colors
                   relative group"
      >
        {/* Visual grip indicator */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1
                        flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-1 rounded-full bg-white/60" />
          <div className="w-1 h-1 rounded-full bg-white/60" />
          <div className="w-1 h-1 rounded-full bg-white/60" />
        </div>
      </div>

      <div style={{ width: `${100 - split}%` }} className="overflow-hidden">
        {right}
      </div>
    </div>
  );
}
