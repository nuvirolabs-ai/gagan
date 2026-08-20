-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "IdentityRealm" AS ENUM ('retailer', 'staff', 'admin');

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employeeRef" TEXT,
    "status" "StaffStatus" NOT NULL DEFAULT 'active',
    "salesRepId" TEXT,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRole" (
    "staffId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("staffId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "RoleDelegation" (
    "id" TEXT NOT NULL,
    "delegatorStaffId" TEXT NOT NULL,
    "delegateeStaffId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" TEXT NOT NULL,
    "realm" "IdentityRealm" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "realm" "IdentityRealm" NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "requestIpHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepUpChallenge" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepUpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorStaffId" TEXT,
    "action" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_phone_key" ON "StaffUser"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_employeeRef_key" ON "StaffUser"("employeeRef");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_salesRepId_key" ON "StaffUser"("salesRepId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_adminUserId_key" ON "StaffUser"("adminUserId");

-- CreateIndex
CREATE INDEX "StaffUser_status_idx" ON "StaffUser"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "StaffRole_roleId_idx" ON "StaffRole"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "RoleDelegation_delegateeStaffId_startsAt_endsAt_idx" ON "RoleDelegation"("delegateeStaffId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "RoleDelegation_delegatorStaffId_idx" ON "RoleDelegation"("delegatorStaffId");

-- CreateIndex
CREATE INDEX "RoleDelegation_roleId_idx" ON "RoleDelegation"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSession_refreshTokenHash_key" ON "DeviceSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "DeviceSession_realm_subjectId_revokedAt_idx" ON "DeviceSession"("realm", "subjectId", "revokedAt");

-- CreateIndex
CREATE INDEX "DeviceSession_tokenFamilyId_idx" ON "DeviceSession"("tokenFamilyId");

-- CreateIndex
CREATE INDEX "DeviceSession_expiresAt_idx" ON "DeviceSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_realm_phone_createdAt_idx" ON "OtpChallenge"("realm", "phone", "createdAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "StepUpChallenge_sessionId_expiresAt_idx" ON "StepUpChallenge"("sessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorStaffId_createdAt_idx" ON "AuditEvent"("actorStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_subjectType_subjectId_createdAt_idx" ON "AuditEvent"("subjectType", "subjectId", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDelegation" ADD CONSTRAINT "RoleDelegation_delegatorStaffId_fkey" FOREIGN KEY ("delegatorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDelegation" ADD CONSTRAINT "RoleDelegation_delegateeStaffId_fkey" FOREIGN KEY ("delegateeStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDelegation" ADD CONSTRAINT "RoleDelegation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepUpChallenge" ADD CONSTRAINT "StepUpChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A delegated role must have a real, bounded validity window.
ALTER TABLE "RoleDelegation" ADD CONSTRAINT "RoleDelegation_valid_window_check" CHECK ("endsAt" > "startsAt");
