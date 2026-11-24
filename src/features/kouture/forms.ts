import type { FieldSpec } from '@/components/entity/entity-form-dialog';

const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

export const APPOINTMENT_STATUS_LABEL = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  completed: 'Completed',
  no_show: 'No-show',
  cancelled: 'Cancelled'
} as const;

export const SERVICE_CATEGORY_LABEL = {
  manicure: 'Manicures',
  extensions: 'Extensions',
  fill: 'Fills',
  pedicure: 'Pedicures',
  nail_art: 'Nail art',
  removal: 'Removal',
  add_on: 'Add-ons',
  other: 'Other'
} as const;

export const EXPENSE_CATEGORY_LABEL = {
  supplies: 'Supplies',
  rent: 'Rent',
  marketing: 'Marketing',
  software: 'Software',
  education: 'Education',
  equipment: 'Equipment',
  fees: 'Fees',
  other: 'Other'
} as const;

export const PAYMENT_KIND_LABEL = {
  deposit: 'Deposit',
  balance: 'Balance',
  tip: 'Tip',
  refund: 'Refund'
} as const;

export const PAYMENT_METHOD_LABEL = {
  cash: 'Cash',
  stripe: 'Card (Stripe)',
  other: 'Other'
} as const;

export const INVENTORY_CATEGORY_LABEL = {
  gel: 'Gel',
  acrylic: 'Acrylic',
  polish: 'Polish',
  tools: 'Tools',
  nail_art: 'Nail art',
  disposables: 'Disposables',
  sanitation: 'Sanitation',
  retail: 'Retail',
  other: 'Other'
} as const;

export const MARKETING_CHANNEL_LABEL = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  sms: 'Text message',
  email: 'Email',
  in_salon: 'In salon',
  other: 'Other'
} as const;
export const SOCIAL_CHANNELS = ['instagram', 'tiktok', 'facebook'] as const;

export const MARKETING_KIND_LABEL = {
  post: 'Post',
  reel: 'Reel / video',
  story: 'Story',
  campaign: 'Campaign',
  promo: 'Promo',
  message: 'Client message',
  event: 'Event'
} as const;

export const MARKETING_STATUS_LABEL = {
  idea: 'Idea',
  drafting: 'Drafting',
  ready: 'Ready',
  scheduled: 'Scheduled',
  published: 'Published'
} as const;

type Option = { value: string; label: string };

export const FORMS = {
  client: [
    { name: 'fullName', label: 'Name', type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'text', half: true },
    { name: 'email', label: 'Email', type: 'text', half: true },
    { name: 'instagram', label: 'Instagram', type: 'text', placeholder: '@handle', half: true },
    { name: 'birthday', label: 'Birthday', type: 'date', half: true },
    {
      name: 'allergies',
      label: 'Allergies & sensitivities',
      type: 'text',
      placeholder: 'e.g. HEMA, latex'
    },
    {
      name: 'notes',
      label: 'Preferences',
      type: 'textarea',
      placeholder: 'Shape, length, colours…'
    }
  ],
  service: [
    { name: 'name', label: 'Service', type: 'text', required: true },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: opts(SERVICE_CATEGORY_LABEL),
      required: true,
      half: true
    },
    {
      name: 'durationMinutes',
      label: 'Minutes',
      type: 'number',
      required: true,
      min: 5,
      max: 600,
      half: true
    },
    { name: 'priceCents', label: 'Price', type: 'money', required: true, half: true },
    {
      name: 'depositCents',
      label: 'Deposit',
      type: 'money',
      half: true,
      help: 'Taken by card at booking'
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      help: 'Use the exact name from Nailzy so calendar bookings match this service.'
    },
    { name: 'active', label: 'Offered on the menu', type: 'checkbox' }
  ],
  expense: [
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: opts(EXPENSE_CATEGORY_LABEL),
      required: true,
      half: true
    },
    { name: 'amountCents', label: 'Amount', type: 'money', required: true, half: true },
    { name: 'vendor', label: 'Paid to', type: 'text', half: true },
    { name: 'spentOn', label: 'Date', type: 'date', required: true, half: true },
    { name: 'description', label: 'What for', type: 'text' }
  ],
  payment: [
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      options: opts(PAYMENT_KIND_LABEL),
      required: true,
      half: true
    },
    {
      name: 'method',
      label: 'Paid by',
      type: 'select',
      options: opts(PAYMENT_METHOD_LABEL),
      required: true,
      half: true
    },
    { name: 'amountCents', label: 'Amount', type: 'money', required: true, half: true },
    { name: 'receivedAt', label: 'Received', type: 'datetime', required: true, half: true },
    { name: 'notes', label: 'Note', type: 'text' }
  ],
  inventory: [
    { name: 'name', label: 'Item', type: 'text', required: true },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: opts(INVENTORY_CATEGORY_LABEL),
      required: true,
      half: true
    },
    {
      name: 'unit',
      label: 'Counted in',
      type: 'text',
      placeholder: 'jar, bottle, box',
      half: true
    },
    { name: 'onHand', label: 'On hand', type: 'number', required: true, min: 0, half: true },
    {
      name: 'reorderAt',
      label: 'Reorder at',
      type: 'number',
      min: 0,
      half: true,
      help: 'Flag as low at or below this'
    },
    { name: 'unitCostCents', label: 'Cost each', type: 'money', half: true },
    { name: 'supplier', label: 'Supplier', type: 'text', half: true },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ],
  marketing: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    {
      name: 'channel',
      label: 'Channel',
      type: 'select',
      options: opts(MARKETING_CHANNEL_LABEL),
      required: true,
      half: true
    },
    {
      name: 'kind',
      label: 'Type',
      type: 'select',
      options: opts(MARKETING_KIND_LABEL),
      required: true,
      half: true
    },
    { name: 'scheduledOn', label: 'Date', type: 'date', half: true },
    {
      name: 'status',
      label: 'Stage',
      type: 'select',
      options: opts(MARKETING_STATUS_LABEL),
      required: true,
      half: true
    },
    { name: 'caption', label: 'Caption / message', type: 'textarea' },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ],
  policy: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'body', label: 'Policy', type: 'textarea', required: true }
  ]
} satisfies Record<string, FieldSpec[]>;

export function appointmentFields(clients: Option[], services: Option[]): FieldSpec[] {
  return [
    { name: 'clientId', label: 'Client', type: 'select', options: clients, half: true },
    { name: 'serviceId', label: 'Service', type: 'select', options: services, half: true },
    { name: 'startsAt', label: 'Starts', type: 'datetime', required: true, half: true },
    { name: 'endsAt', label: 'Ends', type: 'datetime', required: true, half: true },
    { name: 'priceCents', label: 'Price', type: 'money', required: true, half: true },
    { name: 'depositCents', label: 'Deposit', type: 'money', half: true },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: opts(APPOINTMENT_STATUS_LABEL),
      required: true,
      half: true
    },
    { name: 'clientLabel', label: 'Or a name (walk-in)', type: 'text', half: true },
    { name: 'notes', label: 'Notes', type: 'textarea' }
  ];
}
