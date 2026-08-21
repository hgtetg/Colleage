(() => {
  const originalFetch = window.fetch.bind(window);
  const CLIENT_ITERATIONS = 150000;
  const SCHEME = 'client-pbkdf2-v2';

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const isAuthPasswordRequest = (url === '/api/auth/signup' || url === '/api/auth/login') && String(init.method || 'GET').toUpperCase() === 'POST';

    if (isAuthPasswordRequest && typeof init.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        if (payload.email && payload.password && payload.passwordScheme !== SCHEME) {
          payload.password = await deriveClientSecret(payload.password, payload.email);
          payload.passwordScheme = SCHEME;
          init = { ...init, body: JSON.stringify(payload) };
        }
      } catch (error) {
        console.warn('Could not prepare password request', error);
      }
    }

    const response = await originalFetch(input, init);

    if (isAuthPasswordRequest && !response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.clone().text().catch(() => '');
        let message = `Request failed (${response.status})`;
        if (/1102|exceeded resource limits|CPU time/i.test(text)) {
          message = 'Authentication exceeded the Cloudflare Free CPU limit. The latest Colleage auth update is designed to fix this; reload after the new deployment finishes.';
        } else if (text) {
          const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (cleaned) message = cleaned.slice(0, 240);
        }
        return new Response(JSON.stringify({ error: message }), {
          status: response.status,
          statusText: response.statusText,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }
    }

    return response;
  };

  async function deriveClientSecret(password, email) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    const salt = encoder.encode(`colleage:${String(email).trim().toLowerCase()}`);
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: CLIENT_ITERATIONS
    }, key, 256);
    return bytesToHex(new Uint8Array(bits));
  }

  function bytesToHex(bytes) {
    return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
})();
