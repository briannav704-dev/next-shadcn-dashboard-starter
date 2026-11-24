import type { Icons } from '@/components/icons';

export type Environment = 'life' | 'kouture';

export interface NavItem {
  title: string;
  url: string;
  icon: keyof typeof Icons;
  /** Build phase that delivers this module; shown as "Soon" until then. */
  comingInPhase?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}
