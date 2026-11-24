import type { FieldSpec } from '@/components/entity/entity-form-dialog';

const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

export const EVENT_CATEGORY_LABEL = {
  personal: 'Personal',
  self_care: 'Self-care',
  fitness: 'Fitness',
  travel: 'Travel',
  social: 'Social',
  other: 'Other'
} as const;

export const WORKOUT_KIND_LABEL = {
  pilates: 'Pilates',
  strength: 'Strength',
  cardio: 'Cardio',
  yoga: 'Yoga',
  walk: 'Walk',
  dance: 'Dance',
  other: 'Other'
} as const;

export const SELFCARE_LABEL = {
  nails: 'Nails',
  hair: 'Hair',
  skin: 'Skin',
  lashes: 'Lashes',
  brows: 'Brows',
  body: 'Body',
  spa: 'Spa',
  wellness: 'Wellness',
  other: 'Other'
} as const;

export const GOAL_AREA_LABEL = {
  personal: 'Personal',
  health: 'Health',
  money: 'Money',
  beauty: 'Beauty',
  growth: 'Growth',
  travel: 'Travel'
} as const;

export const MEAL_SLOT_LABEL = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack'
} as const;

export const TRIP_ITEM_LABEL = {
  flight: 'Flight',
  stay: 'Stay',
  activity: 'Activity',
  dining: 'Dining',
  packing: 'Packing'
} as const;

export const WEEKDAY_LABEL = {
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
  '7': 'Sunday'
} as const;

/** Journal mood scale. Shared by the server page and the client editor. */
export const MOODS = [
  { value: 1, label: 'Heavy' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Steady' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Radiant' }
] as const;

const PRIORITY = opts({ normal: 'Normal', high: 'High', low: 'Low' });
const STATUS3 = opts({ active: 'Active', achieved: 'Achieved', paused: 'Paused' });

