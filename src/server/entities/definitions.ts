import { z } from 'zod';

// One definition per record type: where it lives, what a stored row looks
// like (camelCase), and what may be written. Both the Supabase and the
// sample-data implementations use these, so validation is identical in both.

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.');
const dateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Choose a valid date and time.');
const cents = z.number().int('Use whole cents.').min(0).max(100_000_000);

function text(max: number, label = 'This') {
  return z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);
}
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, 'Too long.')
    .nullish()
    .transform((v) => (v ? v : null));
}
const optionalDate = dateKey.nullish().transform((v) => v ?? null);
const optionalCents = cents.nullish().transform((v) => v ?? null);

const id = z.string().min(1);
const num = z.coerce.number();
const nullableNum = z.coerce.number().nullable();

export const WORKOUT_KINDS = [
  'strength',
  'cardio',
  'pilates',
  'yoga',
  'walk',
  'dance',
  'other'
] as const;
export const SELFCARE_CATEGORIES = [
  'nails',
  'hair',
  'skin',
  'lashes',
  'brows',
  'body',
  'spa',
  'wellness',
  'other'
] as const;
export const EVENT_CATEGORIES = [
  'personal',
  'self_care',
  'fitness',
  'travel',
  'social',
  'other'
] as const;
export const GOAL_AREAS = ['personal', 'health', 'money', 'beauty', 'growth', 'travel'] as const;
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const TRIP_ITEM_KINDS = ['flight', 'stay', 'activity', 'dining', 'packing'] as const;

export const APPOINTMENT_STATUSES = [
  'booked',
  'confirmed',
  'completed',
  'no_show',
  'cancelled'
] as const;
export const SERVICE_CATEGORIES = [
  'manicure',
  'extensions',
  'fill',
  'pedicure',
  'nail_art',
  'removal',
  'add_on',
  'other'
] as const;
export const EXPENSE_CATEGORIES = [
  'supplies',
  'rent',
  'marketing',
  'software',
  'education',
  'equipment',
  'fees',
  'other'
] as const;
export const INVENTORY_CATEGORIES = [
  'gel',
  'acrylic',
  'polish',
  'tools',
  'nail_art',
  'disposables',
  'sanitation',
  'retail',
  'other'
] as const;
export const MARKETING_CHANNELS = [
  'instagram',
  'tiktok',
  'facebook',
  'sms',
  'email',
  'in_salon',
  'other'
] as const;
export const MARKETING_KINDS = [
  'post',
  'reel',
  'story',
  'campaign',
  'promo',
  'message',
  'event'
] as const;
export const EMAIL_AUDIENCES = ['all', 'due', 'lapsed', 'birthdays'] as const;
export const MARKETING_STATUSES = ['idea', 'drafting', 'ready', 'scheduled', 'published'] as const;

const optionalId = z
  .string()
  .nullish()
  .transform((v) => v || null);
const nullableDateTime = dateTime.nullish().transform((v) => v ?? null);

function entity<TRow extends z.ZodObject, TInput extends z.ZodObject>(def: {
  schema: 'life' | 'kouture';
  table: string;
  row: TRow;
  input: TInput;
  label: (row: z.infer<TRow>) => string;
  /** App paths whose data changes when this entity changes. */
  paths: string[];
  /** Unique key used for "save for this day" style upserts. */
  uniqueBy?: (keyof z.infer<TInput> & string)[];
  /** Foreign keys, mirrored by the sample-data store (the database enforces them itself). */
  refs?: Partial<
    Record<keyof z.infer<TInput> & string, { entity: string; onDelete: 'cascade' | 'setNull' }>
  >;
}) {
  return def;
}

