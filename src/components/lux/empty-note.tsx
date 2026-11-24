import type * as React from 'react';

import { cn } from '@/lib/utils';

export function EmptyNote({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground border-border/80 rounded-lg border border-dashed px-4 py-6 text-center text-sm',
        className
      )}
    >
      {children}
    </div>
  );
}
