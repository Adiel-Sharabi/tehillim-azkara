// Small DOM helper and site constants shared by the page modules.

// Where error reports go: a prefilled "new issue" on the public repository. No personal contact.
export const REPO = 'Adiel-Sharabi/tehillim-azkara';

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
