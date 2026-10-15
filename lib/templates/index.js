// The registry of starting templates. A template is data in its own module; adding a custom means
// adding a module here and one line below. Order here is the order the site offers them in.
//
// Template shape:
//   title       shown to the reader
//   status      custom confirmation status (every template is a candidate until a community confirms it)
//   confidence  'medium' | 'low': how well the ORDER is sourced (texts have their own review status)
//   sources     where the order comes from
//   summary     one line shown on the nusach card: what this order contains that the others do not
// Blocks with withParent read "<name> בן/בת <parent>" when the reader gives a parent's name. Which parent
// (father or mother) is the family's choice, so the template does not say.
//   blocks      the default order (block types: psalms, psalm119, mishnah, prayer; see lib/template.js)
//   optional    blocks the custom knows but does not include by default
import ashkenaz_base from './ashkenaz_base.js';
import sefard_base from './sefard_base.js';
import edot_hamizrach_base from './edot_hamizrach_base.js';
import morocco_base from './morocco_base.js';
import yemen_baladi_base from './yemen_baladi_base.js';

export const TEMPLATES = { ashkenaz_base, sefard_base, edot_hamizrach_base, morocco_base, yemen_baladi_base };
