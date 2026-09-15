-- Internal commercial statuses are an additive staff/admin read model. They
-- do not alter canonical order, payment, invoice, credit, or SAP states.
CREATE TYPE "CommercialStatusCode" AS ENUM (
  'ACCOUNT_OPENED',
  'RATE_APPROVAL_SENT',
  'SALES_ORDER_APPROVAL_SENT',
  'SALES_ORDER_CREATED',
  'SALES_ORDER_ON_HOLD',
  'SALES_ORDER_HOLD_RELEASED',
  'ADVANCE_PAYMENT_RECEIVED'
);

ALTER TABLE "Order"
  ADD COLUMN "isOnHold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "holdReason" TEXT,
  ADD COLUMN "heldAt" TIMESTAMP(3),
  ADD COLUMN "heldByStaffId" TEXT;

CREATE TABLE "CommercialStatusEvent" (
  "id" TEXT NOT NULL,
  "code" "CommercialStatusCode" NOT NULL,
  "retailerId" TEXT NOT NULL,
  "orderId" TEXT,
  "commercialQuoteId" TEXT,
  "actorStaffId" TEXT,
  "reason" TEXT,
  "amount" DECIMAL(14,2),
  "reference" TEXT,
  "metadata" JSONB,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommercialStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialStatusEvent_idempotencyKey_key"
  ON "CommercialStatusEvent"("idempotencyKey");
CREATE INDEX "CommercialStatusEvent_retailerId_createdAt_idx"
  ON "CommercialStatusEvent"("retailerId", "createdAt");
CREATE INDEX "CommercialStatusEvent_orderId_createdAt_idx"
  ON "CommercialStatusEvent"("orderId", "createdAt");
CREATE INDEX "CommercialStatusEvent_commercialQuoteId_createdAt_idx"
  ON "CommercialStatusEvent"("commercialQuoteId", "createdAt");
CREATE INDEX "CommercialStatusEvent_code_createdAt_idx"
  ON "CommercialStatusEvent"("code", "createdAt");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_heldByStaffId_fkey"
  FOREIGN KEY ("heldByStaffId") REFERENCES "StaffUser"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "CommercialStatusEvent"
  ADD CONSTRAINT "CommercialStatusEvent_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "CommercialStatusEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "CommercialStatusEvent_commercialQuoteId_fkey"
  FOREIGN KEY ("commercialQuoteId") REFERENCES "CommercialQuote"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT "CommercialStatusEvent_actorStaffId_fkey"
  FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- Role definitions are application data, so an existing database does not
-- receive newly introduced permissions merely by running Prisma migrations.
-- Add the internal-status permissions and grant them only to the existing
-- roles whose responsibilities already cover the corresponding work. This is
-- additive and does not revoke or broaden unrelated authority.
INSERT INTO "Permission" ("id", "name", "description", "createdAt") VALUES
  ('permission-commercial-status-view', 'commercial.status.view', 'Read internal commercial milestones and timeline.', CURRENT_TIMESTAMP),
  ('permission-commercial-rate-approval-request', 'commercial.rate_approval.request', 'Request approval for an accepted commercial rate.', CURRENT_TIMESTAMP),
  ('permission-commercial-order-approval-request', 'commercial.order_approval.request', 'Record an order approval request in the internal commercial timeline.', CURRENT_TIMESTAMP),
  ('permission-commercial-order-hold-manage', 'commercial.order_hold.manage', 'Place and release an internal commercial order hold.', CURRENT_TIMESTAMP),
  ('permission-commercial-advance-view', 'commercial.advance.view', 'Read advance-payment milestones in internal commercial history.', CURRENT_TIMESTAMP),
  ('permission-commercial-advance-confirm', 'commercial.advance.confirm', 'Confirm advance-payment milestones where the existing Accounts role permits confirmation.', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'salesperson'
  AND permission."name" IN (
    'commercial.status.view',
    'commercial.rate_approval.request',
    'commercial.order_approval.request'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'sales_coordinator'
  AND permission."name" = 'commercial.status.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'accounts'
  AND permission."name" IN (
    'commercial.status.view',
    'commercial.advance.view',
    'commercial.advance.confirm'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'field_manager'
  AND permission."name" IN (
    'commercial.status.view',
    'commercial.order_hold.manage'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'platform_admin'
  AND permission."name" IN (
    'commercial.status.view',
    'commercial.rate_approval.request',
    'commercial.order_approval.request',
    'commercial.order_hold.manage',
    'commercial.advance.view',
    'commercial.advance.confirm'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
