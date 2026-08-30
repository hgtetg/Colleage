import { getDb, getEnv } from '@/lib/campus-db';

const encoder = new TextEncoder();
function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1)
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function POST(request: Request) {
  const secret = getEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response('Webhook not configured', { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  const parts = Object.fromEntries(
    signature.split(',').map((part) => part.split('=', 2)),
  );
  const timestamp = parts.t,
    expected = parts.v1;
  if (
    !timestamp ||
    !expected ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    return new Response('Invalid signature', { status: 400 });
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const computed = hex(
    await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`${timestamp}.${payload}`),
    ),
  );
  if (!equal(computed, expected))
    return new Response('Invalid signature', { status: 400 });
  const event = JSON.parse(payload) as {
    type: string;
    data: {
      object: {
        id: string;
        payment_status?: string;
        metadata?: { donation_id?: string };
      };
    };
  };
  if (
    event.type === 'checkout.session.completed' &&
    event.data.object.payment_status === 'paid'
  ) {
    const donationId = event.data.object.metadata?.donation_id;
    if (donationId)
      await getDb()
        .prepare(
          `UPDATE donations SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE id=? AND stripe_session_id=?`,
        )
        .bind(donationId, event.data.object.id)
        .run();
  }
  return Response.json({ received: true });
}
