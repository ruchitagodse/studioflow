# Firebase environment selection

| Run | Firebase project | Local file loaded automatically |
| --- | --- | --- |
| `npm run dev` | Testing: `bookingsystem-27cdc` | `.env.development.local` |
| `npm run build`, then `npm start` | Production: `studiocalendar-91fb0` | `.env.production.local` |
| `npm run test:emulator` | Isolated demo project: `demo-studioflow` | Emulator test fixtures |

Next.js sets development mode for `next dev` and production mode for build/start.
No manual key switch or custom environment loader is required. Restart the dev
server after changing keys; rebuild production after changing `NEXT_PUBLIC_*`
values because those values are embedded in the browser bundle at build time.
Always run `npm start` with a build made for the same Firebase environment.

## Local setup

The existing testing configuration was preserved in `.env.local` and copied to
`.env.development.local`. Both mode-specific files take precedence over
`.env.local`. All `.env*` files remain ignored and must not be committed.

The production web configuration supplied by the owner has been placed in
`.env.production.local`, including the matching server project ID. Production
`FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` must come from that same
production project's Admin SDK credentials. Leave them explicitly empty when
credentials have not yet been supplied, to prevent accidental fallback to the
testing project's credentials. Production sign-in/server operations require both
fields to be configured.

Obtain the Admin SDK credentials from the production project's Firebase settings
and put them in the ignored local file or the hosting provider's secret settings.
Never paste the private key in chat, source code, a public variable, or Git.
The Firebase web API key is not the server Admin SDK private key.

Email/password authentication, the Firestore database, rules/indexes, authorized
domains and initial production provisioning must also be configured for the new
project before live use. Existing testing users/data are not migrated by changing
environment variables. No production provisioning or deployment was performed as
part of this environment-file setup.

## Hosting

### Git and Vercel branch mapping

| Git branch / command | Vercel environment | Firebase project |
| --- | --- | --- |
| `dev` (and other feature branches) | Preview | `bookingsystem-27cdc` |
| `main` | Production | `studiocalendar-91fb0` |
| `npm run dev` | Local / Development | `bookingsystem-27cdc` |

Work on `dev` or a feature branch, review the testing preview, and open a PR from
`dev` into `main` for an approved release. A push to `main` triggers production
once the Vercel Git integration is enabled. Never merge only to test a change.

The [Studioflow Vercel project](https://vercel.com/ruchitagodses-projects/studioflow)
is connected to `ruchitagodse/studioflow`. Use Next.js, repository root, Node.js
22.x, `npm run build`, and the default Next.js output directory. Configure the
following variables with separate values for
**Production** and **Preview + Development**:

| Variable | Production value source | Preview / Development value source |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Production web app | Testing web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Production web app | Testing web app |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `studiocalendar-91fb0` | `bookingsystem-27cdc` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Production web app | Testing web app |
| `FIREBASE_PROJECT_ID` | `studiocalendar-91fb0` | `bookingsystem-27cdc` |
| `FIREBASE_CLIENT_EMAIL` | Production Admin service account | Testing Admin service account |
| `FIREBASE_PRIVATE_KEY` | Production Admin private key (secret) | Testing Admin private key (secret) |
| `FIREBASE_SESSION_DAYS` | `5` | `5` |

Keep Admin credentials server-only and mark private keys sensitive in Vercel.
Do not set either project's credentials across all environments. Do not manually
set `NODE_ENV`; Vercel Preview also builds in production mode, so the explicit
Preview Firebase variables select testing.

Verify Vercel's Production branch is `main`. Use the `dev` branch's preview URL
as the testing site, and add each environment's stable hostname to its own
Firebase Authentication authorized domains. After changing variables, rebuild
the affected deployment. Validate that the browser and server project IDs agree
before signing in or creating data. Do not use a production deployment until
the production Admin credentials, Firestore indexes/rules, Auth provider and
initial platform administrator are configured and verified.

Branch creation does not configure Vercel, upload ignored local environment
files, migrate Firebase data, or grant GitHub branch protection. Repository
owners should require PR review and passing checks for `main` before enabling
automatic production releases.

Set the same Firebase variable names in the hosting provider:

- **Production:** the supplied web settings for `studiocalendar-91fb0` plus its
  matching server-only `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and
  `FIREBASE_PRIVATE_KEY`.
- **Development/Preview:** the testing project's matching public and server
  settings. Preview builds also use Next.js production compilation, so their
  hosting environment variables must explicitly identify the testing project.

Hosting/process variables take precedence over local files. Update any existing
production variables that still point to `bookingsystem-27cdc`, then rebuild.
Ignored local files are not uploaded by a Git push; hosting settings must be
configured separately. Never promote a testing build to production without
rebuilding with production web variables.

## Firebase CLI

`.firebaserc` defines `testing` and `production` aliases. The safe default remains
testing. These aliases select CLI targets; they do not select the application's
runtime keys. Use explicit `--project testing` or `--project production` for
authorized CLI operations. Do not deploy rules/indexes or grant platform access
until that operation has been authorized separately.

The existing `bootstrap:super-admin` command loads the testing `.env.local` file.
For a separately authorized production bootstrap, use:

```powershell
node --env-file=.env.production.local scripts/bootstrap-super-admin.mjs --uid=<production-user-uid>
```

References: [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables),
[Firebase environment separation](https://firebase.google.com/docs/projects/dev-workflows/overview-environments),
[Admin SDK credentials](https://firebase.google.com/docs/admin/setup).
