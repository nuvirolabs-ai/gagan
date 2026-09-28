ALTER TABLE "Product" ADD COLUMN "catalogIdentityBrand" TEXT;
ALTER TABLE "Product" ADD COLUMN "catalogIdentityGroup" TEXT;
ALTER TABLE "Product" ADD COLUMN "catalogIdentityLabel" TEXT;

ALTER TABLE "Variant" ADD COLUMN "catalogIdentitySkuName" TEXT;
ALTER TABLE "Variant" ADD COLUMN "catalogIdentityPackingSize" TEXT;
ALTER TABLE "Variant" ADD COLUMN "catalogIdentityMasterPack" TEXT;
