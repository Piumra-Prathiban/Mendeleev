// Plain-text helpers for sidebar previews.
// Note bodies are HTML (from contenteditable). Output is text only — never HTML —
// so React's text escaping is the XSS boundary.

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function previewLine(input: string, maxLen = 120): string {
  const flat = htmlToText(input).replace(/\s+/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  return flat.slice(0, maxLen).trimEnd() + "…";
}