export const ENTITIES = {
  'life.tasks': entity({
    schema: 'life',
    table: 'tasks',
    row: z.object({
      id,
      title: z.string(),
      notes: z.string().nullable(),
      dueOn: z.string().nullable(),
      priority: z.enum(['low', 'normal', 'high']),
      status: z.enum(['open', 'done', 'archived']),
      completedAt: z.string().nullable()
    }),
    input: z.object({
      title: text(300, 'Title'),
      notes: optionalText(2000),
      dueOn: optionalDate,
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
      status: z.enum(['open', 'done', 'archived']).default('open'),
      completedAt: dateTime.nullish().transform((v) => v ?? null)
    }),
    label: (r) => r.title,
    paths: ['/life', '/life/tasks', '/life/planner']
  }),
  'life.events': entity({
    schema: 'life',
    table: 'events',
    row: z.object({
      id,
      title: z.string(),
      category: z.enum(EVENT_CATEGORIES),
      startsAt: z.string(),
      endsAt: z.string(),
      location: z.string().nullable(),
      notes: z.string().nullable()
    }),
    input: z
      .object({
        title: text(200, 'Title'),
        category: z.enum(EVENT_CATEGORIES).default('personal'),
        startsAt: dateTime,
        endsAt: dateTime,
        location: optionalText(200),
        notes: optionalText(2000)
      })
      .refine((v) => Date.parse(v.endsAt) >= Date.parse(v.startsAt), {
        message: 'End must be after the start.',
        path: ['endsAt']
      }),
    label: (r) => r.title,
    paths: ['/life', '/life/calendar', '/life/planner']
  }),
  'life.habits': entity({
    schema: 'life',
    table: 'habits',
    row: z.object({
      id,
      name: z.string(),
      targetPerWeek: num,
      sortOrder: num,
      archived: z.boolean()
    }),
    input: z.object({
      name: text(120, 'Name'),
      targetPerWeek: z.number().int().min(1).max(7).default(7),
      sortOrder: z.number().int().min(0).max(1000).default(0),
      archived: z.boolean().default(false)
    }),
    label: (r) => r.name,
    paths: ['/life', '/life/habits']
  }),
  'life.habit_logs': entity({
    schema: 'life',
    table: 'habit_logs',
    row: z.object({ id, habitId: z.string(), loggedOn: z.string() }),
    input: z.object({ habitId: id, loggedOn: dateKey }),
    label: (r) => r.loggedOn,
    paths: ['/life', '/life/habits'],
    uniqueBy: ['habitId', 'loggedOn'],
    refs: { habitId: { entity: 'life.habits', onDelete: 'cascade' } }
  }),
  'life.goals': entity({
    schema: 'life',
    table: 'goals',
    row: z.object({
      id,
      title: z.string(),
      area: z.enum(GOAL_AREAS),
      targetValue: num,
      currentValue: num,
      unit: z.string().nullable(),
      targetDate: z.string().nullable(),
      status: z.enum(['active', 'achieved', 'paused'])
    }),
    input: z.object({
      title: text(200, 'Title'),
      area: z.enum(GOAL_AREAS).default('personal'),
      targetValue: z.number().positive('Target must be above zero.').max(1e9),
      currentValue: z.number().min(0).max(1e9).default(0),
      unit: optionalText(20),
      targetDate: optionalDate,
      status: z.enum(['active', 'achieved', 'paused']).default('active')
    }),
    label: (r) => r.title,
    paths: ['/life', '/life/goals']
  }),
  'life.day_plans': entity({
    schema: 'life',
    table: 'day_plans',
    row: z.object({
      id,
      day: z.string(),
      intention: z.string().nullable(),
      priorities: z.array(z.string()),
      notes: z.string().nullable()
    }),
    input: z.object({
      day: dateKey,
      intention: optionalText(280),
      priorities: z
        .array(z.string().trim().max(160))
        .max(3)
        .default([])
        .transform((a) => a.filter(Boolean)),
      notes: optionalText(5000)
    }),
    label: (r) => r.day,
    paths: ['/life/planner'],
    uniqueBy: ['day']
  }),
  'life.budget_categories': entity({
    schema: 'life',
    table: 'budget_categories',
    row: z.object({
      id,
      name: z.string(),
      kind: z.enum(['expense', 'income']),
      monthlyLimitCents: nullableNum,
      sortOrder: num,
      archived: z.boolean()
    }),
    input: z.object({
      name: text(80, 'Name'),
      kind: z.enum(['expense', 'income']).default('expense'),
      monthlyLimitCents: optionalCents,
      sortOrder: z.number().int().min(0).max(1000).default(0),
      archived: z.boolean().default(false)
    }),
    label: (r) => r.name,
    paths: ['/life/budget']
  }),
  'life.transactions': entity({
    schema: 'life',
    table: 'transactions',
    row: z.object({
      id,
      occurredOn: z.string(),
      kind: z.enum(['expense', 'income']),
      amountCents: num,
      categoryId: z.string().nullable(),
      description: z.string()
    }),
    input: z.object({
      occurredOn: dateKey,
      kind: z.enum(['expense', 'income']).default('expense'),
      amountCents: cents.min(1, 'Enter an amount.'),
      categoryId: z
        .string()
        .nullish()
        .transform((v) => v || null),
      description: text(200, 'Description')
    }),
    label: (r) => r.description,
    paths: ['/life/budget'],
    refs: { categoryId: { entity: 'life.budget_categories', onDelete: 'setNull' } }
  }),
  'life.savings_goals': entity({
    schema: 'life',
    table: 'savings_goals',
    row: z.object({
      id,
      name: z.string(),
      targetCents: num,
      targetDate: z.string().nullable(),
      status: z.enum(['active', 'achieved', 'paused'])
    }),
    input: z.object({
      name: text(120, 'Name'),
      targetCents: cents.min(1, 'Enter a target.'),
      targetDate: optionalDate,
      status: z.enum(['active', 'achieved', 'paused']).default('active')
    }),
    label: (r) => r.name,
    paths: ['/life/savings']
  }),
  'life.savings_contributions': entity({
    schema: 'life',
    table: 'savings_contributions',
    row: z.object({
      id,
      goalId: z.string(),
      amountCents: num,
      contributedOn: z.string(),
      note: z.string().nullable()
    }),
    input: z.object({
      goalId: id,
      amountCents: z
        .number()
        .int()
        .min(-100_000_000)
        .max(100_000_000)
        .refine((v) => v !== 0, 'Enter an amount.'),
      contributedOn: dateKey,
      note: optionalText(200)
    }),
    label: (r) => r.contributedOn,
    paths: ['/life/savings'],
    refs: { goalId: { entity: 'life.savings_goals', onDelete: 'cascade' } }
  }),
  'life.workout_logs': entity({
    schema: 'life',
    table: 'workout_logs',
    row: z.object({
      id,
      performedOn: z.string(),
      kind: z.enum(WORKOUT_KINDS),
      title: z.string(),
      durationMinutes: num,
      intensity: z.enum(['easy', 'moderate', 'hard']),
      notes: z.string().nullable()
    }),
    input: z.object({
      performedOn: dateKey,
      kind: z.enum(WORKOUT_KINDS),
      title: text(120, 'Title'),
      durationMinutes: z.number().int().min(1, 'Add a duration.').max(600),
      intensity: z.enum(['easy', 'moderate', 'hard']).default('moderate'),
      notes: optionalText(2000)
    }),
    label: (r) => r.title,
    paths: ['/life/fitness', '/life/workouts']
  }),
  'life.workout_plans': entity({
    schema: 'life',
    table: 'workout_plans',
    row: z.object({
      id,
      weekday: num,
      kind: z.enum(WORKOUT_KINDS),
      title: z.string(),
      durationMinutes: num,
      exercises: z.string().nullable()
    }),
    input: z.object({
      weekday: z.number().int().min(1).max(7),
      kind: z.enum(WORKOUT_KINDS),
      title: text(120, 'Title'),
      durationMinutes: z.number().int().min(1, 'Add a duration.').max(600),
      exercises: optionalText(2000)
    }),
    label: (r) => r.title,
    paths: ['/life/workouts']
  }),
  'life.meals': entity({
    schema: 'life',
    table: 'meals',
    row: z.object({
      id,
      day: z.string(),
      slot: z.enum(MEAL_SLOTS),
      title: z.string(),
      notes: z.string().nullable()
    }),
    input: z.object({
      day: dateKey,
      slot: z.enum(MEAL_SLOTS),
      title: text(120, 'Meal'),
      notes: optionalText(1000)
    }),
    label: (r) => r.title,
    paths: ['/life/meals']
  }),
  'life.grocery_items': entity({
    schema: 'life',
    table: 'grocery_items',
    row: z.object({ id, name: z.string(), quantity: z.string().nullable(), checked: z.boolean() }),
    input: z.object({
      name: text(120, 'Item'),
      quantity: optionalText(40),
      checked: z.boolean().default(false)
    }),
    label: (r) => r.name,
    paths: ['/life/meals']
  }),
  'life.trips': entity({
    schema: 'life',
    table: 'trips',
    row: z.object({
      id,
      name: z.string(),
      destination: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
      budgetCents: nullableNum,
      status: z.enum(['planning', 'booked', 'done']),
      notes: z.string().nullable()
    }),
    input: z
      .object({
        name: text(120, 'Trip name'),
        destination: text(120, 'Destination'),
        startsOn: dateKey,
        endsOn: dateKey,
        budgetCents: optionalCents,
        status: z.enum(['planning', 'booked', 'done']).default('planning'),
        notes: optionalText(5000)
      })
      .refine((v) => v.endsOn >= v.startsOn, {
        message: 'Return must be after departure.',
        path: ['endsOn']
      }),
    label: (r) => r.name,
    paths: ['/life/travel']
  }),
  'life.trip_items': entity({
    schema: 'life',
    table: 'trip_items',
    row: z.object({
      id,
      tripId: z.string(),
      kind: z.enum(TRIP_ITEM_KINDS),
      title: z.string(),
      onDay: z.string().nullable(),
      costCents: nullableNum,
      done: z.boolean()
    }),
    input: z.object({
      tripId: id,
      kind: z.enum(TRIP_ITEM_KINDS),
      title: text(160, 'Item'),
      onDay: optionalDate,
      costCents: optionalCents,
      done: z.boolean().default(false)
    }),
    label: (r) => r.title,
    paths: ['/life/travel'],
    refs: { tripId: { entity: 'life.trips', onDelete: 'cascade' } }
  }),
  'life.selfcare_routines': entity({
    schema: 'life',
    table: 'selfcare_routines',
    row: z.object({
      id,
      name: z.string(),
      category: z.enum(SELFCARE_CATEGORIES),
      everyDays: num,
      lastDoneOn: z.string().nullable(),
      provider: z.string().nullable(),
      notes: z.string().nullable(),
      archived: z.boolean()
    }),
    input: z.object({
      name: text(120, 'Name'),
      category: z.enum(SELFCARE_CATEGORIES),
      everyDays: z.number().int().min(1, 'At least every day.').max(365),
      lastDoneOn: optionalDate,
      provider: optionalText(120),
      notes: optionalText(1000),
      archived: z.boolean().default(false)
    }),
    label: (r) => r.name,
    paths: ['/life/self-care', '/life']
  }),
  'life.journal_entries': entity({
    schema: 'life',
    table: 'journal_entries',
    row: z.object({
      id,
      entryOn: z.string(),
      mood: nullableNum,
      title: z.string().nullable(),
      body: z.string().nullable(),
      gratitude: z.string().nullable()
    }),
    input: z.object({
      entryOn: dateKey,
      mood: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullish()
        .transform((v) => v ?? null),
      title: optionalText(160),
      body: optionalText(20000),
      gratitude: optionalText(2000)
    }),
    // Never echo journal contents into logs.
    label: (r) => r.entryOn,
    paths: ['/life/journal'],
    uniqueBy: ['entryOn']
  }),

  // ── Kouture Nail Bar ──────────────────────────────────────────────────────
  'kouture.clients': entity({
    schema: 'kouture',
    table: 'clients',
    row: z.object({
      id,
      fullName: z.string(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
      instagram: z.string().nullable(),
      birthday: z.string().nullable(),
      allergies: z.string().nullable(),
      notes: z.string().nullable(),
      source: z.enum(['manual', 'nailzy', 'import']),
      smsMarketingConsentAt: z.string().nullable(),
      emailMarketingConsentAt: z.string().nullable(),
      smsOptedOutAt: z.string().nullable(),
      emailOptedOutAt: z.string().nullable(),
      createdAt: z.string()
    }),
    input: z.object({
      fullName: text(160, 'Name'),
      phone: optionalText(40),
      email: z
        .email('Enter a valid email.')
        .nullish()
        .or(z.literal(''))
        .transform((v) => v || null),
      instagram: optionalText(60),
      birthday: optionalDate,
      allergies: optionalText(500),
      notes: optionalText(4000),
      source: z.enum(['manual', 'nailzy', 'import']).default('manual'),
      smsMarketingConsentAt: nullableDateTime,
      emailMarketingConsentAt: nullableDateTime,
      smsOptedOutAt: nullableDateTime,
      emailOptedOutAt: nullableDateTime
    }),
    label: (r) => r.fullName,
    paths: ['/kouture', '/kouture/clients', '/kouture/retention']
  }),
  'kouture.client_notes': entity({
    schema: 'kouture',
    table: 'client_notes',
    row: z.object({ id, clientId: z.string(), body: z.string(), createdAt: z.string() }),
    input: z.object({ clientId: id, body: text(4000, 'Note') }),
    // Client notes can be sensitive (allergies, health); never echo them into logs.
    label: () => 'note',
    paths: ['/kouture/clients'],
    refs: { clientId: { entity: 'kouture.clients', onDelete: 'cascade' } }
  }),
  'kouture.services': entity({
    schema: 'kouture',
    table: 'services',
    row: z.object({
      id,
      name: z.string(),
      category: z.string(),
      description: z.string().nullable(),
      durationMinutes: num,
      priceCents: num,
      depositCents: num,
      active: z.boolean()
    }),
    input: z
      .object({
        name: text(120, 'Name'),
        category: z.enum(SERVICE_CATEGORIES).default('manicure'),
        description: optionalText(1000),
        durationMinutes: z.number().int().min(5, 'At least 5 minutes.').max(600),
        priceCents: cents,
        depositCents: cents.default(0),
        active: z.boolean().default(true)
      })
      .refine((v) => v.depositCents <= v.priceCents, {
        message: 'Deposit can’t be more than the price.',
        path: ['depositCents']
      }),
    label: (r) => r.name,
    paths: ['/kouture/services', '/kouture/appointments']
  }),
  'kouture.appointments': entity({
    schema: 'kouture',
    table: 'appointments',
    row: z.object({
      id,
      clientId: z.string().nullable(),
      serviceId: z.string().nullable(),
      clientLabel: z.string().nullable(),
      serviceLabel: z.string().nullable(),
      startsAt: z.string(),
      endsAt: z.string(),
      status: z.enum(APPOINTMENT_STATUSES),
      priceCents: num,
      depositCents: num,
      source: z.enum(['nailzy', 'manual', 'import']),
      externalRef: z.string().nullable(),
      notes: z.string().nullable()
    }),
    input: z
      .object({
        clientId: optionalId,
        serviceId: optionalId,
        clientLabel: optionalText(160),
        serviceLabel: optionalText(400),
        startsAt: dateTime,
        endsAt: dateTime,
        status: z.enum(APPOINTMENT_STATUSES).default('booked'),
        priceCents: cents.default(0),
        depositCents: cents.default(0),
        source: z.enum(['nailzy', 'manual', 'import']).default('manual'),
        externalRef: optionalText(300),
        notes: optionalText(2000)
      })
      .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), {
        message: 'End must be after the start.',
        path: ['endsAt']
      }),
    label: (r) => r.clientLabel ?? 'Appointment',
    paths: ['/kouture', '/kouture/appointments', '/kouture/clients', '/kouture/money'],
    refs: {
      clientId: { entity: 'kouture.clients', onDelete: 'setNull' },
      serviceId: { entity: 'kouture.services', onDelete: 'setNull' }
    }
  }),
  'kouture.payments': entity({
    schema: 'kouture',
    table: 'payments',
    row: z.object({
      id,
      appointmentId: z.string().nullable(),
      clientId: z.string().nullable(),
      kind: z.enum(['deposit', 'balance', 'tip', 'refund']),
      method: z.enum(['stripe', 'cash', 'other']),
      amountCents: num,
      receivedAt: z.string(),
      notes: z.string().nullable()
    }),
    input: z.object({
      appointmentId: optionalId,
      clientId: optionalId,
      kind: z.enum(['deposit', 'balance', 'tip', 'refund']),
      method: z.enum(['stripe', 'cash', 'other']).default('cash'),
      amountCents: cents.min(1, 'Enter an amount.'),
      receivedAt: dateTime,
      notes: optionalText(500)
    }),
    label: (r) => `${r.kind} ${(r.amountCents / 100).toFixed(2)}`,
    paths: ['/kouture', '/kouture/money', '/kouture/appointments'],
    refs: {
      appointmentId: { entity: 'kouture.appointments', onDelete: 'setNull' },
      clientId: { entity: 'kouture.clients', onDelete: 'setNull' }
    }
  }),
  'kouture.expenses': entity({
    schema: 'kouture',
    table: 'expenses',
    row: z.object({
      id,
      category: z.enum(EXPENSE_CATEGORIES),
      vendor: z.string().nullable(),
      description: z.string().nullable(),
      amountCents: num,
      spentOn: z.string()
    }),
    input: z.object({
      category: z.enum(EXPENSE_CATEGORIES),
      vendor: optionalText(120),
      description: optionalText(300),
      amountCents: cents.min(1, 'Enter an amount.'),
      spentOn: dateKey
    }),
    label: (r) => r.vendor ?? r.description ?? r.category,
    paths: ['/kouture', '/kouture/money']
  }),
  'kouture.inventory_items': entity({
    schema: 'kouture',
    table: 'inventory_items',
    row: z.object({
      id,
      name: z.string(),
      category: z.enum(INVENTORY_CATEGORIES),
      unit: z.string(),
      onHand: num,
      reorderAt: num,
      unitCostCents: nullableNum,
      supplier: z.string().nullable(),
      notes: z.string().nullable(),
      archived: z.boolean()
    }),
    input: z.object({
      name: text(120, 'Name'),
      category: z.enum(INVENTORY_CATEGORIES).default('other'),
      unit: text(20, 'Unit').default('unit'),
      onHand: z.number().min(0, 'Stock can’t be negative.').max(100_000),
      reorderAt: z.number().min(0).max(100_000).default(0),
      unitCostCents: optionalCents,
      supplier: optionalText(120),
      notes: optionalText(1000),
      archived: z.boolean().default(false)
    }),
    label: (r) => r.name,
    paths: ['/kouture/inventory']
  }),
  'kouture.marketing_items': entity({
    schema: 'kouture',
    table: 'marketing_items',
    row: z.object({
      id,
      title: z.string(),
      channel: z.enum(MARKETING_CHANNELS),
      kind: z.enum(MARKETING_KINDS),
      scheduledOn: z.string().nullable(),
      status: z.enum(MARKETING_STATUSES),
      caption: z.string().nullable(),
      notes: z.string().nullable()
    }),
    input: z.object({
      title: text(160, 'Title'),
      channel: z.enum(MARKETING_CHANNELS),
      kind: z.enum(MARKETING_KINDS),
      scheduledOn: optionalDate,
      status: z.enum(MARKETING_STATUSES).default('idea'),
      caption: optionalText(2200),
      notes: optionalText(2000)
    }),
    label: (r) => r.title,
    paths: ['/kouture/marketing', '/kouture/social']
  }),
  'kouture.policies': entity({
    schema: 'kouture',
    table: 'policies',
    row: z.object({ id, title: z.string(), body: z.string(), sortOrder: num }),
    input: z.object({
      title: text(120, 'Title'),
      body: text(5000, 'Policy'),
      sortOrder: z.number().int().min(0).max(1000).default(0)
    }),
    label: (r) => r.title,
    paths: ['/kouture/policies']
  }),
  'kouture.tax_payments': entity({
    schema: 'kouture',
    table: 'tax_payments',
    row: z.object({
      id,
      taxYear: num,
      quarter: num,
      jurisdiction: z.enum(['federal', 'state']),
      amountCents: num,
      paidOn: z.string(),
      note: z.string().nullable()
    }),
    input: z.object({
      taxYear: z.number().int().min(2000).max(2100),
      quarter: z.number().int().min(1).max(4),
      jurisdiction: z.enum(['federal', 'state']).default('federal'),
      amountCents: cents.min(1, 'Enter an amount.'),
      paidOn: dateKey,
      note: optionalText(300)
    }),
    label: (r) => `${r.jurisdiction} Q${r.quarter} ${r.taxYear}`,
    paths: ['/kouture/taxes']
  }),
  'kouture.email_campaigns': entity({
    schema: 'kouture',
    table: 'email_campaigns',
    row: z.object({
      id,
      title: z.string(),
      subject: z.string(),
      body: z.string(),
      audience: z.enum(EMAIL_AUDIENCES),
      status: z.enum(['draft', 'sent']),
      sentAt: z.string().nullable(),
      recipientCount: nullableNum,
      createdAt: z.string()
    }),
    input: z.object({
      title: text(120, 'Name'),
      subject: text(200, 'Subject'),
      body: text(10000, 'Message'),
      audience: z.enum(EMAIL_AUDIENCES).default('all'),
      status: z.enum(['draft', 'sent']).default('draft'),
      sentAt: nullableDateTime,
      recipientCount: z
        .number()
        .int()
        .min(0)
        .nullish()
        .transform((v) => v ?? null)
    }),
    label: (r) => r.title,
    paths: ['/kouture/email']
  }),
  'kouture.business_profile': entity({
    schema: 'kouture',
    table: 'business_profile',
    row: z.object({ id, postalAddress: z.string().nullable() }),
    input: z.object({ postalAddress: optionalText(300) }),
    label: () => 'business details',
    paths: ['/kouture/email'],
    uniqueBy: []
  }),
  'kouture.sync_runs': entity({
    schema: 'kouture',
    table: 'sync_runs',
    row: z.object({
      id,
      source: z.enum(['nailzy_calendar']),
      ranAt: z.string(),
      ok: z.boolean(),
      added: num,
      updated: num,
      cancelled: num,
      skipped: num,
      message: z.string().nullable()
    }),
    input: z.object({
      source: z.enum(['nailzy_calendar']),
      ranAt: dateTime,
      ok: z.boolean(),
      added: z.number().int().min(0).default(0),
      updated: z.number().int().min(0).default(0),
      cancelled: z.number().int().min(0).default(0),
      skipped: z.number().int().min(0).default(0),
      message: optionalText(500)
    }),
    label: (r) => (r.ok ? 'Nailzy calendar synced' : 'Nailzy calendar sync failed'),
    paths: ['/kouture/appointments', '/kouture']
  })
};

export type EntityKey = keyof typeof ENTITIES;
export type EntityDef<K extends EntityKey> = (typeof ENTITIES)[K];
export type RowOf<K extends EntityKey> = z.infer<EntityDef<K>['row']>;
export type InputOf<K extends EntityKey> = z.input<EntityDef<K>['input']>;
export type CleanInputOf<K extends EntityKey> = z.output<EntityDef<K>['input']>;

export function isEntityKey(value: string): value is EntityKey {
  return Object.prototype.hasOwnProperty.call(ENTITIES, value);
}
