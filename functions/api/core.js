const COOKIE='colleage_session';
let tablesReady=false;

export async function onRequest({request,env}){
  if(!env.DB)return reply({error:'D1 binding DB is not configured.'},503);
  try{
    if(['POST','PATCH','DELETE','PUT'].includes(request.method))sameOrigin(request);
    await ensureTables(env.DB);
    const user=await requireUser(request,env.DB);
    const url=new URL(request.url);
    if(request.method==='GET')return handleGet(env.DB,user,url.searchParams);
    if(request.method==='POST')return handlePost(env.DB,user,await body(request));
    return reply({error:'Method not allowed.'},405);
  }catch(e){
    if(e instanceof HttpError)return reply({error:e.message},e.status);
    console.error('Core API error',e);
    return reply({error:'The study action could not be completed.'},500);
  }
}

async function ensureTables(db){
  if(tablesReady)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS lecture_progress (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN(0,1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id,lecture_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_progress_user ON lecture_progress(user_id,completed)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id,created_at)')
  ]);
  tablesReady=true;
}

async function handleGet(db,user,q){
  const action=q.get('action')||'dashboard';
  if(action==='dashboard')return dashboard(db,user);
  if(action==='subjects')return subjects(db,user);
  if(action==='subject')return subject(db,user,q.get('subjectId'));
  if(action==='room')return room(db,user,q.get('roomId'));
  if(action==='members')return members(db,user);
  throw new HttpError(404,'Core action not found.');
}

async function handlePost(db,user,b){
  const action=String(b.action||'');
  if(action==='progress')return setProgress(db,user,b);
  if(action==='roomMessage')return addRoomMessage(db,user,b);
  if(action==='updateLecture')return updateLecture(db,user,b);
  if(action==='deleteLecture')return deleteLecture(db,user,b);
  if(action==='deleteGrade')return deleteGrade(db,user,b);
  if(action==='roomState')return roomState(db,user,b);
  if(action==='deleteRoom')return deleteRoom(db,user,b);
  throw new HttpError(404,'Core action not found.');
}

async function dashboard(db,user){
  const courseId=await activeCourse(db,user.id);
  if(!courseId)return reply({courseId:null,counts:{},upcoming:[],subjects:[]});
  const [total,done,grade,schedule,rooms,upcoming,subjectRows]=await Promise.all([
    db.prepare('SELECT COUNT(*) n FROM lectures l JOIN subjects s ON s.id=l.subject_id WHERE s.course_id=?').bind(courseId).first(),
    db.prepare(`SELECT COUNT(*) n FROM lecture_progress p JOIN lectures l ON l.id=p.lecture_id JOIN subjects s ON s.id=l.subject_id WHERE p.user_id=? AND p.completed=1 AND s.course_id=?`).bind(user.id,courseId).first(),
    db.prepare(`SELECT ROUND(SUM(g.score/g.max_score*g.weight)*100.0/NULLIF(SUM(g.weight),0),1) n FROM grades g JOIN subjects s ON s.id=g.subject_id WHERE g.user_id=? AND s.course_id=?`).bind(user.id,courseId).first(),
    db.prepare('SELECT COUNT(*) n FROM schedule_items WHERE user_id=? AND completed=0').bind(user.id).first(),
    db.prepare('SELECT COUNT(*) n FROM study_rooms WHERE course_id=? AND is_live=1').bind(courseId).first(),
    db.prepare(`SELECT id,title,start_at,end_at,type,location,completed FROM schedule_items WHERE user_id=? AND completed=0 AND start_at>=? ORDER BY start_at LIMIT 5`).bind(user.id,new Date(Date.now()-86400000).toISOString()).all(),
    db.prepare(`SELECT s.id,s.name,s.code,
      COUNT(l.id) lecture_count,
      COALESCE(SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END),0) completed_lectures,
      COALESCE(ROUND(SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(l.id),0),0),0) progress,
      COALESCE((SELECT ROUND(SUM(g.score/g.max_score*g.weight)*100.0/NULLIF(SUM(g.weight),0),1) FROM grades g WHERE g.subject_id=s.id AND g.user_id=?),0) grade
      FROM subjects s LEFT JOIN lectures l ON l.subject_id=s.id LEFT JOIN lecture_progress p ON p.lecture_id=l.id AND p.user_id=?
      WHERE s.course_id=? GROUP BY s.id ORDER BY s.name`).bind(user.id,user.id,courseId).all()
  ]);
  return reply({courseId,counts:{totalLectures:Number(total?.n||0),completedLectures:Number(done?.n||0),averageGrade:Number(grade?.n||0),openSchedule:Number(schedule?.n||0),liveRooms:Number(rooms?.n||0)},upcoming:upcoming.results||[],subjects:subjectRows.results||[]});
}

