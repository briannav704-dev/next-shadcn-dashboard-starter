// Public business details (safe to commit). Private data lives in the database.
export const BUSINESS = {
  name: 'Kouture Nail Bar',
  /** Public Nailzy booking page. NAILZY_BOOKING_URL overrides it per environment. */
  nailzyBookingUrl: 'https://www.nailzy.com/book/kouturenailbar'
} as const;
