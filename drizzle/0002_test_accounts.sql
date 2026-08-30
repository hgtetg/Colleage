INSERT OR IGNORE INTO users (
  id, email, password_hash, password_salt, full_name, initials,
  university, college, stage, field, bio, email_verified, status
) VALUES
  ('demo-student', 'student@campushub.test', 'gM891vKDOQFHjBa0nBOs7iz0PeIYt8dEy1+eGc2O3fc=', '52lbuUAInfaETn1M8Fj+qg==', 'Test Student', 'TS', 'Baghdad Technical University', 'College of Computing', 'Year 2', 'Software Engineering', 'Student demonstration account for Campus Hub.', 1, 'active'),
  ('demo-representative', 'representative@campushub.test', 'F7kQOrofcAHMhAx8tswKj0Eb9wc4w0o5BbfaWCigHbA=', '1cA5khPP0dXb6DG+tIz6Og==', 'Test Representative', 'TR', 'Baghdad Technical University', 'College of Computing', 'Year 2', 'Software Engineering', 'Representative demonstration account for inline course management.', 1, 'active');

INSERT OR IGNORE INTO memberships (user_id, course_id, role, attendance) VALUES
  ('demo-student', 'software-engineering-y2-a', 'student', 88),
  ('demo-representative', 'software-engineering-y2-a', 'representative', 96);

INSERT OR IGNORE INTO user_settings (user_id) VALUES
  ('demo-student'),
  ('demo-representative');

INSERT OR IGNORE INTO notifications (id, user_id, title, body, target) VALUES
  ('welcome-demo-student', 'demo-student', 'Welcome to Campus Hub', 'Your student workspace is ready.', 'dashboard'),
  ('welcome-demo-representative', 'demo-representative', 'Representative access is ready', 'Open any course page to find its inline editing controls.', 'subjects');

PRAGMA optimize;
