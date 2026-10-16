import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";

const prisma = new PrismaClient();

export async function setupFreshSalesWarehouseCluster() {
  console.log("===============================================================");
  console.log("  SETTING UP FRESH SALESPERSON & WAREHOUSE CLUSTER WITH BLANK SLATE");
  console.log("===============================================================");

  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // 1. Roles & Permissions
  console.log("1. Ensuring Roles & Permissions...");
  const rolesToEnsure = [
    { name: "field_manager", desc: "Sales Lead / Field Manager" },
    { name: "salesperson", desc: "Field Salesperson" },
    { name: "warehouse_manager", desc: "Warehouse Fulfillment Manager" },
    { name: "warehouse_operator", desc: "Warehouse Operator" },
    { name: "platform_admin", desc: "Operations Platform Admin" },
    { name: "catalog_manager", desc: "Product Master & Catalog Administrator" },
  ];

  const roleMap = new Map<string, string>();
  for (const r of rolesToEnsure) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.desc },
      create: { name: r.name, description: r.desc },
    });
    roleMap.set(r.name, role.id);
  }

  const permissionsToEnsure = [
    { name: "order.warehouse_process" },
    { name: "dispatch.execute" },
    { name: "retailer.proposal_review" },
    { name: "retailer.propose" },
    { name: "performance.view_team" },
    { name: "order.create_for_retailer" },
    { name: "route.manage" },
    { name: "staff.manage" },
    { name: "catalog.manage" },
  ];

  for (const p of permissionsToEnsure) {
    const perm = await prisma.permission.upsert({
      where: { name: p.name },
      update: {},
      create: { name: p.name },
    });

    if (["order.warehouse_process", "dispatch.execute"].includes(p.name)) {
      for (const roleName of ["warehouse_manager", "warehouse_operator"]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: roleMap.get(roleName)!, permissionId: perm.id } },
          update: {},
          create: { roleId: roleMap.get(roleName)!, permissionId: perm.id },
        });
      }
    }

    if (["catalog.manage"].includes(p.name)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleMap.get("catalog_manager")!, permissionId: perm.id } },
        update: {},
        create: { roleId: roleMap.get("catalog_manager")!, permissionId: perm.id },
      });
    }

    if (["retailer.proposal_review", "performance.view_team", "route.manage"].includes(p.name)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleMap.get("field_manager")!, permissionId: perm.id } },
        update: {},
        create: { roleId: roleMap.get("field_manager")!, permissionId: perm.id },
      });
    }

    if (["retailer.propose", "order.create_for_retailer"].includes(p.name)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleMap.get("salesperson")!, permissionId: perm.id } },
        update: {},
        create: { roleId: roleMap.get("salesperson")!, permissionId: perm.id },
      });
    }
  }

  // 2. Clear out old orders and related records for a true BLANK SLATE
  console.log("2. Purging old orders to create a true BLANK SLATE...");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Order", "Invoice", "CommercialQuote" RESTART IDENTITY CASCADE;`);
  console.log("Orders, invoices, and quotes truncated with restarted identity.");

  // 3. Ensure Single Pricing Tiers
  console.log("3. Ensuring Tiers...");
  let tierGold = await prisma.tier.findFirst({ where: { name: "Gold" } });
  if (!tierGold) {
    tierGold = await prisma.tier.create({
      data: { name: "Gold", description: "Standard single retail pricing tier", paymentTermDays: 14 },
    });
  }
  let tierSilver = await prisma.tier.findFirst({ where: { name: "Silver" } });
  if (!tierSilver) {
    tierSilver = await prisma.tier.create({
      data: { name: "Silver", description: "Standard single retail pricing tier", paymentTermDays: 14 },
    });
  }
  const allTiers = await prisma.tier.findMany();

  // 4. Create Manager & Admin Accounts
  console.log("4. Ensuring Manager & Admin Accounts...");
  const leadAdmin = await prisma.adminUser.upsert({
    where: { email: "deepak@gagan.test" },
    update: { name: "Deepak Iyer", passwordHash: defaultPasswordHash },
    create: { name: "Deepak Iyer", email: "deepak@gagan.test", passwordHash: defaultPasswordHash },
  });

  const leadStaff = await prisma.staffUser.upsert({
    where: { phone: "9812345681" },
    update: { name: "Deepak Iyer", email: "deepak@gagan.test", adminUserId: leadAdmin.id },
    create: {
      name: "Deepak Iyer",
      email: "deepak@gagan.test",
      phone: "9812345681",
      employeeRef: "MGR-AREA-001",
      adminUserId: leadAdmin.id,
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: leadStaff.id, roleId: roleMap.get("field_manager")! } },
    update: {},
    create: { staffId: leadStaff.id, roleId: roleMap.get("field_manager")! },
  });

  // 5. Create Dedicated Salesperson: Vikas Bhimke (9812345680)
  console.log("5. Creating Dedicated Salesperson Account (Vikas Bhimke - 9812345680)...");
  const salesRep = await prisma.salesRep.upsert({
    where: { id: "rep-vikram-singh-01" },
    update: {
      name: "Vikas Bhimke",
      phone: "9812345680",
      territory: "Indore Central Kirana Cluster",
    },
    create: {
      id: "rep-vikram-singh-01",
      name: "Vikas Bhimke",
      phone: "9812345680",
      territory: "Indore Central Kirana Cluster",
    },
  });

  // Free up SALES-002 if taken
  await prisma.staffUser.updateMany({
    where: { employeeRef: "SALES-002", phone: { not: "9812345680" } },
    data: { employeeRef: "SALES-LEGACY-002" },
  });

  const salesStaff = await prisma.staffUser.upsert({
    where: { phone: "9812345680" },
    update: {
      name: "Vikas Bhimke (Field Sales)",
      email: "vikas@gagan.test",
      employeeRef: "SALES-002",
      salesRepId: salesRep.id,
      managerId: leadStaff.id,
      status: "active",
    },
    create: {
      name: "Vikas Bhimke (Field Sales)",
      email: "vikas@gagan.test",
      phone: "9812345680",
      employeeRef: "SALES-002",
      salesRepId: salesRep.id,
      managerId: leadStaff.id,
      status: "active",
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: salesStaff.id, roleId: roleMap.get("salesperson")! } },
    update: {},
    create: { staffId: salesStaff.id, roleId: roleMap.get("salesperson")! },
  });

  // 6. Create Dedicated Warehouse Manager Login (warehouse-lead@gagan.test / password123)
  console.log("6. Creating Dedicated Warehouse Manager Account (warehouse-lead@gagan.test)...");
  const whLeadAdmin = await prisma.adminUser.upsert({
    where: { email: "warehouse-lead@gagan.test" },
    update: { name: "Indore Central Warehouse Lead", passwordHash: defaultPasswordHash },
    create: {
      name: "Indore Central Warehouse Lead",
      email: "warehouse-lead@gagan.test",
      passwordHash: defaultPasswordHash,
    },
  });

  const whLeadStaff = await prisma.staffUser.upsert({
    where: { phone: "9800000002" },
    update: {
      name: "Indore Central Warehouse Lead",
      email: "warehouse-lead@gagan.test",
      adminUserId: whLeadAdmin.id,
      status: "active",
    },
    create: {
      name: "Indore Central Warehouse Lead",
      email: "warehouse-lead@gagan.test",
      phone: "9800000002",
      employeeRef: "WH-INDORE-LEAD",
      adminUserId: whLeadAdmin.id,
      status: "active",
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: whLeadStaff.id, roleId: roleMap.get("warehouse_manager")! } },
    update: {},
    create: { staffId: whLeadStaff.id, roleId: roleMap.get("warehouse_manager")! },
  });

  // Also maintain existing warehouse@gagan.test
  const whExistingAdmin = await prisma.adminUser.upsert({
    where: { email: "warehouse@gagan.test" },
    update: { name: "Ramesh Shinde (Warehouse Lead)", passwordHash: defaultPasswordHash },
    create: {
      name: "Ramesh Shinde (Warehouse Lead)",
      email: "warehouse@gagan.test",
      passwordHash: defaultPasswordHash,
    },
  });
  await prisma.staffUser.upsert({
    where: { phone: "9812345690" },
    update: { adminUserId: whExistingAdmin.id, status: "active" },
    create: {
      name: "Ramesh Shinde (Warehouse Lead)",
      email: "warehouse@gagan.test",
      phone: "9812345690",
      employeeRef: "WH-INDORE-01",
      adminUserId: whExistingAdmin.id,
      status: "active",
    },
  });

  // Product Master Admin (catalog@gagan.test)
  const catAdmin = await prisma.adminUser.upsert({
    where: { email: "catalog@gagan.test" },
    update: { name: "Product Master Lead", passwordHash: defaultPasswordHash },
    create: { name: "Product Master Lead", email: "catalog@gagan.test", passwordHash: defaultPasswordHash },
  });
  const catStaff = await prisma.staffUser.upsert({
    where: { phone: "9812345699" },
    update: { adminUserId: catAdmin.id, status: "active" },
    create: {
      name: "Product Master Lead",
      email: "catalog@gagan.test",
      phone: "9812345699",
      employeeRef: "CAT-ADMIN-01",
      adminUserId: catAdmin.id,
      status: "active",
    },
  });
  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: catStaff.id, roleId: roleMap.get("catalog_manager")! } },
    update: {},
    create: { staffId: catStaff.id, roleId: roleMap.get("catalog_manager")! },
  });

  // 7. Verify & Activate All Products, Variants, Price Lists, and Warehouse Stock
  console.log("7. Ensuring All Products & Variants are active, with single pricing & available stock...");
  const seedDataPath = path.join(__dirname, "realWorldSeedData.json");
  const seedData = JSON.parse(fs.readFileSync(seedDataPath, "utf-8"));

  for (const prodData of seedData.products) {
    const sapMatId = `SAP-${prodData.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 16).toUpperCase()}`;
    let product = await prisma.product.findFirst({ where: { name: prodData.name } });

    if (product) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          category: prodData.category,
          imageUrl: prodData.imageUrl,
          description: prodData.description,
          catalogStatus: "active",
          sapMaterialId: sapMatId,
        },
      });
    } else {
      product = await prisma.product.create({
        data: {
          name: prodData.name,
          category: prodData.category,
          imageUrl: prodData.imageUrl,
          description: prodData.description,
          catalogStatus: "active",
          sapMaterialId: sapMatId,
        },
      });
    }

    const existingVariants = await prisma.variant.findMany({ where: { productId: product.id } });

    for (const vData of prodData.variants) {
      let variant = existingVariants.find(
        (ev) =>
          ev.unitSize.trim().toLowerCase() === vData.unitSize.trim().toLowerCase() &&
          ev.unitsPerCase === vData.unitsPerCase
      );

      const bagEquiv = Math.max(0.01, Math.round(((vData.unitsPerCase * vData.unitWeightKg) / 30) * 1000) / 1000);

      if (variant) {
        variant = await prisma.variant.update({
          where: { id: variant.id },
          data: {
            unit: vData.unit,
            unitsPerCase: vData.unitsPerCase,
            unitWeightKg: vData.unitWeightKg,
            imageUrl: vData.imageUrl,
            catalogStatus: "active",
            catalogImageStatus: "exact",
            gstPercent: 5,
            routingClass: "OTHER",
            routingBagEquivalent: bagEquiv,
            gstPendingOrderAllowed: false,
            listRate: vData.casePrice,
            listRateBasis: "case",
          },
        });
      } else {
        variant = await prisma.variant.create({
          data: {
            productId: product.id,
            unitSize: vData.unitSize,
            unit: vData.unit,
            unitsPerCase: vData.unitsPerCase,
            unitWeightKg: vData.unitWeightKg,
            imageUrl: vData.imageUrl,
            catalogStatus: "active",
            catalogImageStatus: "exact",
            gstPercent: 5,
            routingClass: "OTHER",
            routingBagEquivalent: bagEquiv,
            gstPendingOrderAllowed: false,
            listRate: vData.casePrice,
            listRateBasis: "case",
          },
        });
      }

      // Single authoritative price for all tiers
      for (const tier of allTiers) {
        await prisma.priceList.upsert({
          where: {
            tierId_variantId: {
              tierId: tier.id,
              variantId: variant.id,
            },
          },
          update: {
            productId: product.id,
            price: vData.casePrice,
            rateBasis: "case",
          },
          create: {
            tierId: tier.id,
            productId: product.id,
            variantId: variant.id,
            price: vData.casePrice,
            rateBasis: "case",
          },
        });
      }
    }

    // WH-001 stock snapshot
    await prisma.inventorySnapshot.upsert({
      where: {
        sapMaterialId_warehouseCode: {
          sapMaterialId: sapMatId,
          warehouseCode: "WH-001",
        },
      },
      update: {
        productId: product.id,
        onHand: 999999,
        available: 999999,
        status: "available",
        syncedAt: new Date(),
      },
      create: {
        productId: product.id,
        sapMaterialId: sapMatId,
        warehouseCode: "WH-001",
        onHand: 999999,
        available: 999999,
        status: "available",
        source: "sap",
        syncedAt: new Date(),
      },
    });
  }

  // 7b. Reconcile all active catalog variants and retailers to ensure 100% orderable quotes
  console.log("7b. Ensuring all active variants and retailers have commercial routing configured...");
  await prisma.$executeRawUnsafe(`
    UPDATE "Variant"
    SET "routingClass" = 'OTHER',
        "routingBagEquivalent" = GREATEST(0.010, ROUND(("unitsPerCase" * "unitWeightKg") / 30.0, 3)),
        "sellingEntity" = NULL,
        "gstPercent" = COALESCE("gstPercent", 5.00)
    WHERE "catalogStatus" = 'active'
      AND ("routingClass" IS NULL OR "routingBagEquivalent" IS NULL);

    UPDATE "Retailer"
    SET "deliveryCity" = 'Indore'
    WHERE "deliveryCity" IS NULL OR "deliveryCity" = '';
  `);

  // 8. Assign ALL Real-World Retailers to Vikas Bhimke (9812345680)
  console.log("8. Assigning ALL Real-World Retailers to Vikas Bhimke (9812345680)...");

  // A. Mahesh Kirana Store (9999999999)
  let mahesh = await prisma.retailer.findUnique({ where: { phone: "9999999999" } });
  if (mahesh) {
    mahesh = await prisma.retailer.update({
      where: { id: mahesh.id },
      data: {
        name: "Mahesh Kirana Store",
        shopAddress: "Shop 1, Main Market, MG Road, Indore",
        deliveryCity: "Indore",
        status: "active",
        salesRepId: salesRep.id,
        tierId: tierGold.id,
        creditLimit: 500000,
        currentBalance: 0,
        overdueAmount: 0,
      },
    });
  } else {
    mahesh = await prisma.retailer.create({
      data: {
        name: "Mahesh Kirana Store",
        phone: "9999999999",
        shopAddress: "Shop 1, Main Market, MG Road, Indore",
        deliveryCity: "Indore",
        status: "active",
        salesRepId: salesRep.id,
        tierId: tierGold.id,
        creditLimit: 500000,
        currentBalance: 0,
        overdueAmount: 0,
      },
    });
  }

  await prisma.retailerLocation.upsert({
    where: { retailerId: mahesh.id },
    update: { status: "VERIFIED", latitude: 22.7196, longitude: 75.8577, accuracyMeters: 5, locationVersion: 1 },
    create: {
      retailerId: mahesh.id,
      status: "VERIFIED",
      source: "SALESPERSON_VISIT",
      latitude: 22.7196,
      longitude: 75.8577,
      accuracyMeters: 5,
      locationVersion: 1,
    },
  });

  const existingMaheshKyc = await prisma.kycCase.findFirst({ where: { retailerId: mahesh.id } });
  if (existingMaheshKyc) {
    await prisma.kycCase.update({
      where: { id: existingMaheshKyc.id },
      data: { status: "approved", reviewedByStaffId: leadStaff.id, reviewedAt: new Date() },
    });
  } else {
    await prisma.kycCase.create({
      data: {
        retailerId: mahesh.id,
        status: "approved",
        reviewedByStaffId: leadStaff.id,
        reviewedAt: new Date(),
      },
    });
  }

  // B. The 30 Indore retailers from seed file
  for (let i = 0; i < seedData.retailers.length; i++) {
    const ret = seedData.retailers[i];
    const lat = 22.7196 + ((i % 6) - 3) * 0.008;
    const lng = 75.8577 + (Math.floor(i / 6) - 2) * 0.008;

    let retailer = await prisma.retailer.findUnique({ where: { phone: ret.phone } });
    if (retailer) {
      retailer = await prisma.retailer.update({
        where: { id: retailer.id },
        data: {
          name: ret.name,
          shopAddress: ret.shopAddress,
          deliveryCity: ret.deliveryCity || "Indore",
          status: "active",
          tierId: tierGold.id,
          salesRepId: salesRep.id,
          creditLimit: 500000,
          currentBalance: 0,
          overdueAmount: 0,
        },
      });
    } else {
      retailer = await prisma.retailer.create({
        data: {
          name: ret.name,
          phone: ret.phone,
          shopAddress: ret.shopAddress,
          deliveryCity: ret.deliveryCity || "Indore",
          status: "active",
          tierId: tierGold.id,
          salesRepId: salesRep.id,
          creditLimit: 500000,
          currentBalance: 0,
          overdueAmount: 0,
        },
      });
    }

    await prisma.retailerLocation.upsert({
      where: { retailerId: retailer.id },
      update: { status: "VERIFIED", latitude: lat, longitude: lng, accuracyMeters: 5, locationVersion: 1 },
      create: {
        retailerId: retailer.id,
        status: "VERIFIED",
        source: "SALESPERSON_VISIT",
        latitude: lat,
        longitude: lng,
        accuracyMeters: 5,
        locationVersion: 1,
      },
    });

    const existingKyc = await prisma.kycCase.findFirst({ where: { retailerId: retailer.id } });
    if (existingKyc) {
      await prisma.kycCase.update({
        where: { id: existingKyc.id },
        data: { status: "approved", reviewedByStaffId: leadStaff.id, reviewedAt: new Date() },
      });
    } else {
      await prisma.kycCase.create({
        data: {
          retailerId: retailer.id,
          status: "approved",
          reviewedByStaffId: leadStaff.id,
          reviewedAt: new Date(),
        },
      });
    }
  }

  // C. Re-assign all remaining active retailers in DB to Vikram Singh as well,
  // guaranteeing 100% visibility of all retailers
  const remainingRetailers = await prisma.retailer.findMany({
    where: { salesRepId: { not: salesRep.id } },
  });
  console.log(`Reassigning ${remainingRetailers.length} other retailers to Vikram Singh...`);
  for (const r of remainingRetailers) {
    await prisma.retailer.update({
      where: { id: r.id },
      data: {
        salesRepId: salesRep.id,
        status: "active",
        deliveryCity: r.deliveryCity || "Indore",
        creditLimit: 500000,
        currentBalance: 0,
        overdueAmount: 0,
        tierId: tierGold.id,
      },
    });

    await prisma.retailerLocation.upsert({
      where: { retailerId: r.id },
      update: { status: "VERIFIED" },
      create: {
        retailerId: r.id,
        status: "VERIFIED",
        source: "SALESPERSON_VISIT",
        latitude: 22.7196,
        longitude: 75.8577,
        accuracyMeters: 5,
        locationVersion: 1,
      },
    });

    const kyc = await prisma.kycCase.findFirst({ where: { retailerId: r.id } });
    if (kyc) {
      await prisma.kycCase.update({
        where: { id: kyc.id },
        data: { status: "approved", reviewedByStaffId: leadStaff.id, reviewedAt: new Date() },
      });
    } else {
      await prisma.kycCase.create({
        data: { retailerId: r.id, status: "approved", reviewedByStaffId: leadStaff.id, reviewedAt: new Date() },
      });
    }
  }

  // Check total retailers assigned to Vikram Singh
  const totalAssigned = await prisma.retailer.count({
    where: { salesRepId: salesRep.id },
  });

  const totalActiveProducts = await prisma.product.count({ where: { catalogStatus: "active" } });
  const totalActiveVariants = await prisma.variant.count({ where: { catalogStatus: "active" } });
  const totalOrders = await prisma.order.count();

  console.log("\n===============================================================");
  console.log("  SETUP COMPLETE & VERIFIED!");
  console.log("===============================================================");
  console.log(`- Retailers assigned to Vikas Bhimke: ${totalAssigned} (All ACTIVE & VERIFIED)`);
  console.log(`- Active Products: ${totalActiveProducts}`);
  console.log(`- Active Variants (Single Pricing): ${totalActiveVariants}`);
  console.log(`- Total Orders in System: ${totalOrders} (BLANK SLATE: Ready for Order #1)`);
  console.log("\nLOGIN CREDENTIALS:");
  console.log("1. Salesperson (Field Sales App):");
  console.log("   Phone: 9812345680");
  console.log("   OTP:   123456");
  console.log("   Name:  Vikas Bhimke (Field Sales)");
  console.log("   Status: Ready to punch orders immediately with NO setup pending blockers!");
  console.log("\n2. Warehouse Manager (Admin Orders Portal):");
  console.log("   Email:    warehouse-lead@gagan.test");
  console.log("   Password: password123");
  console.log("   Portal:   http://localhost:5173/warehouse-orders");
  console.log("   Tabs:     All (0), Confirmed (0), Packed (0), Out for delivery (0), Delivered (0)");
  console.log("\n3. Product Master Admin:");
  console.log("   Email:    catalog@gagan.test");
  console.log("   Password: password123");
  console.log("   Portal:   http://localhost:5173/catalog");
  console.log("===============================================================\n");
}

if (require.main === module) {
  setupFreshSalesWarehouseCluster()
    .catch((err) => {
      console.error("Cluster setup error:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
