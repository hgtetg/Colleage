# Colleage backend setup

The backend uses Cloudflare Pages Functions + D1. The frontend and API stay on the same Pages domain.

## 1. Create the D1 database

In Cloudflare Dashboard, create a D1 database named `colleage-db`.

## 2. Bind D1 to the Pages project

In the Cloudflare Pages project settings, add a D1 binding:

- Variable / binding name: `DB`
- D1 database: `colleage-db`
- Configure both Preview and Production if both environments should use the backend.

The Functions access the database through `env.DB`.

## 3. Initialize the database without a terminal

After Cloudflare deploys the latest commit, open this URL on the same Pages deployment:

```text
https://YOUR-PAGES-DOMAIN.pages.dev/api/setup
```

The setup page checks the D1 binding and all required tables. If the schema is missing, press **Initialize database** once.

The setup endpoint is idempotent: it creates only missing tables/indexes and starter records and does not delete existing data. Once all required tables exist, the page reports **Database ready**.

This creates:

- users
- sessions
- courses
- enrollments
- subjects
- lectures
- grades
- schedule items
- study rooms
- room memberships
- posts
- comments

It also adds a starter public Medical Foundations course and four starter subjects.

### CLI alternative

The original migration remains in `migrations/0001_initial.sql`. Developers who prefer Wrangler can still run:

```bash
npx wrangler d1 execute colleage-db --remote --file=./migrations/0001_initial.sql
```

## 4. Enable manager signup

Manager API permissions are server-enforced. To allow a person to create a manager account, add a Pages secret/environment variable:

- Name: `MANAGER_INVITE_CODE`
- Value: a private random invite code you choose

Do not commit the real code to GitHub. A manager selects Manager on signup and enters this invite code. Students cannot turn themselves into managers by changing frontend state.

Configure the secret separately for Preview and Production if you use both environments.

## 5. Verify the deployed backend

Check:

```text
https://YOUR-PAGES-DOMAIN.pages.dev/api/health
```

Expected response:

```json
{"ok":true,"service":"colleage-api"}
```

Then open:

```text
https://YOUR-PAGES-DOMAIN.pages.dev/api/setup
```

It should show **Database ready** before you create an account.

If `/api/health` returns `D1 binding DB is not configured`, the code is deployed but the Pages project still needs the `DB` binding.

## API overview

### Setup and status

- `GET /api/setup` — browser database setup/status page
- `POST /api/setup` — idempotently create missing application tables
- `GET /api/health`
- `GET /api/dashboard`

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

## Security notes

- Manager permissions are checked in Pages Functions, not trusted from the browser.
- Session tokens are random and only their SHA-256 hashes are stored in D1.
- Session cookies are HttpOnly and Secure on HTTPS.
- Cross-origin write requests are rejected.
- Passwords are derived using Workers Web Crypto PBKDF2.
- Production secrets belong in Cloudflare settings, not the repository.
- `/api/setup` only creates missing schema/starter records; it cannot delete or reset application data.

## Next database changes

Keep future schema updates as additional numbered SQL migrations under `migrations/` rather than editing production tables manually.