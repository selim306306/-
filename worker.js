// وسيط آمن على Cloudflare Workers: يُبقي مفتاح API سرّياً خارج المتصفح.
// الإعداد: Variables → ANTHROPIC_API_KEY (Secret) + ALLOWED_ORIGIN (مثال: https://username.github.io) + MODEL (اختياري)
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST' || !okOrigin) return new Response('forbidden', { status: 403, headers: cors });

    let body;
    try { body = await req.json(); } catch { return new Response('bad json', { status: 400, headers: cors }); }
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-16)
      .map(m => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').slice(0, 1000) }));
    if (!messages.length || messages[0].role !== 'user') return new Response('bad messages', { status: 400, headers: cors });

    // صور اختيارية (قراءة أغلفة الكتب): jpeg/png/webp فقط، حتى 3 صور
    const images = (Array.isArray(body.images) ? body.images : []).slice(0, 3)
      .filter(i => i && /^image\/(jpeg|png|webp)$/.test(i.mime) && typeof i.data === 'string' && i.data.length < 2500000 && /^[A-Za-z0-9+/=]+$/.test(i.data));
    if (images.length) {
      const last = messages[messages.length - 1];
      last.content = [...images.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } })), { type: 'text', text: String((body.messages[body.messages.length - 1] || {}).content || '').slice(0, 4000) }];
    }
    const payload = {
      model: env.MODEL || 'claude-haiku-4-5-20251001',            // النموذج يُحدَّد هنا للتحكم في التكلفة
      max_tokens: Math.min(Number(body.max_tokens) || 300, images.length ? 1000 : 400),
      system: String(body.system || '').slice(0, 12000),
      messages
    };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload)
    });
    return new Response(r.body, { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
  }
};
