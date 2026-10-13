# Food discovery API

Requires Node.js 26 (built-in SQLite) and the application's `sharp` dependency. Start with `node server/index.mjs`; default port is 3001. Set `PORT`, `HOST` and `FOOD_DATA_DIR` for a persistent-volume host. Development frontend requests `/api` through the Vite proxy. The API does not serve the frontend itself.

SQLite migrations live in `schema.sql` and apply idempotently at startup. Persistent local data and re-encoded image files live in `app/.data`; never commit this directory. Back up the SQLite database and uploads together. `createApp({dataDir})` allows tests and deployments to select an absolute persistent storage directory.

Authentication uses salted scrypt password hashes and hashed, expiring opaque sessions in HttpOnly SameSite cookies. HTTPS deployment must set `NODE_ENV=production` for Secure cookies. Place the API and frontend behind one trusted origin: cross-origin mutations are rejected. No user location is requested or stored.

Each review is public, friends-only, or private. Accepted, mutual friend relationships control friends-only access. Photos are served only through the same permission check; draft photos are visible only to their owner. Uploads accept JPEG, PNG and WebP up to 8 MB and 25 million pixels, re-encode to WebP, strip metadata, and use random filenames. Reviews cannot attach another user's photograph.

Restaurant searches proxy the fixed Photon HTTPS endpoint with a timeout and rate limit; arbitrary URLs are never fetched. Only restaurant/café/fast-food OSM features are accepted. Results are deduplicated by provider ID and normalized name/coordinates. List queries accept validated geographic bounds and cap output at 250 places. OpenStreetMap attribution must remain visible in the UI. Seeded Dishoom Covent Garden and Padella Borough Market names and addresses are verified against official restaurant websites; seed coordinates are approximate entrance locations and IDs are explicitly local catalog IDs, not invented OSM IDs. The catalog contains no fabricated social reviews or accounts.

Run `node --test server/server.test.mjs` for permission and persistence integration checks.

## Deployment boundary

This process needs a persistent disk. A static Vercel deployment or serverless function with temporary storage cannot host this SQLite database or preserve photos. Deploy the Node process behind the frontend origin on a persistent-volume host, or migrate storage to a provisioned durable database and private object store before a live serverless deployment. Do not present a static preview as a live persisted social backend. Configure HTTPS and backups before exposing personal user data publicly.
