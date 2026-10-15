// Small helpers shared by the page modules.

// The build label: "<sha7> · <date>" from build.json (written at deploy; served live in development),
// or "dev". Every page shows it, so a reader can tell the site actually refreshed.
export async function buildLabel() {
  try {
    const r = await fetch('./build.json', { cache: 'no-store' });
    if (!r.ok) return 'dev';
    const b = await r.json();
    const when = new Date(b.builtAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
    return `${b.sha.slice(0, 7)} · ${when}${b.dev ? ' · פיתוח' : ''}`;
  } catch {
    return 'dev';
  }
}

// el('a', { href, className, ariaLabel }, ...children). aria*/data*/style become attributes;
// everything else is set as a property.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('aria')) node.setAttribute(`aria-${k.slice(4).toLowerCase()}`, v);
    else if (k.startsWith('data')) node.setAttribute(`data-${k.slice(4).toLowerCase()}`, v);
    else if (k === 'style') node.setAttribute('style', v);
    else node[k] = v;
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}