export const FORMS = {
  task: [
    { name: 'title', label: 'Task', type: 'text', required: true },
    { name: 'dueOn', label: 'Due', type: 'date', half: true },
    {
      name: 'priority',
      label: 'Priority',
      type: 'select',
      options: PRIORITY,
      required: true,
      half: true
    },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ],
  event: [
    { name: 'title', label: 'What', type: 'text', required: true },
    { name: 'startsAt', label: 'Starts', type: 'datetime', required: true, half: true },
    { name: 'endsAt', label: 'Ends', type: 'datetime', required: true, half: true },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: opts(EVENT_CATEGORY_LABEL),
      required: true,
      half: true
    },
    { name: 'location', label: 'Where', type: 'text', half: true },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ],
  habit: [
    {
      name: 'name',
      label: 'Habit',
      type: 'text',
      required: true,
      placeholder: 'e.g. Drink 80oz water'
    },
    {
      name: 'targetPerWeek',
      label: 'Days per week',
      type: 'number',
      min: 1,
      max: 7,
      required: true,
      half: true
    },
    { name: 'archived', label: 'Archived (hide from today)', type: 'checkbox' }
  ],
  goal: [
    { name: 'title', label: 'Goal', type: 'text', required: true },
    {
      name: 'area',
      label: 'Area',
      type: 'select',
      options: opts(GOAL_AREA_LABEL),
      required: true,
      half: true
    },
    { name: 'unit', label: 'Unit', type: 'text', placeholder: 'books, $, classes…', half: true },
    { name: 'currentValue', label: 'Progress so far', type: 'number', min: 0, half: true },
    { name: 'targetValue', label: 'Target', type: 'number', min: 1, required: true, half: true },
    { name: 'targetDate', label: 'Target date', type: 'date', half: true },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: STATUS3,
      required: true,
      half: true
    }
  ],
  dayPlan: [
    {
      name: 'intention',
      label: 'Intention for the day',
      type: 'text',
      placeholder: 'How do you want to feel?'
    },
    { name: 'priorities', label: 'Top three', type: 'lines', count: 3, placeholder: 'Priority' },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ],
  budgetCategory: [
    { name: 'name', label: 'Category', type: 'text', required: true },
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      options: opts({ expense: 'Spending', income: 'Income' }),
      required: true,
      half: true
    },
    { name: 'monthlyLimitCents', label: 'Monthly budget', type: 'money', half: true },
    { name: 'archived', label: 'Archived', type: 'checkbox' }
  ],
  savingsGoal: [
    { name: 'name', label: 'Saving for', type: 'text', required: true },
    { name: 'targetCents', label: 'Target amount', type: 'money', required: true, half: true },
    { name: 'targetDate', label: 'By', type: 'date', half: true },
    { name: 'status', label: 'Status', type: 'select', options: STATUS3, required: true }
  ],
  contribution: [
    {
      name: 'amountCents',
      label: 'Amount',
      type: 'money',
      allowNegative: true,
      required: true,
      half: true,
      help: 'Use a minus sign for a withdrawal.'
    },
    { name: 'contributedOn', label: 'Date', type: 'date', required: true, half: true },
    { name: 'note', label: 'Note', type: 'text' }
  ],
  workoutLog: [
    { name: 'title', label: 'Workout', type: 'text', required: true },
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      options: opts(WORKOUT_KIND_LABEL),
      required: true,
      half: true
    },
    { name: 'performedOn', label: 'Date', type: 'date', required: true, half: true },
    {
      name: 'durationMinutes',
      label: 'Minutes',
      type: 'number',
      min: 1,
      max: 600,
      required: true,
      half: true
    },
    {
      name: 'intensity',
      label: 'Intensity',
      type: 'select',
      options: opts({ easy: 'Easy', moderate: 'Moderate', hard: 'Hard' }),
      required: true,
      half: true
    },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ],
  workoutPlan: [
    { name: 'title', label: 'Session', type: 'text', required: true },
    {
      name: 'weekday',
      label: 'Day',
      type: 'select',
      options: opts(WEEKDAY_LABEL),
      required: true,
      half: true,
      numeric: true
    },
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      options: opts(WORKOUT_KIND_LABEL),
      required: true,
      half: true
    },
    {
      name: 'durationMinutes',
      label: 'Minutes',
      type: 'number',
      min: 1,
      max: 600,
      required: true,
      half: true
    },
    {
      name: 'exercises',
      label: 'Exercises (one per line)',
      type: 'textarea',
      placeholder: 'Hip thrusts 4×10'
    }
  ],
  meal: [
    { name: 'title', label: 'Meal', type: 'text', required: true },
    { name: 'day', label: 'Day', type: 'date', required: true, half: true },
    {
      name: 'slot',
      label: 'When',
      type: 'select',
      options: opts(MEAL_SLOT_LABEL),
      required: true,
      half: true
    },
    { name: 'notes', label: 'Notes or recipe link', type: 'textarea' }
  ],
  grocery: [
    { name: 'name', label: 'Item', type: 'text', required: true, half: true },
    { name: 'quantity', label: 'Quantity', type: 'text', half: true }
  ],
  trip: [
    { name: 'name', label: 'Trip', type: 'text', required: true },
    { name: 'destination', label: 'Destination', type: 'text', required: true },
    { name: 'startsOn', label: 'Depart', type: 'date', required: true, half: true },
    { name: 'endsOn', label: 'Return', type: 'date', required: true, half: true },
    { name: 'budgetCents', label: 'Budget', type: 'money', half: true },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: opts({ planning: 'Planning', booked: 'Booked', done: 'Done' }),
      required: true,
      half: true
    },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ],
  tripItem: [
    { name: 'title', label: 'Item', type: 'text', required: true },
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      options: opts(TRIP_ITEM_LABEL),
      required: true,
      half: true
    },
    { name: 'onDay', label: 'Day', type: 'date', half: true },
    { name: 'costCents', label: 'Cost', type: 'money', half: true },
    { name: 'done', label: 'Booked / packed', type: 'checkbox' }
  ],
  selfcare: [
    { name: 'name', label: 'Routine', type: 'text', required: true, placeholder: 'e.g. Lash fill' },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: opts(SELFCARE_LABEL),
      required: true,
      half: true
    },
    {
      name: 'everyDays',
      label: 'Every (days)',
      type: 'number',
      min: 1,
      max: 365,
      required: true,
      half: true
    },
    { name: 'lastDoneOn', label: 'Last done', type: 'date', half: true },
    { name: 'provider', label: 'With / where', type: 'text', half: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'archived', label: 'Archived', type: 'checkbox' }
  ]
} satisfies Record<string, FieldSpec[]>;

export function categoryOptions(
  categories: { id: string; name: string; kind: string; archived: boolean }[]
) {
  return categories.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }));
}

export function transactionFields(categories: { value: string; label: string }[]): FieldSpec[] {
  return [
    { name: 'description', label: 'Description', type: 'text', required: true },
    { name: 'amountCents', label: 'Amount', type: 'money', required: true, half: true },
    { name: 'occurredOn', label: 'Date', type: 'date', required: true, half: true },
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'expense', label: 'Spending' },
        { value: 'income', label: 'Income' }
      ],
      required: true,
      half: true
    },
    { name: 'categoryId', label: 'Category', type: 'select', options: categories, half: true }
  ];
}
