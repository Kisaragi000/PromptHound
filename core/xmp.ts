/**
 * Pulls the text fields that can hold generation parameters out of an XMP packet:
 * exif:UserComment, dc:description and tiff:ImageDescription, written either as
 * elements (often wrapped in rdf:Alt / rdf:li) or as attributes. XML entities are decoded.
 */

const FIELDS = ['exif:UserComment', 'dc:description', 'tiff:ImageDescription'];

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function isXmp(text: string): boolean {
  return /<x:xmpmeta|<rdf:RDF|<\?xpacket/.test(text.slice(0, 2000));
}

export function readXmpTextFields(xmp: string): string[] {
  const found: string[] = [];
  for (const field of FIELDS) {
    const element = new RegExp(`<${field}(?:\\s[^>]*)?>([\\s\\S]*?)</${field}>`, 'g');
    for (const match of xmp.matchAll(element)) {
      const inner = match[1];
      const items = [...inner.matchAll(/<rdf:li(?:\s[^>]*)?>([\s\S]*?)<\/rdf:li>/g)].map((m) => m[1]);
      for (const item of items.length > 0 ? items : [inner]) {
        const text = decodeEntities(item).trim();
        if (text) found.push(text);
      }
    }
    const attribute = new RegExp(`\\s${field}="([^"]*)"`, 'g');
    for (const match of xmp.matchAll(attribute)) {
      const text = decodeEntities(match[1]).trim();
      if (text) found.push(text);
    }
  }
  return found;
}
