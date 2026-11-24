// Marketing consent (TCPA for texts, CAN-SPAM for email). A later opt-out
// always wins, and "no record" means do not market.

export type ConsentState = 'subscribed' | 'opted_out' | 'unknown';

export function consentState(consentAt: string | null, optedOutAt: string | null): ConsentState {
  if (optedOutAt && (!consentAt || Date.parse(optedOutAt) >= Date.parse(consentAt))) {
    return 'opted_out';
  }
  return consentAt ? 'subscribed' : 'unknown';
}

export function consentLabel(state: ConsentState) {
  return state === 'subscribed' ? 'Agreed' : state === 'opted_out' ? 'Opted out' : 'No consent';
}

export function clientConsent(c: {
  smsMarketingConsentAt: string | null;
  smsOptedOutAt: string | null;
  emailMarketingConsentAt: string | null;
  emailOptedOutAt: string | null;
}) {
  return {
    sms: consentState(c.smsMarketingConsentAt, c.smsOptedOutAt),
    email: consentState(c.emailMarketingConsentAt, c.emailOptedOutAt)
  };
}
