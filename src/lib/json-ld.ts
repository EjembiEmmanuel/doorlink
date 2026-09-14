// JSON.stringify alone isn't safe to drop into dangerouslySetInnerHTML: if
// any string field contains a literal "</script>", the browser's HTML
// parser closes the script tag early and renders whatever follows as
// markup — a real injection vector, not a theoretical one, since this
// data (Model.summary, listing titles, ...) comes from admin/manufacturer
// or peer-to-peer sellers, not just this codebase. Escaping "<" defuses
// both "</script>" and a stray "<script>" the same way.
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
