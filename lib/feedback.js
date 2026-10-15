// In-app feedback: the one definition of what a feedback report holds, how long each field may be,
// and how it is sent. Reports go to a Firestore collection that anyone may add to and no one may read
// from the web (firestore.rules); they are read in the Firebase console. tests/feedback.test.js checks
// that firestore.rules allows exactly these fields and these limits.
//
// Firestore stamps each document with its own server createTime, so the client time is kept only as
// a hint (a reader's clock may be wrong).

export const FEEDBACK_COLLECTION = 'feedback';

// field -> maximum length. Every report carries every field (an empty string when there is nothing).
export const FEEDBACK_FIELDS = {
  message: 2000,
  contact: 200,
  template: 60,
  section: 200,
  link: 2000,
  build: 100,
  clientTime: 40,
};

export const MIN_OPEN_MS = 3000; // a person takes longer than this to write anything
export const RESEND_WAIT_MS = 60000; // one report per minute from one device

const clip = (s, n) => String(s ?? '').trim().slice(0, n);

// Returns { ok: true, body } with the Firestore REST document body, or { ok: false, error }.
export function buildFeedbackDoc(input) {
  const values = Object.fromEntries(Object.entries(FEEDBACK_FIELDS).map(([k, n]) => [k, clip(input[k], n)]));
  if (!values.message) return { ok: false, error: 'empty' };
  if (String(input.message ?? '').trim().length > FEEDBACK_FIELDS.message) return { ok: false, error: 'too-long' };
  const fields = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { stringValue: v }]));
  return { ok: true, body: { fields } };
}

export function feedbackEndpoint({ projectId, apiKey }) {
  const project = encodeURIComponent(projectId);
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${FEEDBACK_COLLECTION}?key=${encodeURIComponent(apiKey)}`;
}

// Anti-spam checks done before sending. now/openedAt/lastSentAt are epoch ms; honeypot is the value of
// a field people never see. Returns null when the report may go, or the reason it may not.
export function sendBlockedReason({ honeypot = '', openedAt, now, lastSentAt = 0 }) {
  if (honeypot) return 'bot';
  if (now - openedAt < MIN_OPEN_MS) return 'too-fast';
  if (lastSentAt && now - lastSentAt < RESEND_WAIT_MS) return 'wait';
  return null;
}
