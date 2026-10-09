/**
 * Pure utility to format proper patient names and eliminate concatenation/duplication.
 */
export function formatProperName(raw: string): string {
  if (!raw) return 'Patient';
  let clean = raw.trim()
    .replace(/^(?:my name is|i am|i'm|this is|patient name is|patient:?|name:?|for)\s+/i, '')
    .trim();
  
  // Remove special symbols and digits
  clean = clean.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Patient';

  // 1. Check if the whole string is duplicated (e.g. 'arbaz khanarbaz khan' or 'arbazarbaz' or 'eses')
  const len = clean.length;
  if (len >= 4 && len % 2 === 0) {
    const half = clean.slice(0, len / 2);
    if (half.toLowerCase() === clean.slice(len / 2).toLowerCase()) {
      clean = half.trim();
    }
  }

  const words = clean.split(/\s+/);
  // 2. Check if words or word-pairs are repeated
  if (words.length === 2 && words[0].toLowerCase() === words[1].toLowerCase()) {
    clean = words[0];
  } else if (words.length === 4 && `${words[0]} ${words[1]}`.toLowerCase() === `${words[2]} ${words[3]}`.toLowerCase()) {
    clean = `${words[0]} ${words[1]}`;
  } else if (words.length === 2) {
    if (words[0].length >= 4 && words[0].length % 2 === 0) {
      const h = words[0].slice(0, words[0].length / 2);
      if (h.toLowerCase() === words[0].slice(words[0].length / 2).toLowerCase()) {
        words[0] = h;
      }
    }
    if (words[1].length >= 4 && words[1].length % 2 === 0) {
      const h = words[1].slice(0, words[1].length / 2);
      if (h.toLowerCase() === words[1].slice(words[1].length / 2).toLowerCase()) {
        words[1] = h;
      }
    }
    clean = words.join(' ');
  }

  return clean
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
