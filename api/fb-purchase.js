const PIXEL_ID = process.env.FACEBOOK_PIXEL_ID || '1262683118673008';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false });
    return;
  }

  const token = process.env.FACEBOOK_CAPI_TOKEN || '';
  if (!token) {
    json(res, 200, { ok: true, skipped: true });
    return;
  }

  const body = req.body || {};
  const value = Number(body.value) || 0;
  const currency = String(body.currency || 'USD').toUpperCase();
  const eventId = String(body.event_id || `purchase_${Date.now()}`);
  const fbp = String(body.fbp || '').trim();
  let fbc = String(body.fbc || '').trim();
  if (fbc && !fbc.startsWith('fb.1.')) {
    fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbc}`;
  }

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const userData = {
    client_user_agent: String(req.headers['user-agent'] || ''),
    client_ip_address: forwarded || undefined
  };
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: String(req.headers.referer || `https://${req.headers.host || 'localhost'}/obrigado`),
      action_source: 'website',
      user_data: userData,
      custom_data: {
        currency,
        value,
        content_type: 'product'
      }
    }]
  };

  try {
    const upstream = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await upstream.json().catch(() => ({}));
    json(res, upstream.ok ? 200 : 502, { ok: Boolean(upstream.ok), data });
  } catch (err) {
    json(res, 502, { ok: false, error: err.message });
  }
}
