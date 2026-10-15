// Blocks and words shared by several templates, defined once.
export const NESHAMA = 'נשמה';
export const KRA_SATAN = 'קרע שטן';

// The seven psalms of the grave-side and azkara order (kadisha.org, master doc psalms_7), in that order.
export const SEVEN_PSALMS = { type: 'psalms', chapters: [33, 16, 17, 72, 91, 104, 130] };

export const PSALM119_NESHAMA = { type: 'psalm119', letters: NESHAMA };

// Mikvaot 7:4-7, whose first letters spell נשמה (the "M4" Neshama mishnayot).
export const MISHNAH_NESHAMA = { type: 'mishnah', ref: 'Mikvaot.7', from: 4, to: 7, title: 'משניות מקוואות פרק ז׳, משניות ד׳–ז׳ (נשמה)' };
export const MISHNAH_KELIM_24 = { type: 'mishnah', ref: 'Kelim.24', from: 1, to: 17, title: 'משניות כלים פרק כ״ד' };

// Status every template carries until a community has confirmed it.
export const CANDIDATE = 'מועמד — טרם אומת עם קהילה';
