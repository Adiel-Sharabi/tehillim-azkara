// Share dialog: the link, WhatsApp, the system share sheet, and a QR code (on screen and as a PNG).
// The QR encoder is vendored (vendor/qrcode.js, MIT); nothing is sent anywhere to draw it.

const $ = (id) => document.getElementById(id);
const QUIET = 4; // modules of white border the QR spec asks for

function matrix(text) {
  const qr = globalThis.qrcode(0, 'M');
  // The link is ASCII (Hebrew in it is percent-encoded), so plain byte mode is exact.
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return { n, dark: (r, c) => qr.isDark(r, c) };
}

// Black on white whatever the theme: phones scan that most reliably, and it prints cleanly.
export function qrSvg(text) {
  if (!globalThis.qrcode) return '';
  const { n, dark } = matrix(text);
  const size = n + QUIET * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

function qrPng(text, scale = 12) {
  const { n, dark } = matrix(text);
  const size = (n + QUIET * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) g.fillRect((c + QUIET) * scale, (r + QUIET) * scale, scale, scale);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

let current = null;

export function openShare({ url, name }) {
  current = { url, name, text: `סדר לימוד ותפילה לעילוי נשמת ${name}` };
  $('share-url').value = url;
  $('copy-status').textContent = '';
  $('share-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`${current.text}\n${url}`)}`;
  $('share-native').hidden = !navigator.share;
  $('qr').innerHTML = qrSvg(url);
  $('dlg-share').showModal();
}

async function copy() {
  const input = $('share-url');
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand?.('copy');
  }
  $('copy-status').textContent = 'הקישור הועתק.';
}

async function nativeShare() {
  try {
    await navigator.share({ title: 'סדר אזכרה', text: current.text, url: current.url });
  } catch { /* the reader closed the share sheet */ }
}

async function downloadQr() {
  const blob = await qrPng(current.url);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `qr-${current.name.replace(/\s+/g, '-')}.png`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('copy-link').addEventListener('click', copy);
$('share-url').addEventListener('focus', (e) => e.target.select());
$('share-native').addEventListener('click', nativeShare);
$('qr-download').addEventListener('click', downloadQr);
