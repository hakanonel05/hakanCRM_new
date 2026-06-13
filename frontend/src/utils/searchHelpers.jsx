// Lightweight helpers for customer search UX.
// All functions are pure & cheap so they can run inline during render.

// Strip Turkish accents & lowercase so "İSTANBUL" matches "istanbul".
const TR_MAP = { "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ü": "u", "Ü": "u", "ö": "o", "Ö": "o" };
export const normalize = (s) => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/[ıİşŞçÇğĞüÜöÖ]/g, (c) => TR_MAP[c] || c)
    .toLowerCase();
};

// Field labels (Turkish) — used in match badges.
export const FIELD_LABELS = {
  company_name: "Firma",
  contact_person: "Kişi",
  market: "Market",
  application: "Uygulama",
  city: "Şehir",
  district: "İlçe",
  partner: "Partner",
  competitor: "Rakip",
  assigned_to: "Atanan",
  status: "Durum",
  potential_level: "Potansiyel",
  description: "Açıklama",
  notes: "Notlar",
  website: "Web",
  tags: "Etiket",
  products: "Ürün",
  notes_list: "Not Geçmişi",
};

// Priority ranks for relevance sort (lower = higher priority).
const FIELD_PRIORITY = [
  "company_name",
  "contact_person",
  "application",
  "market",
  "city",
  "district",
  "tags",
  "products",
  "partner",
  "competitor",
  "status",
  "potential_level",
  "assigned_to",
  "notes",
  "notes_list",
  "description",
  "website",
];

// Match a single string field. Returns true if normalised needle is in haystack.
const matchField = (val, needle) => {
  if (!val) return false;
  if (Array.isArray(val)) return val.some((v) => matchField(v, needle));
  if (typeof val === "object") {
    try { return normalize(JSON.stringify(val)).includes(needle); } catch { return false; }
  }
  return normalize(val).includes(needle);
};

/**
 * Compute which fields of a customer matched the search query.
 * Returns array of field keys (in priority order) and the best (lowest) priority.
 *
 * customer: row object
 * needle: normalised lowercased query
 */
export const computeMatchInfo = (customer, needle) => {
  if (!needle) return { fields: [], bestPriority: 999 };
  const matched = [];
  for (const key of FIELD_PRIORITY) {
    if (matchField(customer[key], needle)) matched.push(key);
  }
  const bestPriority = matched.length
    ? FIELD_PRIORITY.indexOf(matched[0])
    : 999;
  return { fields: matched, bestPriority };
};

/**
 * Highlight occurrences of `needle` inside `text` with <mark> tags.
 * Returns React-friendly array of strings/elements.
 */
export const highlightMatch = (text, needle) => {
  if (!text || !needle) return text ?? "";
  const str = String(text);
  const normStr = normalize(str);
  if (!normStr.includes(needle)) return str;

  const parts = [];
  let cursor = 0;
  let idx = normStr.indexOf(needle, cursor);
  let key = 0;
  while (idx !== -1) {
    if (idx > cursor) parts.push(str.slice(cursor, idx));
    parts.push(
      <mark
        key={`m${key++}`}
        className="bg-amber-100 text-amber-900 rounded px-0.5"
        style={{ padding: "1px 2px" }}
      >
        {str.slice(idx, idx + needle.length)}
      </mark>
    );
    cursor = idx + needle.length;
    idx = normStr.indexOf(needle, cursor);
  }
  if (cursor < str.length) parts.push(str.slice(cursor));
  return parts;
};
