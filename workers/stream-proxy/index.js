function resolveUrl(base, relative) {
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
  const baseStr = base.endsWith('/') ? base : base.substring(0, base.lastIndexOf('/') + 1);
  return new URL(relative, baseStr).href;
}

function wrapUrl(origin, path, target) {
  const u = new URL(origin + path);
  u.searchParams.set('u', target);
  return u.toString();
}

function isPlaylist(contentType, url) {
  return contentType.includes('mpegurl') || contentType.includes('m3u8') || url.endsWith('.m3u8');
}

export default {
  async fetch(request) {
    const start = Date.now();
    const url = new URL(request.url);
    const targetRaw = url.searchParams.get('u');
    if (!targetRaw) {
      return new Response('Missing ?u= parameter', { status: 400 });
    }
    const target = decodeURIComponent(targetRaw);
    const resp = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });
    if (!resp.ok) {
      return new Response(`Upstream error: ${resp.status}`, { status: resp.status });
    }
    const ct = resp.headers.get('content-type') || '';
    if (isPlaylist(ct, target)) {
      const text = await resp.text();
      const lines = text.split('\n');
      const rewritten = lines.map(line => {
        const t = line.trim();
        if (t === '' || t.startsWith('#')) return line;
        const resolved = resolveUrl(target, t);
        return wrapUrl(url.origin, url.pathname, resolved);
      }).join('\n');
      return new Response(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }
    const headers = new Headers(resp.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Headers', '*');
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(resp.body, { headers });
  },
};
