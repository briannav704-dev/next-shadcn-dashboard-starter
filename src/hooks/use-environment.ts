'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

import type { Environment } from '@/types';

const STORAGE_KEY = 'kouture:last-environment';

function fromPath(pathname: string): Environment | null {
  if (pathname.startsWith('/kouture')) return 'kouture';
  if (pathname.startsWith('/life')) return 'life';
  return null;
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); fall back to My Life.
    return null;
  }
}

/**
 * The environment the sidebar should show. Shared pages (approvals, activity)
 * keep whichever environment you came from.
 */
export function useEnvironment(): Environment {
  const direct = fromPath(usePathname());
  const stored = useSyncExternalStore(subscribe, readStored, () => null);

  useEffect(() => {
    if (!direct) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, direct);
    } catch {
      // Not persisting is harmless.
    }
  }, [direct]);

  return direct ?? (stored === 'kouture' ? 'kouture' : 'life');
}
