-- Phase 2: Commercial, Pricing, Credit, Retailer Profile, Catalog Hierarchy, and Tax Master

ALTER TABLE "Retailer" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
ALTER TABLE "Retailer" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "Retailer" ADD COLUMN IF NOT EXISTS "gstin" TEXT;
ALTER TABLE "Retailer" ADD COLUMN IF NOT EXISTS "pan" TEXT;

CREATE TABLE IF NOT EXISTS "TierQuantitySlab" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountFlat" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TierQuantitySlab_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TierQuantitySlab_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TierQuantitySlab_tierId_idx" ON "TierQuantitySlab"("tierId");

CREATE TABLE IF NOT EXISTS "CreditLimitOverride" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "previousLimit" DECIMAL(12,2) NOT NULL,
    "newLimit" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLimitOverride_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditLimitOverride_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreditLimitOverride_retailerId_status_idx" ON "CreditLimitOverride"("retailerId", "status");

CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");

CREATE TABLE IF NOT EXISTS "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Brand_name_key" ON "Brand"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_slug_key" ON "Brand"("slug");

CREATE TABLE IF NOT EXISTS "HsnMaster" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "gstPercent" DECIMAL(5,2) NOT NULL,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "exemptionNotes" TEXT,
    "chapter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HsnMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HsnMaster_code_key" ON "HsnMaster"("code");