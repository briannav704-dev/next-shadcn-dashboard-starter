import 'server-only';

import { addDays, startOfDayInZone, startOfMonth, startOfWeek } from '@/lib/dates';
import type { DemoRow, DemoTables } from '@/server/entities/demo-collection';

/** Sample My Life data, relative to `today`, for the local preview only. */
export function seedLifeTables(opts: {
  today: string;
  timeZone: string;
  rand: () => number;
  id: (prefix: string) => string;
}): DemoTables {
  const { today, timeZone, rand, id } = opts;
  const at = (day: string, hour: number) =>
    new Date(startOfDayInZone(day, timeZone).getTime() + hour * 3_600_000).toISOString();
  const row = (prefix: string, data: Record<string, unknown>): DemoRow => ({
    id: id(prefix),
    ...data
  });

  const tasks = [
    ['Renew cosmetology license', 6, 'high', 'Bring CE certificates'],
    ['Book brow lamination', 2, 'normal', null],
    ['Order new nail art brushes', 1, 'normal', null],
    ['Call mom', 0, 'normal', null],
    ['Plan girls trip itinerary', 14, 'low', null],
    ['Schedule quarterly tax payment', 9, 'high', 'Estimated payment due mid-January'],
    ['Return library books', -1, 'low', null]
  ].map(([title, due, priority, notes]) =>
    row('tsk', {
      title,
      notes,
      dueOn: addDays(today, due as number),
      priority,
      status: 'open',
      completedAt: null
    })
  );

  const habits = (
    [
      ['Drink 80oz water', 7],
      ['Move for 30 minutes', 5],
      ['Skincare morning & night', 7],
      ['Read 10 pages', 5],
      ['No phone first hour', 4]
    ] as const
  ).map(([name, targetPerWeek], i) =>
    row('hab', { name, targetPerWeek, sortOrder: i, archived: false })
  );
  const habitLogs: DemoRow[] = [];
  for (const habit of habits) {
    const rate = (habit.targetPerWeek as number) / 8.5;
    for (let i = 1; i <= 90; i++) {
      if (rand() < rate)
        habitLogs.push(row('hlg', { habitId: habit.id, loggedOn: addDays(today, -i) }));
    }
  }

  const events = (
    [
      ['Pilates reformer', 'fitness', 0, 7, 1, 'Core Studio'],
      ['Facial', 'self_care', 2, 9, 1.5, 'Glow Lab'],
      ['Dinner with Nia', 'social', 3, 19.5, 2, null],
      ['Lash fill', 'self_care', 5, 8, 1.5, null],
      ['Sunday reset & meal prep', 'personal', 5, 15, 2, null],
      ['Pilates reformer', 'fitness', 7, 7, 1, 'Core Studio'],
      ['Mom’s birthday lunch', 'social', 11, 12, 2, 'The Garden Room'],
      ['Flight to Miami', 'travel', 18, 8.25, 3, 'Terminal B']
    ] as const
  ).map(([title, category, day, hour, len, location]) =>
    row('evt', {
      title,
      category,
      startsAt: at(addDays(today, day), hour),
      endsAt: at(addDays(today, day), hour + len),
      location,
      notes: null
    })
  );

  const goals = (
    [
      ['Emergency fund', 'money', 10000, 6400, '$', addDays(today, 180)],
      ['Read 24 books', 'growth', 24, 17, 'books', `${today.slice(0, 4)}-12-31`],
      ['Pilates 100 classes', 'health', 100, 58, 'classes', null],
      ['Learn Spanish basics', 'growth', 60, 22, 'lessons', addDays(today, 120)]
    ] as const
  ).map(([title, area, targetValue, currentValue, unit, targetDate]) =>
    row('gol', { title, area, targetValue, currentValue, unit, targetDate, status: 'active' })
  );

  const dayPlans = [
    row('dpl', {
      day: today,
      intention: 'Calm, focused, and kind to myself',
      priorities: ['Finish holiday nail art samples', 'Pilates at 7', 'Call mom'],
      notes: 'Pick up builder gel on the way home.'
    })
  ];

  const categories = (
    [
      ['Rent & utilities', 'expense', 185000],
      ['Groceries', 'expense', 50000],
      ['Dining out', 'expense', 25000],
      ['Beauty & self-care', 'expense', 30000],
      ['Fitness', 'expense', 18000],
      ['Shopping', 'expense', 20000],
      ['Transportation', 'expense', 15000],
      ['Owner pay', 'income', null]
    ] as const
  ).map(([name, kind, monthlyLimitCents], i) =>
    row('bud', { name, kind, monthlyLimitCents, sortOrder: i, archived: false })
  );
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;
  const transactions: DemoRow[] = [];
  for (const monthOffset of [0, 1]) {
    const month = startOfMonth(addDays(startOfMonth(today), -monthOffset * 28));
    const push = (
      day: number,
      kind: string,
      cents: number,
      category: string,
      description: string
    ) => {
      const occurredOn = addDays(month, day - 1);
      if (occurredOn > today) return;
      transactions.push(
        row('txn', { occurredOn, kind, amountCents: cents, categoryId: cat(category), description })
      );
    };
    push(1, 'income', 320000, 'Owner pay', 'Owner pay — first half');
    push(15, 'income', 320000, 'Owner pay', 'Owner pay — second half');
    push(1, 'expense', 165000, 'Rent & utilities', 'Rent');
    push(6, 'expense', 14200, 'Rent & utilities', 'Electric');
    push(3, 'expense', 9800, 'Groceries', 'Whole Foods');
    push(10, 'expense', 12450, 'Groceries', 'Trader Joe’s');
    push(17, 'expense', 8730, 'Groceries', 'Farmers market');
    push(8, 'expense', 6400, 'Dining out', 'Brunch with the girls');
    push(19, 'expense', 11200, 'Dining out', 'Date night');
    push(5, 'expense', 9500, 'Beauty & self-care', 'Brow lamination');
    push(12, 'expense', 14000, 'Beauty & self-care', 'Facial');
    push(2, 'expense', 18000, 'Fitness', 'Pilates membership');
    push(14, 'expense', 7600, 'Shopping', 'New workout set');
    push(9, 'expense', 4500, 'Transportation', 'Gas');
    push(21, 'expense', 3800, 'Transportation', 'Car wash & gas');
  }

  const savingsGoals = (
    [
      ['Miami girls trip', 250000, addDays(today, 18)],
      ['New car down payment', 800000, addDays(today, 300)],
      ['Salon chair upgrade', 180000, addDays(today, 90)]
    ] as const
  ).map(([name, targetCents, targetDate]) =>
    row('sav', { name, targetCents, targetDate, status: 'active' })
  );
  const contributions: DemoRow[] = [];
  for (const [goalIndex, amounts] of [
    [0, [50000, 40000, 45000, 50000]],
    [1, [100000, 75000, 75000, 100000, 60000]],
    [2, [30000, 25000]]
  ] as const) {
    amounts.forEach((amountCents, i) =>
      contributions.push(
        row('con', {
          goalId: savingsGoals[goalIndex].id,
          amountCents,
          contributedOn: addDays(today, -(amounts.length - i) * 14),
          note: i === 0 ? 'Starting balance' : null
        })
      )
    );
  }

  const workoutLogs: DemoRow[] = [];
  const kinds = [
    ['pilates', 'Reformer Pilates', 50],
    ['strength', 'Lower body strength', 45],
    ['walk', 'Evening walk', 35],
    ['yoga', 'Vinyasa flow', 60],
    ['cardio', 'Stairmaster intervals', 30],
    ['dance', 'Dance cardio', 40]
  ] as const;
  for (let i = 1; i <= 42; i++) {
    if (rand() > 0.62) continue;
    const [kind, title, base] = kinds[Math.floor(rand() * kinds.length)];
    workoutLogs.push(
      row('wkl', {
        performedOn: addDays(today, -i),
        kind,
        title,
        durationMinutes: base + Math.round(rand() * 15),
        intensity: rand() < 0.3 ? 'hard' : rand() < 0.7 ? 'moderate' : 'easy',
        notes: null
      })
    );
  }

  const workoutPlans = (
    [
      [
        1,
        'pilates',
        'Reformer Pilates',
        50,
        'Footwork\nHundreds\nLong stretch series\nSide splits'
      ],
      [
        2,
        'strength',
        'Glutes & legs',
        45,
        'Hip thrusts 4×10\nBulgarian split squats 3×10\nRDLs 3×12\nCable kickbacks 3×15'
      ],
      [3, 'walk', 'Hot girl walk', 40, null],
      [
        4,
        'strength',
        'Upper body & core',
        45,
        'Shoulder press 3×10\nLat pulldown 3×12\nRows 3×12\nPlank 3×45s'
      ],
      [5, 'pilates', 'Reformer Pilates', 50, null],
      [6, 'yoga', 'Slow flow & stretch', 60, null]
    ] as const
  ).map(([weekday, kind, title, durationMinutes, exercises]) =>
    row('wkp', { weekday, kind, title, durationMinutes, exercises })
  );

  const weekStart = startOfWeek(today);
  const mealIdeas: Record<string, string[]> = {
    breakfast: [
      'Greek yogurt & berries',
      'Avocado toast & eggs',
      'Protein smoothie',
      'Overnight oats'
    ],
    lunch: [
      'Salmon grain bowl',
      'Chicken Caesar wrap',
      'Mediterranean salad',
      'Turkey lettuce cups'
    ],
    dinner: ['Lemon herb chicken & veggies', 'Shrimp tacos', 'Turkey bolognese', 'Sheet-pan salmon']
  };
  const meals: DemoRow[] = [];
  for (let d = 0; d < 7; d++) {
    for (const slot of ['breakfast', 'lunch', 'dinner'] as const) {
      if (rand() < 0.2) continue;
      const ideas = mealIdeas[slot];
      meals.push(
        row('mea', {
          day: addDays(weekStart, d),
          slot,
          title: ideas[(d + slot.length) % ideas.length],
          notes: null
        })
      );
    }
  }
  const groceries = (
    [
      ['Salmon fillets', '2 lb', false],
      ['Spinach', '1 bag', true],
      ['Greek yogurt', '2 tubs', false],
      ['Berries', '3 pints', false],
      ['Avocados', '4', true],
      ['Sparkling water', '1 case', false]
    ] as const
  ).map(([name, quantity, checked]) => row('gro', { name, quantity, checked }));

  const trip = row('trp', {
    name: 'Miami girls trip',
    destination: 'Miami Beach, FL',
    startsOn: addDays(today, 18),
    endsOn: addDays(today, 22),
    budgetCents: 250000,
    status: 'booked',
    notes: 'Celebrating Nia’s birthday!'
  });
  const trip2 = row('trp', {
    name: 'Spring wellness retreat',
    destination: 'Tulum, Mexico',
    startsOn: addDays(today, 120),
    endsOn: addDays(today, 126),
    budgetCents: 400000,
    status: 'planning',
    notes: null
  });
  const tripItems = (
    [
      [trip, 'flight', 'Flight MIA · 8:15 AM', 18, 42000, true],
      [trip, 'stay', 'The Setai — ocean suite', 18, 128000, true],
      [trip, 'dining', 'Birthday dinner at Komodo', 20, 30000, false],
      [trip, 'activity', 'Spa day', 21, 22000, false],
      [trip, 'packing', 'Swimsuits ×3', null, null, true],
      [trip, 'packing', 'Gel kit for touch-ups', null, null, false],
      [trip, 'packing', 'SPF 50', null, null, false],
      [trip2, 'stay', 'Research retreats', null, null, false]
    ] as const
  ).map(([t, kind, title, day, costCents, done]) =>
    row('tri', {
      tripId: t.id,
      kind,
      title,
      onDay: day === null ? null : addDays(today, day),
      costCents,
      done
    })
  );

  const selfcare = (
    [
      ['Fill on my own nails', 'nails', 14, -12, null],
      ['Pedicure', 'nails', 21, -9, null],
      ['Silk press', 'hair', 14, -16, 'Studio Luxe'],
      ['Trim', 'hair', 56, -40, 'Studio Luxe'],
      ['Facial', 'skin', 28, -26, 'Glow Lab'],
      ['Lash fill', 'lashes', 21, -16, 'Lash Lounge'],
      ['Brow wax & tint', 'brows', 28, -30, null],
      ['Massage', 'spa', 30, -10, null],
      ['Therapy session', 'wellness', 14, -3, null]
    ] as const
  ).map(([name, category, everyDays, lastOffset, provider]) =>
    row('slf', {
      name,
      category,
      everyDays,
      lastDoneOn: addDays(today, lastOffset),
      provider,
      notes: null,
      archived: false
    })
  );

  const moods = [4, 5, 3, 4, 4, 2, 4, 5, 3, 4, 5, 4];
  const journal = moods.map((mood, i) =>
    row('jrn', {
      entryOn: addDays(today, -(i + 1) * 2),
      mood,
      title: i === 0 ? 'Grateful for slow mornings' : null,
      body:
        i === 0
          ? 'Took my time with coffee and skincare before the salon. Three clients today and every set came out beautiful.'
          : 'A good, full day.',
      gratitude: i % 2 === 0 ? 'My clients, my health, quiet mornings' : null
    })
  );

  return {
    'life.tasks': tasks,
    'life.habits': habits,
    'life.habit_logs': habitLogs,
    'life.events': events,
    'life.goals': goals,
    'life.day_plans': dayPlans,
    'life.budget_categories': categories,
    'life.transactions': transactions,
    'life.savings_goals': savingsGoals,
    'life.savings_contributions': contributions,
    'life.workout_logs': workoutLogs,
    'life.workout_plans': workoutPlans,
    'life.meals': meals,
    'life.grocery_items': groceries,
    'life.trips': [trip, trip2],
    'life.trip_items': tripItems,
    'life.selfcare_routines': selfcare,
    'life.journal_entries': journal
  };
}
