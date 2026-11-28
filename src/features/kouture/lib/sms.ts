// Rules for marketing texts (TCPA / carrier rules for A2P 10DLC). Applied at
// send time, after approval, so a stale draft can't slip past them.

/** US numbers to E.164 (+1XXXXXXXXXX); null if it isn't a usable mobile number. */
export function toE164(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

const STOP = /\b(reply|text)\s+stop\b/i;

/** Personalises {first_name} and guarantees opt-out wording. */
export function personalize(body: string, fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] || 'there';
  const text = body.replaceAll('{first_name}', first).trim();
  return STOP.test(text) ? text : `${text} Reply STOP to opt out.`;
}

/** Marketing texts only between 8am and 9pm (recipients are local clients). */
export function withinQuietHours(now: Date, timeZone: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now)
  );
  return hour >= 8 && hour < 21;
}
