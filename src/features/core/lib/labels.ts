import type { ActorType, ApprovalActionType } from '@/server/data/types';

export const ACTION_LABEL: Record<ApprovalActionType, string> = {
  send_message: 'Send a message',
  publish_content: 'Publish content',
  change_appointment: 'Change an appointment',
  issue_refund: 'Issue a refund',
  make_purchase: 'Make a purchase',
  external_financial_access: 'Access a financial service',
  irreversible: 'Irreversible action'
};

// Agent keys match the roles defined for Phase 5.
const AGENT_LABEL: Record<string, string> = {
  ceo: 'CEO · Executive Assistant',
  marketing_director: 'Marketing Director',
  finance_manager: 'Finance Manager',
  operations_manager: 'Operations Manager',
  client_relations: 'Client Relations Manager',
  inventory_manager: 'Inventory Manager',
  business_analyst: 'Business Analyst',
  life_assistant: 'Personal Assistant'
};

export function agentLabel(key: string): string {
  return AGENT_LABEL[key] ?? key.replace(/_/g, ' ');
}

export function actorLabel(type: ActorType, id: string): string {
  if (type === 'owner') return 'You';
  if (type === 'system') return 'System';
  return agentLabel(id);
}
