import { AGENTS, isAgentKey } from '@/features/team/agents';
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

export function agentLabel(key: string): string {
  if (isAgentKey(key)) return `${AGENTS[key].name}, ${AGENTS[key].title}`;
  if (key === 'life_assistant') return 'Personal Assistant';
  return key.replace(/_/g, ' ');
}

export function actorLabel(type: ActorType, id: string): string {
  if (type === 'owner') return 'You';
  if (type === 'system') return 'System';
  return agentLabel(id);
}
