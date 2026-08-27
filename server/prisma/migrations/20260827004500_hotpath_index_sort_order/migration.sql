-- Prefer DESC sort order matching hot orderBy createdAt desc queries.
DROP INDEX IF EXISTS "User_createdAt_idx";
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt" DESC);

DROP INDEX IF EXISTS "Session_ownerId_createdAt_idx";
CREATE INDEX "Session_ownerId_createdAt_idx" ON "Session"("ownerId", "createdAt" DESC);

DROP INDEX IF EXISTS "Session_createdAt_idx";
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt" DESC);
