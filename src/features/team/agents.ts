import type { Icons } from '@/components/icons';
import type { AgentKey } from '@/server/data/types';

// The Kouture management team. Each agent has one job, a scoped view of the
// business, and no power to act outside the app: anything outward goes to the
// owner's Approvals inbox.

export type AgentProfile = {
  key: AgentKey;
  name: string;
  title: string;
  icon: keyof typeof Icons;
  mission: string;
  watches: string[];
  /** What the agent may draft for approval; empty means it only advises. */
  drafts: string[];
  /** Instant answers offered in the chat while the AI brain is off. */
  quickAsks: { id: QuickAsk; label: string }[];
};

export type QuickAsk = 'needs' | 'update' | 'done';

const COMMON_ASKS: AgentProfile['quickAsks'] = [
  { id: 'needs', label: 'What needs me?' },
  { id: 'update', label: 'Give me your update' },
  { id: 'done', label: 'What did you finish?' }
];

export const AGENTS: Record<AgentKey, AgentProfile> = {
  ceo: {
    key: 'ceo',
    name: 'Valentina',
    title: 'CEO',
    icon: 'diamond',
    mission:
      'Runs the team and gives you one clear morning briefing: the few things that matter today.',
    watches: ['Every team member’s findings', 'Your approvals inbox'],
    drafts: [],
    quickAsks: COMMON_ASKS
  },
  operations_manager: {
    key: 'operations_manager',
    name: 'Olivia',
    title: 'Operations Manager',
    icon: 'calendarEvent',
    mission:
      'Keeps the chair running: today’s schedule, visits to check out, and bookings that need a price.',
    watches: ['Appointments', 'Nailzy calendar sync', 'Service menu'],
    drafts: [],
    quickAsks: COMMON_ASKS
  },
  client_relations: {
    key: 'client_relations',
    name: 'Camille',
    title: 'Client Relations Manager',
    icon: 'retention',
    mission:
      'Looks after every client: who is due, who is slipping away, birthdays, and repeat no-shows.',
    watches: ['Clients and visit history', 'Marketing consent', 'Policies'],
    drafts: ['Win-back and reminder texts, only to clients who agreed to marketing'],
    quickAsks: COMMON_ASKS
  },
  marketing_director: {
    key: 'marketing_director',
    name: 'Mila',
    title: 'Marketing Director',
    icon: 'marketing',
    mission:
      'Keeps your calendar full of content: no empty weeks, nothing late, posts ready on time.',
    watches: ['Marketing calendar', 'Social planner', 'Top services'],
    drafts: ['Posts that are ready to publish'],
    quickAsks: COMMON_ASKS
  },
  finance_manager: {
    key: 'finance_manager',
    name: 'Grace',
    title: 'Finance Manager',
    icon: 'cash',
    mission: 'Watches the money: profit, spending, and tax payments before they are due.',
    watches: ['Payments and expenses', 'Profit reports', 'Taxes'],
    drafts: [],
    quickAsks: COMMON_ASKS
  },
  inventory_manager: {
    key: 'inventory_manager',
    name: 'Ivy',
    title: 'Inventory Manager',
    icon: 'inventory',
    mission: 'Makes sure you never run out: spots low stock and drafts the restock order.',
    watches: ['Inventory'],
    drafts: ['Restock orders'],
    quickAsks: COMMON_ASKS
  },
  business_analyst: {
    key: 'business_analyst',
    name: 'Ana',
    title: 'Business Analyst',
    icon: 'analytics',
    mission: 'Finds the patterns: what sells, when you are busiest, and who comes back.',
    watches: ['Appointments', 'Payments', 'Clients'],
    drafts: [],
    quickAsks: COMMON_ASKS
  }
};

export const TEAM_ORDER: AgentKey[] = [
  'ceo',
  'operations_manager',
  'client_relations',
  'marketing_director',
  'finance_manager',
  'inventory_manager',
  'business_analyst'
];

export function isAgentKey(value: string): value is AgentKey {
  return Object.prototype.hasOwnProperty.call(AGENTS, value);
}
