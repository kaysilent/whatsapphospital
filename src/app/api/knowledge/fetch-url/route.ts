import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function stripHtml(html: string): { title: string; text: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Website Document';

  // Remove script, style, noscript, svg, iframe blocks
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');

  // Replace block elements with newlines
  clean = clean.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|section|article|header|footer)>/gi, '\n');
  clean = clean.replace(/<br\s*\/?>/gi, '\n');

  // Strip all remaining tags
  clean = clean.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  clean = clean
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace and blank lines
  const lines = clean
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0);

  const text = lines.join('\n');
  return { title, text };
}

export async function POST(req: NextRequest) {
  try {
    let url: string | undefined;

    try {
      const body = await req.json();
      url = body?.url;
    } catch {
      try {
        const text = await req.text();
        const parsed = JSON.parse(text);
        url = parsed?.url;
      } catch {}
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'A valid URL is required in JSON body: { "url": "https://example.com" }' },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format. Please include http:// or https://' },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WACRM-Bot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const { title, text } = stripHtml(html);

    // Limit text to first 30,000 chars for efficient indexing
    const truncatedText = text.slice(0, 30000);

    return NextResponse.json({
      success: true,
      url: parsedUrl.toString(),
      title: title || parsedUrl.hostname,
      content: truncatedText,
      characterCount: truncatedText.length,
      wordCount: truncatedText.split(/\s+/).filter(Boolean).length,
    });
  } catch (err: any) {
    console.error('[Knowledge URL Fetch Error]:', err);
    return NextResponse.json(
      { error: err.name === 'AbortError' ? 'URL request timed out after 12s' : (err.message || 'Failed to crawl website') },
      { status: 500 }
    );
  }
}
