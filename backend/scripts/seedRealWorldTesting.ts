import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";

const prisma = new PrismaClient();

export async function seedRealWorldTesting() {
  console.log("=== Starting Real-World Testing Seeder ===");

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

  // 2. Sales Leader (Deepak Iyer)
  console.log("2. Ensuring Key Staff Accounts...");
  const deepakAdmin = await prisma.adminUser.upsert({
    where: { email: "deepak@gagan.test" },
    update: { name: "Deepak Iyer", passwordHash: defaultPasswordHash },
    create: { name: "Deepak Iyer", email: "deepak@gagan.test", passwordHash: defaultPasswordHash },
  });

  const deepakStaff = await prisma.staffUser.upsert({
    where: { phone: "9812345681" },
    update: { name: "Deepak Iyer", email: "deepak@gagan.test", adminUserId: deepakAdmin.id },
    create: {
      name: "Deepak Iyer",
      email: "deepak@gagan.test",
      phone: "9812345681",
      employeeRef: "MGR-AREA-001",
      adminUserId: deepakAdmin.id,
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: deepakStaff.id, roleId: roleMap.get("field_manager")! } },
    update: {},
    create: { staffId: deepakStaff.id, roleId: roleMap.get("field_manager")! },
  });

  // 3. Salesperson (Nikhil Patil)
  const salesRep = await prisma.salesRep.upsert({
    where: { id: "rep-nikhil-patil-01" },
    update: { name: "Nikhil Patil", phone: "9812367800", territory: "Indore Kirana Cluster" },
    create: {
      id: "rep-nikhil-patil-01",
      name: "Nikhil Patil",
      phone: "9812367800",
      territory: "Indore Kirana Cluster",
    },
  });

  // Free up SALES-001 if held by another user (e.g. old seed)
  await prisma.staffUser.updateMany({
    where: { employeeRef: "SALES-001", phone: { not: "9812367800" } },
    data: { employeeRef: "SALES-LEGACY-001" },
  });

  const salesStaff = await prisma.staffUser.upsert({
    where: { phone: "9812367800" },
    update: {
      name: "Nikhil Patil",
      email: "nikhil@gagan.test",
      employeeRef: "SALES-001",
      salesRepId: salesRep.id,
      managerId: deepakStaff.id,
    },
    create: {
      name: "Nikhil Patil",
      email: "nikhil@gagan.test",
      phone: "9812367800",
      employeeRef: "SALES-001",
      salesRepId: salesRep.id,
      managerId: deepakStaff.id,
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: salesStaff.id, roleId: roleMap.get("salesperson")! } },
    update: {},
    create: { staffId: salesStaff.id, roleId: roleMap.get("salesperson")! },
  });

  // 4. Warehouse Manager (Ramesh Shinde)
  const whAdmin = await prisma.adminUser.upsert({
    where: { email: "warehouse@gagan.test" },
    update: { name: "Ramesh Shinde (Warehouse Lead)", passwordHash: defaultPasswordHash },
    create: {
      name: "Ramesh Shinde (Warehouse Lead)",
      email: "warehouse@gagan.test",
      passwordHash: defaultPasswordHash,
    },
  });

  const whStaff = await prisma.staffUser.upsert({
    where: { phone: "9812345690" },
    update: {
      name: "Ramesh Shinde (Warehouse Lead)",
      email: "warehouse@gagan.test",
      adminUserId: whAdmin.id,
    },
    create: {
      name: "Ramesh Shinde (Warehouse Lead)",
      email: "warehouse@gagan.test",
      phone: "9812345690",
      employeeRef: "WH-INDORE-01",
      adminUserId: whAdmin.id,
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: whStaff.id, roleId: roleMap.get("warehouse_manager")! } },
    update: {},
    create: { staffId: whStaff.id, roleId: roleMap.get("warehouse_manager")! },
  });

  // 5. Product Master / Catalog Admin
  const catAdmin = await prisma.adminUser.upsert({
    where: { email: "catalog@gagan.test" },
    update: {
      name: "Product Master Lead",
      passwordHash: defaultPasswordHash,
    },
    create: {
      name: "Product Master Lead",
      email: "catalog@gagan.test",
      passwordHash: defaultPasswordHash,
    },
  });

  const catStaff = await prisma.staffUser.upsert({
    where: { phone: "9812345699" },
    update: {
      name: "Product Master Lead",
      email: "catalog@gagan.test",
      adminUserId: catAdmin.id,
    },
    create: {
      name: "Product Master Lead",
      email: "catalog@gagan.test",
      phone: "9812345699",
      employeeRef: "CAT-ADMIN-01",
      adminUserId: catAdmin.id,
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: catStaff.id, roleId: roleMap.get("catalog_manager")! } },
    update: {},
    create: { staffId: catStaff.id, roleId: roleMap.get("catalog_manager")! },
  });

  // 6. Platform Admin
  await prisma.adminUser.upsert({
    where: { email: "admin@gagan.test" },
    update: { name: "Platform Admin", passwordHash: defaultPasswordHash },
    create: { name: "Platform Admin", email: "admin@gagan.test", passwordHash: defaultPasswordHash },
  });

  // 7. Ensure Tiers
  let tierA = await prisma.tier.findFirst({ where: { name: "Gold" } });
  if (!tierA) {
    tierA = await prisma.tier.create({
      data: { name: "Gold", description: "Standard single retail pricing tier", paymentTermDays: 14 },
    });
  }
  const allTiers = await prisma.tier.findMany();

  // 8. Load Seed Data from JSON
  const seedDataPath = path.join(__dirname, "realWorldSeedData.json");
  const seedData = JSON.parse(fs.readFileSync(seedDataPath, "utf-8"));

  // 9. Archive old dummy products so only real products show up
  console.log("3. Archiving legacy dummy products...");
  const realProductNames = seedData.products.map((p: any) => p.name);
  await prisma.product.updateMany({
    where: { name: { notIn: realProductNames } },
    data: { catalogStatus: "archived" },
  });
  await prisma.variant.updateMany({
    where: { product: { name: { notIn: realProductNames } } },
    data: { catalogStatus: "archived" },
  });

  // 10. Seed Products, Variants, PriceLists, and Inventory
  console.log(`4. Seeding ${seedData.products.length} Products and their Variants...`);
  let totalVariantsSeeded = 0;

  for (const prodData of seedData.products) {
    const sapMatId = `SAP-${prodData.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 16).toUpperCase()}`;
    let product = await prisma.product.findFirst({
      where: { name: prodData.name },
    });

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

    const existingVariants = await prisma.variant.findMany({
      where: { productId: product.id },
    });

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

      totalVariantsSeeded++;

      // Single authoritative case price for all tiers
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

    // Infinite inventory snapshot per product (covers all variants via sapMaterialId)
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
  console.log(`Seeded ${seedData.products.length} products and ${totalVariantsSeeded} variants successfully!`);

  // 11. Seed Retailer Mahesh (9999999999)
  console.log("5. Seeding Retailer Mahesh (9999999999)...");
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
        tierId: tierA.id,
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
        tierId: tierA.id,
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
      data: { status: "approved", reviewedByStaffId: deepakStaff.id, reviewedAt: new Date() },
    });
  } else {
    await prisma.kycCase.create({
      data: {
        retailerId: mahesh.id,
        status: "approved",
        reviewedByStaffId: deepakStaff.id,
        reviewedAt: new Date(),
      },
    });
  }

  // 12. Seed the 30 Indore Retailers under Nikhil Patil
  console.log(`6. Seeding ${seedData.retailers.length} Indore Retailers under Nikhil Patil...`);
  const seededRetailerIds: string[] = [];

  for (let i = 0; i < seedData.retailers.length; i++) {
    const ret = seedData.retailers[i];
    // Coordinate jitter centered on Indore (22.7196° N, 75.8577° E)
    const lat = 22.7196 + ((i % 6) - 3) * 0.008;
    const lng = 75.8577 + (Math.floor(i / 6) - 2) * 0.008;

    let retailer = await prisma.retailer.findUnique({ where: { phone: ret.phone } });
    if (retailer) {
      retailer = await prisma.retailer.update({
        where: { id: retailer.id },
        data: {
          name: ret.name,
          shopAddress: ret.shopAddress,
          deliveryCity: ret.deliveryCity,
          status: "active",
          tierId: tierA.id,
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
          deliveryCity: ret.deliveryCity,
          status: "active",
          tierId: tierA.id,
          salesRepId: salesRep.id,
          creditLimit: 500000,
          currentBalance: 0,
          overdueAmount: 0,
        },
      });
    }

    seededRetailerIds.push(retailer.id);

    // Location verification
    await prisma.retailerLocation.upsert({
      where: { retailerId: retailer.id },
      update: {
        status: "VERIFIED",
        latitude: lat,
        longitude: lng,
        accuracyMeters: 5,
        locationVersion: 1,
      },
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

    // KYC Approval
    const existingKyc = await prisma.kycCase.findFirst({ where: { retailerId: retailer.id } });
    if (existingKyc) {
      await prisma.kycCase.update({
        where: { id: existingKyc.id },
        data: {
          status: "approved",
          reviewedByStaffId: deepakStaff.id,
          reviewedAt: new Date(),
        },
      });
    } else {
      await prisma.kycCase.create({
        data: {
          retailerId: retailer.id,
          status: "approved",
          reviewedByStaffId: deepakStaff.id,
          reviewedAt: new Date(),
        },
      });
    }
  }

  console.log(`Seeded ${seededRetailerIds.length} retailers with VERIFIED location and APPROVED KYC!`);

  // Ensure all retailers under Nikhil Patil are verified and approved
  const allNikhilRetailers = await prisma.retailer.findMany({
    where: { salesRepId: salesRep.id },
    include: { location: true, kycCase: true },
  });
  for (const r of allNikhilRetailers) {
    await prisma.retailer.update({
      where: { id: r.id },
      data: { status: "active", creditLimit: 500000, currentBalance: 0, overdueAmount: 0 },
    });
    if (!r.location) {
      await prisma.retailerLocation.create({
        data: { retailerId: r.id, status: "VERIFIED", source: "SALESPERSON_VISIT", latitude: 22.7196, longitude: 75.8577, accuracyMeters: 5, locationVersion: 1 },
      });
    } else if (r.location.status !== "VERIFIED") {
      await prisma.retailerLocation.update({ where: { retailerId: r.id }, data: { status: "VERIFIED" } });
    }
    if (!r.kycCase) {
      await prisma.kycCase.create({
        data: { retailerId: r.id, status: "approved", reviewedByStaffId: deepakStaff.id, reviewedAt: new Date() },
      });
    } else if (r.kycCase.status !== "approved") {
      await prisma.kycCase.update({ where: { id: r.kycCase.id }, data: { status: "approved", reviewedByStaffId: deepakStaff.id, reviewedAt: new Date() } });
    }
  }

  console.log("\n=== Real-World Testing Seeder Finished Successfully! ===");
  console.log("Credentials Summary:");
  console.log("1. Salesperson Nikhil Patil: Phone 9812367800 | OTP 123456 (Employee Ref: SALES-001)");
  console.log("   - Assigned Retailers: 31 (30 Indore Kirana stores + Mahesh Kirana)");
  console.log("   - All retailers are VERIFIED & APPROVED for immediate order taking");
  console.log("2. Retailer Mahesh: Phone 9999999999 | OTP 123456");
  console.log("3. Sales Leader Deepak Iyer: Phone 9812345681 | OTP 123456 | deepak@gagan.test / password123");
  console.log("4. Warehouse Manager Ramesh Shinde: warehouse@gagan.test / password123");
  console.log("5. Product Master / Catalog Admin: catalog@gagan.test / password123");
  console.log("6. Operations Platform Admin: admin@gagan.test / password123");
}

if (require.main === module) {
  seedRealWorldTesting()
    .catch((err) => {
      console.error("Seeder error:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
