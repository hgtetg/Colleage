import { getDb, getEnv, requireViewer } from '@/lib/campus-db';
import { requireSameOrigin } from '@/lib/auth';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function GET(request: Request) {
  const db = getDb();
  try {
    const viewer = await requireViewer(request, db);
    const key = new URL(request.url).searchParams.get('key') ?? '';
    const allowed =
      key.startsWith(`avatars/${viewer.id}/`) ||
      Boolean(
        await db
          .prepare(
            `SELECT m.id FROM materials m JOIN subjects s ON s.id=m.subject_id JOIN memberships x ON x.course_id=s.course_id WHERE m.object_key=? AND x.user_id=?`,
          )
          .bind(key, viewer.id)
          .first(),
      ) ||
      Boolean(
        await db
          .prepare(
            `SELECT id FROM lecture_drafts WHERE created_by=? AND (lecture_file_key=? OR agent_file_key=?)`,
          )
          .bind(viewer.id, key, key)
          .first(),
      );
    if (!key || !allowed) return new Response('Not found', { status: 404 });
    const object = await getEnv().FILES.get(key);
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'private, max-age=3600');
    return new Response(object.body, { headers });
  } catch (error) {
    return error instanceof Response
      ? error
      : new Response('Unavailable', { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = getDb();
  try {
    requireSameOrigin(request);
    const viewer = await requireViewer(request, db);
    const form = await request.formData();
    const file = form.get('file');
    const rawPurpose = form.get('purpose');
    const purpose = typeof rawPurpose === 'string' ? rawPurpose : 'avatar';
    if (!(file instanceof File))
      return json({ error: 'Choose a file to upload.' }, 400);
    if (file.size > 10 * 1024 * 1024)
      return json({ error: 'Files must be smaller than 10 MB.' }, 400);
    if (purpose === 'avatar') {
      if (
        !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
          file.type,
        )
      )
        return json(
          { error: 'Profile photos must be JPG, PNG, WebP or GIF.' },
          400,
        );
      const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
      const key = `avatars/${viewer.id}/${crypto.randomUUID()}.${extension}`;
      await getEnv().FILES.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { owner: viewer.id, purpose: 'avatar' },
      });
      const previous = await db
        .prepare(`SELECT avatar_key FROM users WHERE id=?`)
        .bind(viewer.id)
        .first<{ avatar_key: string | null }>();
      await db
        .prepare(
          `UPDATE users SET avatar_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        )
        .bind(key, viewer.id)
        .run();
      if (previous?.avatar_key)
        await getEnv().FILES.delete(previous.avatar_key);
      return json({
        ok: true,
        url: `/api/files?key=${encodeURIComponent(key)}`,
      });
    }
    if (viewer.role !== 'representative' && viewer.role !== 'admin')
      return json({ error: 'Representative permission is required.' }, 403);
    const rawSubjectId = form.get('subjectId');
    const rawTitle = form.get('title');
    const subjectId = typeof rawSubjectId === 'string' ? rawSubjectId : '';
    const title = (typeof rawTitle === 'string' ? rawTitle : file.name).trim();
    const subject = await db
      .prepare(`SELECT id FROM subjects WHERE id=?`)
      .bind(subjectId)
      .first();
    if (!subject) return json({ error: 'Choose a valid subject.' }, 400);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-90);
    const key = `materials/${subjectId}/${crypto.randomUUID()}-${safeName}`;
    await getEnv().FILES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
      customMetadata: { owner: viewer.id, purpose: 'material' },
    });
    await db
      .prepare(
        `INSERT INTO materials (id,subject_id,title,material_type,object_key,size_bytes,uploaded_by) VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        subjectId,
        title,
        'file',
        key,
        file.size,
        viewer.id,
      )
      .run();
    return json({ ok: true });
  } catch (error) {
    return error instanceof Response
      ? error
      : json({ error: 'The file could not be uploaded.' }, 500);
  }
}
