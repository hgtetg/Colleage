import {
  checkRateLimit,
  clearRateLimit,
  createSession,
  deleteSession,
  hashPassword,
  passwordIsStrong,
  requireSameOrigin,
  sessionCookie,
  verifyPassword,
} from '@/lib/auth';
import {
  campusCourseId,
  getDb,
  getEnv,
  getViewer,
  readCampusState,
  requireViewer,
} from '@/lib/campus-db';

const json = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
};
const value = (input: unknown) =>
  typeof input === 'string' ? input.trim() : '';
const emailOk = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
const audit = (
  db: D1Database,
  userId: string | null,
  action: string,
  detail: string,
  courseId: string | null = campusCourseId,
) =>
  db
    .prepare(
      `INSERT INTO audit_logs (id,course_id,user_id,action,detail) VALUES (?,?,?,?,?)`,
    )
    .bind(crypto.randomUUID(), courseId, userId, action, detail);

export async function GET(request: Request) {
  try {
    return json(await readCampusState(request));
  } catch (error) {
    console.error('Campus GET failed', error);
    return json(
      { error: 'Campus Hub is temporarily unavailable.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const db = getDb();
  try {
    requireSameOrigin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const action = value(body.action);

    if (action === 'signup') {
      const fullName = value(body.fullName).replace(/\s+/g, ' ');
      const email = value(body.email).toLowerCase();
      const password = value(body.password);
      const code = value(body.code).toUpperCase();
      const role =
        body.role === 'representative' ? 'representative' : 'student';
      if (fullName.length < 3 || fullName.length > 80 || !emailOk(email))
        return json(
          { error: 'Enter your real name and a valid email address.' },
          { status: 400 },
        );
      if (!passwordIsStrong(password))
        return json(
          {
            error:
              'Use at least 10 characters with uppercase, lowercase and a number.',
          },
          { status: 400 },
        );
      const key = `signup:${request.headers.get('cf-connecting-ip') ?? 'local'}:${email}`;
      if (!(await checkRateLimit(db, key, 5, 30)))
        return json(
          { error: 'Too many attempts. Please wait 30 minutes.' },
          { status: 429 },
        );
      const join = await db
        .prepare(
          `SELECT id,course_id,role,status,max_uses,use_count,expires_at FROM join_codes WHERE code=?`,
        )
        .bind(code)
        .first<{
          id: string;
          course_id: string;
          role: string;
          status: string;
          max_uses: number | null;
          use_count: number;
          expires_at: string | null;
        }>();
      if (
        !join ||
        join.status !== 'active' ||
        join.role !== role ||
        (join.expires_at && new Date(join.expires_at) < new Date()) ||
        (join.max_uses !== null && join.use_count >= join.max_uses)
      )
        return json(
          { error: 'That course code is not active for the selected role.' },
          { status: 400 },
        );
      if (
        await db
          .prepare(`SELECT id FROM users WHERE email=?`)
          .bind(email)
          .first()
      )
        return json(
          {
            error: 'An account already exists for that email. Sign in instead.',
          },
          { status: 409 },
        );
      const userId = crypto.randomUUID();
      const passwordData = await hashPassword(password);
      const token = await createSessionAfterUser(db, userId, async () => {
        await db.batch([
          db
            .prepare(
              `INSERT INTO users (id,email,password_hash,password_salt,full_name,initials) VALUES (?,?,?,?,?,?)`,
            )
            .bind(
              userId,
              email,
              passwordData.hash,
              passwordData.salt,
              fullName,
              initials(fullName),
            ),
          db
            .prepare(
              `INSERT INTO memberships (user_id,course_id,role,attendance) VALUES (?,?,?,?)`,
            )
            .bind(userId, join.course_id, role, 92),
          db
            .prepare(`UPDATE join_codes SET use_count=use_count+1 WHERE id=?`)
            .bind(join.id),
          db
            .prepare(`INSERT INTO user_settings (user_id) VALUES (?)`)
            .bind(userId),
          db
            .prepare(
              `INSERT INTO notifications (id,user_id,title,body,target) VALUES (?,?,?,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              userId,
              'Welcome to Campus Hub',
              'Your verified course workspace is ready.',
              'dashboard',
            ),
          audit(
            db,
            userId,
            'account_created',
            `${fullName} joined as ${role}`,
            join.course_id,
          ),
        ]);
      });
      await clearRateLimit(db, key);
      const response = json({ ok: true });
      response.headers.append('set-cookie', sessionCookie(request, token));
      return response;
    }

    if (action === 'login') {
      const email = value(body.email).toLowerCase();
      const password = value(body.password);
      const key = `login:${request.headers.get('cf-connecting-ip') ?? 'local'}:${email}`;
      if (!emailOk(email) || !password)
        return json(
          { error: 'Enter your email and password.' },
          { status: 400 },
        );
      if (!(await checkRateLimit(db, key, 8, 15)))
        return json(
          { error: 'Too many sign-in attempts. Please wait 15 minutes.' },
          { status: 429 },
        );
      const user = await db
        .prepare(
          `SELECT id,password_hash,password_salt,status FROM users WHERE email=?`,
        )
        .bind(email)
        .first<{
          id: string;
          password_hash: string;
          password_salt: string;
          status: string;
        }>();
      if (
        !user ||
        user.status !== 'active' ||
        !(await verifyPassword(
          password,
          user.password_hash,
          user.password_salt,
        ))
      )
        return json(
          { error: 'Email or password is incorrect.' },
          { status: 401 },
        );
      const token = await createSession(db, user.id);
      await clearRateLimit(db, key);
      await audit(
        db,
        user.id,
        'signed_in',
        'Successful account sign in',
        null,
      ).run();
      const response = json({ ok: true });
      response.headers.append('set-cookie', sessionCookie(request, token));
      return response;
    }

    if (action === 'logout') {
      const viewer = await getViewer(request, db);
      await deleteSession(db, request);
      if (viewer)
        await audit(
          db,
          viewer.id,
          'signed_out',
          'Account signed out',
          null,
        ).run();
      const response = json({ ok: true });
      response.headers.append('set-cookie', sessionCookie(request, null));
      return response;
    }

    if (action === 'forgot_password') {
      const email = value(body.email).toLowerCase();
      if (!emailOk(email))
        return json({ error: 'Enter a valid email address.' }, { status: 400 });
      const user = await db
        .prepare(`SELECT id FROM users WHERE email=?`)
        .bind(email)
        .first<{ id: string }>();
      if (user)
        await audit(
          db,
          user.id,
          'password_reset_requested',
          'Password reset requested; email delivery provider not configured',
          null,
        ).run();
      return json({
        ok: true,
        message:
          'If an account exists, reset instructions will be sent when email delivery is enabled.',
      });
    }

    const viewer = await requireViewer(request, db);

    if (action === 'create_post') {
      const text = value(body.text);
      if (text.length < 2 || text.length > 1500)
        return json(
          { error: 'Posts must be between 2 and 1,500 characters.' },
          { status: 400 },
        );
      await db.batch([
        db
          .prepare(
            `INSERT INTO posts (id,course_id,user_id,body,pinned) VALUES (?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            campusCourseId,
            viewer.id,
            text,
            viewer.role === 'representative' && body.pinned ? 1 : 0,
          ),
        audit(db, viewer.id, 'post_created', 'Published a community post'),
      ]);
      return json({ ok: true });
    }
    if (action === 'toggle_reaction') {
      const postId = value(body.postId);
      const existing = await db
        .prepare(
          `SELECT post_id FROM post_reactions WHERE post_id=? AND user_id=?`,
        )
        .bind(postId, viewer.id)
        .first();
      if (existing)
        await db
          .prepare(`DELETE FROM post_reactions WHERE post_id=? AND user_id=?`)
          .bind(postId, viewer.id)
          .run();
      else
        await db
          .prepare(
            `INSERT INTO post_reactions (post_id,user_id) SELECT id,? FROM posts WHERE id=? AND course_id=?`,
          )
          .bind(viewer.id, postId, campusCourseId)
          .run();
      return json({ ok: true });
    }
    if (action === 'reply') {
      const postId = value(body.postId),
        text = value(body.text);
      if (text.length < 2 || text.length > 600)
        return json(
          { error: 'Replies must be between 2 and 600 characters.' },
          { status: 400 },
        );
      const post = await db
        .prepare(`SELECT id FROM posts WHERE id=? AND course_id=?`)
        .bind(postId, campusCourseId)
        .first();
      if (!post) return json({ error: 'Post not found.' }, { status: 404 });
      await db
        .prepare(
          `INSERT INTO post_replies (id,post_id,user_id,body) VALUES (?,?,?,?)`,
        )
        .bind(crypto.randomUUID(), postId, viewer.id, text)
        .run();
      return json({ ok: true });
    }
    if (action === 'complete_lecture') {
      const lectureId = value(body.lectureId);
      const exists = await db
        .prepare(
          `SELECT lecture_id FROM lecture_progress WHERE user_id=? AND lecture_id=?`,
        )
        .bind(viewer.id, lectureId)
        .first();
      if (exists)
        await db
          .prepare(
            `DELETE FROM lecture_progress WHERE user_id=? AND lecture_id=?`,
          )
          .bind(viewer.id, lectureId)
          .run();
      else
        await db
          .prepare(
            `INSERT INTO lecture_progress (user_id,lecture_id) SELECT ?,l.id FROM lectures l JOIN subjects s ON s.id=l.subject_id WHERE l.id=? AND s.course_id=?`,
          )
          .bind(viewer.id, lectureId, campusCourseId)
          .run();
      return json({ ok: true });
    }
    if (action === 'book_room') {
      const roomId = value(body.roomId);
      const existing = await db
        .prepare(
          `SELECT id FROM bookings WHERE room_id=? AND user_id=? AND status='confirmed'`,
        )
        .bind(roomId, viewer.id)
        .first<{ id: string }>();
      if (existing)
        await db
          .prepare(`UPDATE bookings SET status='cancelled' WHERE id=?`)
          .bind(existing.id)
          .run();
      else {
        const start = new Date(Date.now() + 86_400_000);
        start.setUTCHours(11, 30, 0, 0);
        await db
          .prepare(
            `INSERT INTO bookings (id,room_id,user_id,starts_at,ends_at) SELECT ?,id,?,?,? FROM rooms WHERE id=?`,
          )
          .bind(
            crypto.randomUUID(),
            viewer.id,
            start.toISOString(),
            new Date(start.getTime() + 3_600_000).toISOString(),
            roomId,
          )
          .run();
      }
      return json({ ok: true });
    }
    if (action === 'submit_application') {
      const opportunityId = value(body.opportunityId),
        statement = value(body.statement),
        phone = value(body.phone);
      if (statement.length < 40 || statement.length > 2000)
        return json(
          {
            error:
              'Tell the reviewer why you are a fit in 40–2,000 characters.',
          },
          { status: 400 },
        );
      await db
        .prepare(
          `INSERT INTO applications (id,opportunity_id,user_id,statement,phone) SELECT ?,id,?,?,? FROM opportunities WHERE id=? AND status='open' ON CONFLICT(opportunity_id,user_id) DO UPDATE SET statement=excluded.statement,phone=excluded.phone,status='submitted',updated_at=CURRENT_TIMESTAMP`,
        )
        .bind(crypto.randomUUID(), viewer.id, statement, phone, opportunityId)
        .run();
      await audit(
        db,
        viewer.id,
        'application_submitted',
        `Submitted application for ${opportunityId}`,
        null,
      ).run();
      return json({ ok: true });
    }
    if (action === 'update_profile') {
      const fullName = value(body.fullName).replace(/\s+/g, ' '),
        bio = value(body.bio),
        university = value(body.university),
        college = value(body.college),
        stage = value(body.stage),
        field = value(body.field);
      if (fullName.length < 3 || fullName.length > 80 || bio.length > 500)
        return json(
          { error: 'Check your name and keep the bio under 500 characters.' },
          { status: 400 },
        );
      await db
        .prepare(
          `UPDATE users SET full_name=?,initials=?,bio=?,university=?,college=?,stage=?,field=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        )
        .bind(
          fullName,
          initials(fullName),
          bio,
          university || viewer.university,
          college || viewer.college,
          stage || viewer.stage,
          field || viewer.field,
          viewer.id,
        )
        .run();
      return json({ ok: true });
    }
    if (action === 'update_settings') {
      const bool = (name: string, current: boolean) =>
        typeof body[name] === 'boolean'
          ? body[name]
            ? 1
            : 0
          : current
            ? 1
            : 0;
      const state = await readCampusState(request, db);
      await db
        .prepare(
          `INSERT INTO user_settings (user_id,announcements,reminders,product_updates,language,theme,profile_visibility) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET announcements=excluded.announcements,reminders=excluded.reminders,product_updates=excluded.product_updates,language=excluded.language,theme=excluded.theme,profile_visibility=excluded.profile_visibility`,
        )
        .bind(
          viewer.id,
          bool('announcements', state.settings.announcements),
          bool('reminders', state.settings.reminders),
          bool('productUpdates', state.settings.productUpdates),
          value(body.language) || state.settings.language,
          value(body.theme) || state.settings.theme,
          value(body.profileVisibility) || state.settings.profileVisibility,
        )
        .run();
      return json({ ok: true });
    }
    if (action === 'mark_notifications_read') {
      await db
        .prepare(
          `UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL`,
        )
        .bind(viewer.id)
        .run();
      return json({ ok: true });
    }

    if (action === 'create_donation') {
      const amount = Math.round(Number(body.amount));
      const email = value(body.email) || viewer.email;
      if (
        !Number.isFinite(amount) ||
        amount < 2 ||
        amount > 5000 ||
        !emailOk(email)
      )
        return json(
          {
            error: 'Choose an amount between $2 and $5,000 and a valid email.',
          },
          { status: 400 },
        );
      const stripe = getEnv().STRIPE_SECRET_KEY;
      if (!stripe)
        return json(
          {
            error:
              'Secure card checkout is ready, but the owner must connect a Stripe secret key before payments can be accepted.',
            needsConfiguration: true,
          },
          { status: 503 },
        );
      const donationId = crypto.randomUUID();
      const origin = getEnv().APP_URL || new URL(request.url).origin;
      const form = new URLSearchParams();
      form.set('mode', 'payment');
      form.set('success_url', `${origin}/?donation=success`);
      form.set('cancel_url', `${origin}/?donation=cancelled`);
      form.set('customer_email', email);
      form.set('line_items[0][price_data][currency]', 'usd');
      form.set(
        'line_items[0][price_data][product_data][name]',
        'Campus Hub student access',
      );
      form.set('line_items[0][price_data][unit_amount]', String(amount * 100));
      form.set('line_items[0][quantity]', '1');
      form.set('metadata[donation_id]', donationId);
      form.set('payment_intent_data[metadata][donation_id]', donationId);
      const stripeResponse = await fetch(
        'https://api.stripe.com/v1/checkout/sessions',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${stripe}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: form,
        },
      );
      const session = (await stripeResponse.json()) as {
        id?: string;
        url?: string;
        error?: { message?: string };
      };
      if (!stripeResponse.ok || !session.id || !session.url)
        return json(
          {
            error:
              session.error?.message || 'Payment checkout could not start.',
          },
          { status: 502 },
        );
      await db
        .prepare(
          `INSERT INTO donations (id,user_id,email,amount,stripe_session_id) VALUES (?,?,?,?,?)`,
        )
        .bind(donationId, viewer.id, email, amount * 100, session.id)
        .run();
      return json({ ok: true, url: session.url });
    }

    if (viewer.role !== 'representative' && viewer.role !== 'admin')
      return json(
        { error: 'Representative permission is required.' },
        { status: 403 },
      );
    if (action === 'toggle_code') {
      const status = body.status === 'paused' ? 'paused' : 'active';
      await db.batch([
        db
          .prepare(
            `UPDATE join_codes SET status=? WHERE course_id=? AND role='student' AND status!='invalid'`,
          )
          .bind(status, campusCourseId),
        audit(
          db,
          viewer.id,
          'join_code_status',
          `Student join code set to ${status}`,
        ),
      ]);
      return json({ ok: true });
    }
    if (action === 'regenerate_code') {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const suffix = Array.from(
        crypto.getRandomValues(new Uint8Array(4)),
        (byte) => alphabet[byte % alphabet.length],
      ).join('');
      const next = `DSA2-${suffix}`;
      await db.batch([
        db
          .prepare(
            `UPDATE join_codes SET status='invalid' WHERE course_id=? AND role='student'`,
          )
          .bind(campusCourseId),
        db
          .prepare(
            `INSERT INTO join_codes (id,course_id,code,role,status,max_uses,created_by) VALUES (?,?,?,'student','active',500,?)`,
          )
          .bind(crypto.randomUUID(), campusCourseId, next, viewer.id),
        audit(
          db,
          viewer.id,
          'join_code_regenerated',
          `Student code changed to ${next}`,
        ),
      ]);
      return json({ ok: true, code: next });
    }
    if (action === 'add_subject') {
      const name = value(body.name),
        code = value(body.code).toUpperCase(),
        topic = value(body.topic) || 'First lecture';
      if (name.length < 2 || code.length < 2)
        return json(
          { error: 'Enter a subject name and code.' },
          { status: 400 },
        );
      await db
        .prepare(
          `INSERT INTO subjects (id,course_id,name,code,color,next_topic,initials) VALUES (?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          campusCourseId,
          name,
          code,
          'teal',
          topic,
          initials(name),
        )
        .run();
      return json({ ok: true });
    }
    if (action === 'add_schedule') {
      const title = value(body.title),
        location = value(body.location),
        startsAt = value(body.startsAt),
        endsAt = value(body.endsAt);
      if (
        title.length < 2 ||
        location.length < 2 ||
        !startsAt ||
        !endsAt ||
        new Date(endsAt) <= new Date(startsAt)
      )
        return json(
          { error: 'Enter a title, location and valid start/end time.' },
          { status: 400 },
        );
      await db
        .prepare(
          `INSERT INTO schedule_entries (id,course_id,starts_at,ends_at,title,location,tone,entry_type,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          campusCourseId,
          startsAt,
          endsAt,
          title,
          location,
          'teal',
          value(body.type) || 'class',
          value(body.notes),
          viewer.id,
        )
        .run();
      return json({ ok: true });
    }
    return json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Campus POST failed', error);
    return json(
      { error: 'We could not save that change. Please try again.' },
      { status: 500 },
    );
  }
}

async function createSessionAfterUser(
  db: D1Database,
  userId: string,
  insert: () => Promise<void>,
) {
  await insert();
  return createSession(db, userId);
}
