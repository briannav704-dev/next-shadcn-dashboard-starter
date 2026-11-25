import type { Environment, NavGroup } from '@/types';

export const ENVIRONMENTS: Record<
  Environment,
  { label: string; tagline: string; home: string; icon: 'heart' | 'diamond' }
> = {
  life: { label: 'My Life', tagline: 'Personal', home: '/life', icon: 'heart' },
  kouture: { label: 'Kouture Nail Bar', tagline: 'Business', home: '/kouture', icon: 'diamond' }
};

export const NAV: Record<Environment, NavGroup[]> = {
  life: [
    {
      label: 'Today',
      items: [
        { title: 'Dashboard', url: '/life', icon: 'home' },
        { title: 'Daily planner', url: '/life/planner', icon: 'planner' },
        { title: 'Calendar', url: '/life/calendar', icon: 'calendarEvent' },
        { title: 'Tasks', url: '/life/tasks', icon: 'checklist' },
        { title: 'Habits', url: '/life/habits', icon: 'habit' }
      ]
    },
    {
      label: 'Money',
      items: [
        { title: 'Budget', url: '/life/budget', icon: 'wallet' },
        { title: 'Savings goals', url: '/life/savings', icon: 'savings' }
      ]
    },
    {
      label: 'Wellness',
      items: [
        { title: 'Fitness', url: '/life/fitness', icon: 'fitness' },
        { title: 'Workout plan', url: '/life/workouts', icon: 'planner' },
        { title: 'Meal planning', url: '/life/meals', icon: 'meals' },
        { title: 'Beauty & self-care', url: '/life/self-care', icon: 'selfCare' }
      ]
    },
    {
      label: 'Dreams',
      items: [
        { title: 'Goals', url: '/life/goals', icon: 'goal' },
        { title: 'Travel', url: '/life/travel', icon: 'travel' },
        { title: 'Journal', url: '/life/journal', icon: 'journal' }
      ]
    }
  ],
  kouture: [
    {
      label: 'Salon',
      items: [
        { title: 'Dashboard', url: '/kouture', icon: 'home' },
        {
          title: 'Appointments',
          url: '/kouture/appointments',
          icon: 'calendarEvent'
        },
        { title: 'Clients', url: '/kouture/clients', icon: 'teams' },
        { title: 'Service menu', url: '/kouture/services', icon: 'services' },
        { title: 'Inventory', url: '/kouture/inventory', icon: 'inventory' }
      ]
    },
    {
      label: 'Money',
      items: [
        { title: 'Revenue & expenses', url: '/kouture/money', icon: 'cash' },
        { title: 'Profit reports', url: '/kouture/reports', icon: 'receipt' },
        { title: 'Analytics', url: '/kouture/analytics', icon: 'analytics' },
        { title: 'Taxes', url: '/kouture/taxes', icon: 'forms' }
      ]
    },
    {
      label: 'Growth',
      items: [
        {
          title: 'Marketing calendar',
          url: '/kouture/marketing',
          icon: 'marketing'
        },
        { title: 'Social planner', url: '/kouture/social', icon: 'social' },
        {
          title: 'Client retention',
          url: '/kouture/retention',
          icon: 'retention'
        },
        { title: 'Policies', url: '/kouture/policies', icon: 'policy' }
      ]
    },
    {
      label: 'AI management team',
      items: [{ title: 'The team', url: '/kouture/team', icon: 'agent' }]
    }
  ]
};

export const SHARED_NAV: NavGroup = {
  label: 'Oversight',
  items: [
    { title: 'Approvals', url: '/approvals', icon: 'approvals' },
    { title: 'Activity log', url: '/activity', icon: 'history' }
  ]
};

export function environmentForPath(pathname: string): Environment {
  return pathname.startsWith('/kouture') ? 'kouture' : 'life';
}
