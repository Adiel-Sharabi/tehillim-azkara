// The feedback dialog. What a report holds and the anti-spam rules live in lib/feedback.js; where it
// goes lives in feedback-config.js (null there hides every feedback button).

import { FEEDBACK } from './feedback-config.js';
import { buildFeedbackDoc, feedbackEndpoint, sendBlockedReason } from './lib/feedback.js';

export const feedbackEnabled = !!(FEEDBACK?.projectId && FEEDBACK?.apiKey);

const LAST_SENT_KEY = 'tehillim-feedback-last';
const $ = (id) => document.getElementById(id);
let current = {};
let openedAt = 0;

function lastSentAt() {
  try { return Number(localStorage.getItem(LAST_SENT_KEY)) || 0; } catch { return 0; }
}
function markSent(now) {
  try { localStorage.setItem(LAST_SENT_KEY, String(now)); } catch { /* private mode: not kept */ }
}
function setStatus(text, error = false) {
  $('fb-status').textContent = text;
  $('fb-status').classList.toggle('error', error);
}

// context: { section, template, link, build } — section is the title of the part being reported on.
export function openFeedback(context) {
  if (!feedbackEnabled) return;
  current = context;
  $('fb-about').textContent = context.section ? `על: ${context.section}` : 'הערה כללית על האתר או על הסדר.';
  $('fb-message').value = '';
  $('fb-website').value = '';
  $('feedback-send').disabled = false;
  setStatus('');
  openedAt = Date.now();
  $('dlg-feedback').showModal();
  $('fb-message').focus();
}

const BLOCKED = {
  'too-fast': 'שנייה אחת, ואז אפשר לשלוח.',
  wait: 'אפשר לשלוח הערה נוספת בעוד דקה.',
};

async function send(ev) {
  ev.preventDefault();
  const now = Date.now();
  const reason = sendBlockedReason({ honeypot: $('fb-website').value, openedAt, now, lastSentAt: lastSentAt() });
  if (reason === 'bot') { $('dlg-feedback').close(); return; } // a bot gets no hint that it was caught
  if (reason) { setStatus(BLOCKED[reason], true); return; }

  const doc = buildFeedbackDoc({
    message: $('fb-message').value,
    contact: $('fb-contact').value,
    section: current.section ?? '',
    template: current.template ?? '',
    link: current.link ?? location.href,
    build: current.build ?? '',
    clientTime: new Date(now).toISOString(),
  });
  if (!doc.ok) {
    setStatus(doc.error === 'empty' ? 'נא לכתוב מה כדאי לתקן.' : 'ההערה ארוכה מדי.', true);
    $('fb-message').focus();
    return;
  }

  $('feedback-send').disabled = true;
  setStatus('שולח…');
  try {
    const r = await fetch(feedbackEndpoint(FEEDBACK), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc.body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    markSent(now);
    setStatus('תודה! ההערה נשלחה.');
    setTimeout(() => $('dlg-feedback').close(), 1600);
  } catch {
    $('feedback-send').disabled = false;
    setStatus('השליחה נכשלה. בדקו את החיבור ונסו שוב.', true);
  }
}

export function wireFeedback() {
  $('feedback-form').addEventListener('submit', send);
  for (const id of ['feedback-close', 'feedback-cancel']) $(id).addEventListener('click', () => $('dlg-feedback').close());
}
