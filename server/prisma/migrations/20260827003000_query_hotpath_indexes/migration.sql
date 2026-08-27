-- Indexes for filters, joins, and ordering used by hot read paths.

-- Admin user lists / signup charts ordered or filtered by createdAt
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- Admin role counts and active-admin checks
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- Error log counts filtered by level + createdAt range
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");

-- Owner session list: filter ownerId, order createdAt desc (replaces ownerId-only)
DROP INDEX "Session_ownerId_idx";
CREATE INDEX "Session_ownerId_createdAt_idx" ON "Session"("ownerId", "createdAt");

-- Admin session list ordered by createdAt
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- Admin overview groupBy status
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- Session detail students ordered by createdAt within a session
CREATE INDEX "Student_sessionId_createdAt_idx" ON "Student"("sessionId", "createdAt");

-- Role student counts / FK joins on roleId (composite sessionId_roleId is not leftmost for roleId-only)
CREATE INDEX "Student_roleId_idx" ON "Student"("roleId");
