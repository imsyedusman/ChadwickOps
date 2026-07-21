'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0, spaceAbove: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        spaceAbove: rect.top
      });
    }
  };

  useLayoutEffect(() => {
    if (isVisible) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isVisible]);

  return (
    <div 
      ref={triggerRef}
      className="inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && mounted && createPortal(
        (function() {
          const flip = coords.spaceAbove < 60; // Approximate height of tooltip
          return (
            <div 
                className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                style={{ 
                    top: flip ? `${coords.top + coords.height}px` : `${coords.top}px`, 
                    left: `${coords.left + coords.width / 2}px`,
                    transform: flip ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' 
                }}
            >
              <div className={cn(
                "px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-medium rounded-lg shadow-2xl w-48 text-center ring-1 ring-white/10",
                flip ? "mt-2" : "mb-2",
                className
              )}>
                {content}
                {flip ? (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-slate-900 dark:border-b-slate-800" />
                ) : (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                )}
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}
