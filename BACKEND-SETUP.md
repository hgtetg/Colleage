# Colleage backend setup

The backend uses Cloudflare Pages Functions + D1. The frontend and API stay on the same Pages domain.

## 1. Create the D1 database

In Cloudflare Dashboard, create a D1 database named `colleage-db`.

CLI alternative:

```bash
npx wrangler d1 create colleage-db
```

## 2. Apply the database schema

From the repository root:

```bash
npx wrangler d1 execute colleage-db --remote --file=./migrations/0001_initial.sql
```

This creates users, sessions, courses, enrollments, subjects, lectures, grades, schedules, study rooms, room memberships, posts and comments. It also adds a starter public Medical Foundations course.

## 3. Bind D1 to the Pages project

In the Cloudflare Pages project settings, add a D1 binding:

- Variable / binding name: `DB`
- D1 database: `colleage-db`
- Configure production, and preview too if you want preview deployments to use D1.

The Functions access the database through `env.DB`.

## 4. Enable manager signup

Manager API permissions are server-enforced. To allow a person to create a manager account, add a Pages secret/environment variable:

- Name: `MANAGER_INVITE_CODE`
- Value: a private random invite code you choose

Do not commit the real code to GitHub. A manager selects Manager on signup and enters this invite code. Students cannot turn themselves into managers by changing frontend state.

## 5. Deploy

Once the backend branch is merged into the branch deployed by Cloudflare Pages, Cloudflare will detect the root `/functions` directory and deploy the API routes with the site.

Check the deployed backend at:

```text
https://YOUR-PAGES-DOMAIN.pages.dev/api/health
```

Expected response:

```json
{"ok":true,"service":"colleage-api"}
```

If it returns `D1 binding DB is not configured`, the code is deployed but the Pages project still needs the `DB` binding.

## API overview

### Authentication

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/profile`
- `PATCH /api/profile`

Sessions use an HttpOnly, SameSite cookie. Passwords are stored as salted PBKDF2-SHA-256 hashes, not plaintext passwords.

### Courses

- `GET /api/courses`
- `POST /api/courses` — manager only
- `POST /api/courses/:id/enroll`
- `POST /api/courses/:id/activate`

A student can have up to three course enrollments and one active course. During signup, the backend tries to match a non-public course against stage, field, institution type and institution name.

### Subjects and learning data

- `GET /api/subjects`
- `POST /api/subjects` — manager only
- `PATCH /api/subjects/:id` — manager only
- `DELETE /api/subjects/:id` — manager only
- `GET /api/subjects/:id/lectures`
- `POST /api/subjects/:id/lectures` — manager only
- `GET /api/subjects/:id/grades`
- `POST /api/subjects/:id/grades` — manager only

### Schedule

- `GET /api/schedule`
- `POST /api/schedule`
- `PATCH /api/schedule/:id`
- `DELETE /api/schedule/:id`

### Study rooms

- `GET /api/rooms`
- `POST /api/rooms`
- `POST /api/rooms/:id/join`
- `DELETE /api/rooms/:id/join`

### Community

- `GET /api/posts`
- `POST /api/posts`
- `DELETE /api/posts/:id`
- `GET /api/posts/:id/comments`
- `POST /api/posts/:id/comments`

### Status

- `GET /api/health`
- `GET /api/dashboard`

## Security notes

- Manager permissions are checked in Pages Functions, not trusted from the browser.
- Session tokens are random and only their SHA-256 hashes are stored in D1.
- Session cookies are HttpOnly and Secure on HTTPS.
- Cross-origin write requests are rejected.
- Passwords are derived using Workers Web Crypto PBKDF2.
- Production secrets belong in Cloudflare settings, not the repository.

## Next database changes

Keep future schema updates as additional numbered SQL migrations under `migrations/` rather than editing production tables manually.