async function subjects(db,user){
  const courseId=await activeCourse(db,user.id);
  if(!courseId)return reply({courseId:null,subjects:[]});
  const rows=await db.prepare(`SELECT s.id,s.name,s.code,s.description,s.icon,
    COUNT(l.id) lecture_count,
    COALESCE(SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END),0) completed_lectures,
    COALESCE(ROUND(SUM(CASE WHEN p.completed=1 THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(l.id),0),0),0) progress,
    COALESCE((SELECT ROUND(SUM(g.score/g.max_score*g.weight)*100.0/NULLIF(SUM(g.weight),0),1) FROM grades g WHERE g.subject_id=s.id AND g.user_id=?),0) grade
    FROM subjects s LEFT JOIN lectures l ON l.subject_id=s.id LEFT JOIN lecture_progress p ON p.lecture_id=l.id AND p.user_id=?
    WHERE s.course_id=? GROUP BY s.id ORDER BY s.name`).bind(user.id,user.id,courseId).all();
  return reply({courseId,subjects:rows.results||[]});
}

async function subject(db,user,subjectId){
  if(!subjectId)throw new HttpError(400,'subjectId is required.');
  const s=await db.prepare('SELECT * FROM subjects WHERE id=?').bind(subjectId).first();
  if(!s)throw new HttpError(404,'Subject not found.');
  await requireCourseAccess(db,user.id,s.course_id);
  const [lectures,grades]=await Promise.all([
    db.prepare(`SELECT l.*,COALESCE(p.completed,0) completed FROM lectures l LEFT JOIN lecture_progress p ON p.lecture_id=l.id AND p.user_id=? WHERE l.subject_id=? ORDER BY l.position,l.created_at`).bind(user.id,subjectId).all(),
    db.prepare('SELECT * FROM grades WHERE subject_id=? AND user_id=? ORDER BY created_at DESC').bind(subjectId,user.id).all()
  ]);
  return reply({subject:s,lectures:lectures.results||[],grades:grades.results||[]});
}

async function room(db,user,roomId){
  if(!roomId)throw new HttpError(400,'roomId is required.');
  const r=await db.prepare(`SELECT r.*,u.full_name creator_name,
    (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id=r.id) member_count,
    EXISTS(SELECT 1 FROM room_members rm WHERE rm.room_id=r.id AND rm.user_id=?) joined
    FROM study_rooms r JOIN users u ON u.id=r.created_by WHERE r.id=?`).bind(user.id,roomId).first();
  if(!r)throw new HttpError(404,'Room not found.');
  await requireCourseAccess(db,user.id,r.course_id);
  const msgs=await db.prepare(`SELECT m.id,m.body,m.created_at,m.user_id,u.full_name FROM room_messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY m.created_at LIMIT 200`).bind(roomId).all();
  return reply({room:r,messages:msgs.results||[]});
}

async function members(db,user){
  manager(user);
  const courseId=await activeCourse(db,user.id);
  if(!courseId)return reply({members:[]});
  const rows=await db.prepare(`SELECT u.id,u.full_name fullName,u.email,u.stage,u.field FROM enrollments e JOIN users u ON u.id=e.user_id WHERE e.course_id=? ORDER BY u.full_name`).bind(courseId).all();
  return reply({members:rows.results||[]});
}

async function setProgress(db,user,b){
  const lectureId=String(b.lectureId||'');
  const lecture=await db.prepare('SELECT l.id,s.course_id FROM lectures l JOIN subjects s ON s.id=l.subject_id WHERE l.id=?').bind(lectureId).first();
  if(!lecture)throw new HttpError(404,'Lecture not found.');
  await requireCourseAccess(db,user.id,lecture.course_id);
  await db.prepare(`INSERT INTO lecture_progress(user_id,lecture_id,completed,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id,lecture_id) DO UPDATE SET completed=excluded.completed,updated_at=CURRENT_TIMESTAMP`).bind(user.id,lectureId,b.completed?1:0).run();
  return reply({ok:true});
}

async function addRoomMessage(db,user,b){
  const roomId=String(b.roomId||''); const text=String(b.body||'').trim();
  if(!text||text.length>1200)throw new HttpError(400,'Message must be between 1 and 1200 characters.');
  const r=await db.prepare('SELECT is_live FROM study_rooms WHERE id=?').bind(roomId).first();
  if(!r)throw new HttpError(404,'Room not found.');
  if(!Number(r.is_live))throw new HttpError(409,'This room is closed.');
  const joined=await db.prepare('SELECT 1 ok FROM room_members WHERE room_id=? AND user_id=?').bind(roomId,user.id).first();
  if(!joined)throw new HttpError(403,'Join the room before sending messages.');
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO room_messages(id,room_id,user_id,body) VALUES(?,?,?,?)').bind(id,roomId,user.id,text).run();
  return reply({id});
}

