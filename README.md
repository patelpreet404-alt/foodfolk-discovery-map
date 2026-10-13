# Foodfolk

Foodfolk is a social restaurant map for finding your next favourite through places your friends have actually recommended. Search verified OpenStreetMap venues, save a shortlist, and write reviews with ratings, photos, dishes, price and audience controls. Connect with friends to see each other's recommendations. A profile doubles as a map of places tried and saved.

The original Cook Along cooking journey and its design story remain available alongside Food Map.

## Run locally

Use Node.js 26. Start the API and web app in separate terminals:

```sh
npm install
npm run api
```

```sh
npm run dev
```

Open the local URL printed by Vite and choose **Food Map** in the top navigation. The API listens on port 3001, persists reviews and photos in `.data/`, and passes the browser's `/api` requests through Vite. For a different API port, start the API with `PORT=3002 npm run api` and the web app with `FOOD_API_PORT=3002 npm run dev`.

To start with a clean local database, stop the API first and remove `.data/`. That folder contains account and review data; it is ignored by Git.

## Workflows

- Create an account, then find another username and send a friend request. A second account can accept the request in **Friends**.
- Search for a restaurant or neighbourhood. Open a restaurant to save it, read permitted reviews, get directions, or publish your own review.
- Choose who can view each review. Friends-only and private photos follow the same access checks as the review.
- Find all of the restaurants you have reviewed in your food passport. Use map bounds and filters to explore.

Restaurant search is performed by the server against Photon and nearby map discovery uses OpenStreetMap's Overpass API. OpenStreetMap tile and data attribution stays visible in the map. Exact location is never requested automatically, saved or shown to other users; the optional nearby control only re-centres the map in the browser.

## Checks

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
node --test server/server.test.mjs
```

The API integration test covers persistence, friendship state, review and photo access control, bookmarks, duplicate review prevention, search de-duplication and request validation.

## Production hosting

The full social application requires a Node.js 26 server and a writable persistent volume for SQLite and uploaded photos. Build a single-container image with `docker build -t foodfolk .` and run it with a persistent volume mounted at `/data`; the Node server serves both the built frontend and `/api` from one HTTPS origin. Keep the volume across restarts and back it up. Set `NODE_ENV=production` in the hosting environment. A static deployment or a serverless function with temporary disk does not provide persistent social accounts, reviews or uploads. Use a durable database and private object storage before adapting the API to a storage-less serverless platform.

Do not commit `.env.local`, tokens, `.data/`, or uploaded images.
