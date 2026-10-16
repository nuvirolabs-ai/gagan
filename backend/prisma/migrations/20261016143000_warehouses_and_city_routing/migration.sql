-- CreateTable Warehouse
CREATE TABLE IF NOT EXISTS "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Indore',
    "state" TEXT NOT NULL DEFAULT 'Madhya Pradesh',
    "pincode" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_code_key" ON "Warehouse"("code");

-- CreateTable CityRouting
CREATE TABLE IF NOT EXISTS "CityRouting" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Madhya Pradesh',
    "pincodes" TEXT,
    "primaryWarehouseCode" TEXT NOT NULL,
    "fallbackWarehouseCode" TEXT,
    "slaHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityRouting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CityRouting_city_key" ON "CityRouting"("city");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CityRouting_primaryWarehouseCode_fkey'
  ) THEN
    ALTER TABLE "CityRouting" ADD CONSTRAINT "CityRouting_primaryWarehouseCode_fkey"
    FOREIGN KEY ("primaryWarehouseCode") REFERENCES "Warehouse"("code") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
