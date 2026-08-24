/**
 * Build a query string from a params object, dropping the keys that have
 * nothing to say.
 *
 * `new URLSearchParams({ search: undefined })` stringifies to the literal
 * `search=undefined`, which the API then treats as a real search term and
 * filters every row out. Services that pass `search: value || undefined` need
 * this instead.
 */
export function toQueryString(params = {}) {
  return new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
}

export default toQueryString;
