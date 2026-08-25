# Rumbl

Rumbl turns a student roster into balanced, role-aware groups. An administrator
defines the seats required in each group, shares a QR code, and shuffles the
registered students once enrollment is ready.

## Stack

- React, TypeScript, and Vite
- Express and TypeScript
- MySQL with Prisma
- Cookie-based admin authentication

## Requirements

- Node.js 20 or newer
- An existing MySQL 8 database

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `server/.env.example` to `server/.env` and set your MySQL connection,
   admin seed credentials, and a long random authentication secret.

3. Create the schema and seed the first admin:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. Start the API and web app:

   ```bash
   npm run dev
   ```

The web app runs at `http://localhost:5173` and proxies `/api` to the API at
`http://localhost:4000`.

## Workflow

1. Sign in as the seeded administrator.
2. Create a session with an expected student count and the roles needed in
   every group.
3. Open enrollment and share the generated link or QR code.
4. Students submit their name and select any role with available capacity.
5. Close enrollment and shuffle. Rumbl fills every required role seat first,
   then distributes remainder students evenly between groups.
6. Reshuffle when a fresh randomized result is needed.

For 40 students with one coder, one UI/UX designer, and one researcher per
group, Rumbl creates 14 groups and keeps every group at a maximum of three
students. The final group may be incomplete.

## Commands

```bash
npm run dev          # client and API
npm run build        # production builds
npm test             # all tests
npm run typecheck    # TypeScript checks
npm run db:generate  # regenerate Prisma client
npm run db:migrate   # apply a development migration
npm run db:seed      # seed/update the admin account
```

`DESIGN.md` is the visual source of truth for the interface.

