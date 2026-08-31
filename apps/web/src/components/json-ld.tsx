/**
 * Renders one `application/ld+json` block.
 *
 * The escape is not optional. JSON-LD sits inside a `<script>`, where the HTML
 * parser is still looking for `</script`: an answer containing that sequence
 * would close the tag early and put the rest of the graph into the document as
 * markup. The FAQ answers are translator input, so this is reachable without
 * anybody writing HTML on purpose. Escaping every `<` as a JSON unicode escape is
 * valid JSON, parses back to the same string, and removes the whole class.
 *
 * `dangerouslySetInnerHTML` rather than a text child because React escapes
 * text children as HTML entities, and `&quot;` inside a JSON-LD block is a
 * parse error rather than a quote.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must not be HTML-entity-escaped; the payload is JSON.stringify output with < neutralised
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