async function updateLecture(db,user,b){
  manager(user); const id=String(b.lectureId||'');
  const l=await db.prepare('SELECT l.*,s.course_id FROM lectures l JOIN subjects s ON s.id=l.subject_id WHERE l.id=?').bind(id).first();
  if(!l)throw new HttpError(404,'Lecture not found.'); await requireCourseAccess(db,user.id,l.course_id);
  await db.prepare(`UPDATE lectures SET title=?,position=?,summary=?,notes_url=?,flashcards_url=?,mind_map_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(
    String(b.title||l.title).trim()||l.title, Number(b.position)||l.position, optional(b.summary), optional(b.notesUrl), optional(b.flashcardsUrl), optional(b.mindMapUrl), id).run();
  return reply({ok:true});
}

async function deleteLecture(db,user,b){
  manager(user); const id=String(b.lectureId||'');
  const l=await db.prepare('SELECT s.course_id FROM lectures l JOIN subjects s ON s.id=l.subject_id WHERE l.id=?').bind(id).first();
  if(!l)throw new HttpError(404,'Lecture not found.'); await requireCourseAccess(db,user.id,l.course_id);
  await db.prepare('DELETE FROM lectures WHERE id=?').bind(id).run(); return reply({ok:true});
}

async function deleteGrade(db,user,b){
  manager(user); const id=String(b.gradeId||'');
  const g=await db.prepare('SELECT s.course_id FROM grades g JOIN subjects s ON s.id=g.subject_id WHERE g.id=?').bind(id).first();
  if(!g)throw new HttpError(404,'Grade not found.'); await requireCourseAccess(db,user.id,g.course_id);
  await db.prepare('DELETE FROM grades WHERE id=?').bind(id).run(); return reply({ok:true});
}

async function roomState(db,user,b){
  const id=String(b.roomId||''); const r=await db.prepare('SELECT created_by,course_id FROM study_rooms WHERE id=?').bind(id).first();
  if(!r)throw new HttpError(404,'Room not found.'); await requireCourseAccess(db,user.id,r.course_id);
  if(r.created_by!==user.id&&user.role!=='manager')throw new HttpError(403,'Only the room creator or a manager can change its status.');
  await db.prepare('UPDATE study_rooms SET is_live=? WHERE id=?').bind(b.isLive?1:0,id).run(); return reply({ok:true});
}

async function deleteRoom(db,user,b){
  const id=String(b.roomId||''); const r=await db.prepare('SELECT created_by,course_id FROM study_rooms WHERE id=?').bind(id).first();
  if(!r)throw new HttpError(404,'Room not found.'); await requireCourseAccess(db,user.id,r.course_id);
  if(r.created_by!==user.id&&user.role!=='manager')throw new HttpError(403,'Only the room creator or a manager can delete it.');
  await db.prepare('DELETE FROM study_rooms WHERE id=?').bind(id).run(); return reply({ok:true});
}

async function requireUser(request,db){
  const token=cookie(request,COOKIE); if(!token)throw new HttpError(401,'Sign in to continue.');
  const hash=await sha256(token);
  const u=await db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(hash,Date.now()).first();
  if(!u)throw new HttpError(401,'Your session has expired.'); return u;
}
async function activeCourse(db,userId){const r=await db.prepare('SELECT course_id FROM enrollments WHERE user_id=? ORDER BY is_active DESC,position LIMIT 1').bind(userId).first();return r?.course_id||null;}
async function requireCourseAccess(db,userId,courseId){if(!courseId)throw new HttpError(403,'Course access required.');const r=await db.prepare('SELECT 1 ok FROM enrollments WHERE user_id=? AND course_id=?').bind(userId,courseId).first();if(!r)throw new HttpError(403,'You are not enrolled in this course.');}
function manager(user){if(user.role!=='manager')throw new HttpError(403,'Manager permission required.');}
function optional(v){if(v===undefined)return null;const s=String(v??'').trim();return s||null;}
function sameOrigin(r){const o=r.headers.get('origin');if(o&&o!==new URL(r.url).origin)throw new HttpError(403,'Cross-origin write blocked.');}
async function body(r){if(!(r.headers.get('content-type')||'').includes('application/json'))throw new HttpError(415,'Send JSON.');try{return await r.json()}catch{throw new HttpError(400,'Invalid JSON.')}}
function cookie(r,n){for(const p of (r.headers.get('cookie')||'').split(';')){const [k,...v]=p.trim().split('=');if(k===n)return decodeURIComponent(v.join('='));}return null;}
async function sha256(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
