// Application-level shapes. Repositories map database rows into these, so pages
// and components never depend on table layouts.

export type Domain = 'core' | 'life' | 'kouture';
export type ActorType = 'owner' | 'agent' | 'assistant' | 'system';

export type OwnerProfile = {
  id: string;
  email: string;
  displayName: string;
  businessName: string;
  timezone: string;
};

// ── My Life ────────────────────────────────────────────────────────────────
export type TaskPriority = 'low' | 'normal' | 'high';
export type Task = {
  id: string;
  title: string;
  dueOn: string | null;
  priority: TaskPriority;
  status: 'open' | 'done' | 'archived';
  completedAt: string | null;
};

export type Habit = {
  id: string;
  name: string;
  targetPerWeek: number;
  /** Day keys (YYYY-MM-DD) logged within the requested window. */
  loggedDays: string[];
};

export type LifeEventCategory =
  | 'personal'
  | 'self_care'
  | 'fitness'
  | 'travel'
  | 'social'
  | 'other';
export type LifeEvent = {
  id: string;
  title: string;
  category: LifeEventCategory;
  startsAt: string;
  endsAt: string;
  location: string | null;
};

export type Goal = {
  id: string;
  title: string;
  area: 'personal' | 'health' | 'money' | 'beauty' | 'growth' | 'travel';
  targetValue: number;
  currentValue: number;
  unit: string | null;
  targetDate: string | null;
  status: 'active' | 'achieved' | 'paused';
};

// ── Kouture ────────────────────────────────────────────────────────────────
export type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
export type Appointment = {
  id: string;
  clientId: string | null;
  clientName: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  priceCents: number;
  depositCents: number;
  source: 'nailzy' | 'manual' | 'import';
};

export type PaymentKind = 'deposit' | 'balance' | 'tip' | 'refund';
export type Payment = {
  id: string;
  appointmentId: string | null;
  kind: PaymentKind;
  method: 'stripe' | 'cash' | 'other';
  amountCents: number;
  receivedAt: string;
};

export type ExpenseCategory =
  | 'supplies'
  | 'rent'
  | 'marketing'
  | 'software'
  | 'education'
  | 'equipment'
  | 'fees'
  | 'other';
export type Expense = {
  id: string;
  category: ExpenseCategory;
  vendor: string | null;
  amountCents: number;
  spentOn: string;
};

export type ClientStats = {
  total: number;
  newThisMonth: number;
  /** Clients whose most recent completed visit is older than 60 days. */
  lapsed: number;
};

// ── Core ───────────────────────────────────────────────────────────────────
export type ApprovalActionType =
  | 'send_message'
  | 'publish_content'
  | 'change_appointment'
  | 'issue_refund'
  | 'make_purchase'
  | 'external_financial_access'
  | 'irreversible';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'
  | 'expired';

export type Approval = {
  id: string;
  domain: 'life' | 'kouture';
  requestedBy: string;
  actionType: ApprovalActionType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  risk: 'low' | 'medium' | 'high';
  status: ApprovalStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  occurredAt: string;
  actorType: ActorType;
  actorId: string;
  domain: Domain;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
};

export type DateRange = { from: string; to: string };

export interface LifeRepository {
  listOpenTasks(limit: number): Promise<Task[]>;
  setTaskDone(id: string, done: boolean): Promise<Task>;
  listHabits(window: { fromDay: string; toDay: string }): Promise<Habit[]>;
  setHabitLogged(habitId: string, day: string, logged: boolean): Promise<void>;
  listEvents(range: DateRange): Promise<LifeEvent[]>;
  listActiveGoals(): Promise<Goal[]>;
}

export interface KoutureRepository {
  listAppointments(range: DateRange): Promise<Appointment[]>;
  listPayments(range: DateRange): Promise<Payment[]>;
  listExpenses(range: { fromDay: string; toDay: string }): Promise<Expense[]>;
  clientStats(monthStart: string, lapsedBefore: string): Promise<ClientStats>;
}

export interface CoreRepository {
  getProfile(): Promise<OwnerProfile>;
  listApprovals(filter: { status?: ApprovalStatus; limit?: number }): Promise<Approval[]>;
  countPendingApprovals(): Promise<number>;
  decideApproval(
    id: string,
    decision: 'approved' | 'rejected',
    note: string | null
  ): Promise<Approval>;
  listAudit(filter: { domain?: Domain; limit: number }): Promise<AuditEntry[]>;
}

export type Repositories = {
  life: LifeRepository;
  kouture: KoutureRepository;
  core: CoreRepository;
};
