import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PUNE_PENDING_PROPOSALS = [
  { name: "Kaveri Traders", owner: "Suresh Kaveri", phone: "9823000001", address: "Shop 12, Market Yard Gate 2, Pune", city: "Pune", lat: 18.4912, lng: 73.8645, qty: 5 },
  { name: "Bharat Provisions", owner: "Bharat Oswal", phone: "9823000002", address: "44 Hadapsar Main Road, Pune", city: "Pune", lat: 18.5028, lng: 73.9275, qty: 4 },
  { name: "Patel Supermarket", owner: "Dinesh Patel", phone: "9823000003", address: "Shop 8, Fatima Nagar Junction, Pune", city: "Pune", lat: 18.5065, lng: 73.8992, qty: 6 },
  { name: "Sahyadri Kirana", owner: "Anil More", phone: "9823000004", address: "102 Viman Nagar Central, Pune", city: "Pune", lat: 18.5679, lng: 73.9143, qty: 3 },
  { name: "Sharma General Store", owner: "Ramesh Sharma", phone: "9823000005", address: "25 Kharadi Bypass Rd, Pune", city: "Pune", lat: 18.5514, lng: 73.9352, qty: 8 },
  { name: "Mahalaxmi Daily Needs", owner: "Kishor Gaikwad", phone: "9823000006", address: "14 Camp MG Road, Pune", city: "Pune", lat: 18.5173, lng: 73.8789, qty: 4 },
  { name: "Ganesh Food Market", owner: "Pravin Shinde", phone: "9823000007", address: "89 Kothrud Stand, Pune", city: "Pune", lat: 18.5074, lng: 73.8077, qty: 5 },
  { name: "Sai Krupa Wholesale", owner: "Santosh Jagtap", phone: "9823000008", address: "Shop 3, Swargate Market, Pune", city: "Pune", lat: 18.4988, lng: 73.8582, qty: 10 },
  { name: "Omkar Provision Stores", owner: "Omkar Kulkarni", phone: "9823000009", address: "55 Bibwewadi Chowk, Pune", city: "Pune", lat: 18.4735, lng: 73.8648, qty: 6 },
  { name: "Venkateshwara Supermarket", owner: "Balaji Reddy", phone: "9823000010", address: "33 Kondhwa Main Road, Pune", city: "Pune", lat: 18.4789, lng: 73.8912, qty: 7 },
  { name: "Shree Ram Groceries", owner: "Ramdas Joshi", phone: "9823000011", address: "78 Katraj Chowk, Pune", city: "Pune", lat: 18.4529, lng: 73.8553, qty: 5 },
  { name: "Navkar Kirana Mart", owner: "Hasmukh Shah", phone: "9823000012", address: "19 Raviwar Peth, Pune", city: "Pune", lat: 18.5147, lng: 73.8601, qty: 4 },
  { name: "Balaji Grain Stores", owner: "Govind Tawde", phone: "9823000013", address: "62 Nana Peth, Pune", city: "Pune", lat: 18.5192, lng: 73.8687, qty: 6 },
  { name: "Pooja General Stores", owner: "Mahendra Jain", phone: "9823000014", address: "21 Yerwada Bazaar, Pune", city: "Pune", lat: 18.5529, lng: 73.8831, qty: 3 },
  { name: "Arihant Supermarket", owner: "Vimal Nahar", phone: "9823000015", address: "5 Wadgaon Sheri Main Rd, Pune", city: "Pune", lat: 18.5487, lng: 73.9182, qty: 5 },
];

const PUNE_ACTIVE_RETAILERS = [
  { name: "Jai Hind Kirana", phone: "9823000016", address: "11 Salisbury Park, Pune", city: "Pune", lat: 18.4981, lng: 73.8742 },
  { name: "Shubham Traders", phone: "9823000017", address: "40 Bhavani Peth, Pune", city: "Pune", lat: 18.5112, lng: 73.8715 },
  { name: "Anand Provisions", phone: "9823000018", address: "18 Ghorpadi Village, Pune", city: "Pune", lat: 18.5289, lng: 73.8965 },
  { name: "Krishna Mart", phone: "9823000019", address: "9 Kalyani Nagar, Pune", city: "Pune", lat: 18.5471, lng: 73.9034 },
  { name: "Radhe Krishna Stores", phone: "9823000020", address: "71 Mundhwa Chowk, Pune", city: "Pune", lat: 18.5342, lng: 73.9218 },
  { name: "New Bombay Traders", phone: "9823000021", address: "23 Magarpatta City North, Pune", city: "Pune", lat: 18.5158, lng: 73.9312 },
  { name: "Shivaji Kirana", phone: "9823000022", address: "8 Wanowrie Salunke Vihar, Pune", city: "Pune", lat: 18.4845, lng: 73.8987 },
  { name: "Maruti Provisions", phone: "9823000023", address: "50 Undri Chowk, Pune", city: "Pune", lat: 18.4598, lng: 73.9123 },
  { name: "Gurukrupa Supermarket", phone: "9823000024", address: "34 Pisoli Road, Pune", city: "Pune", lat: 18.4512, lng: 73.9015 },
  { name: "Siddhivinayak Mart", phone: "9823000025", address: "12 Dhanori Road, Pune", city: "Pune", lat: 18.5832, lng: 73.8945 },
  { name: "Ambika General Stores", phone: "9823000026", address: "66 Tingre Nagar, Pune", city: "Pune", lat: 18.5712, lng: 73.8821 },
  { name: "Mahavir Traders", phone: "9823000027", address: "28 Vishrantwadi Chowk, Pune", city: "Pune", lat: 18.5634, lng: 73.8745 },
  { name: "Kalyan Kirana", phone: "9823000028", address: "15 Dighi Road, Pune", city: "Pune", lat: 18.5987, lng: 73.8698 },
  { name: "Shree Ganesh Provisions", phone: "9823000029", address: "77 Bopodi Bazaar, Pune", city: "Pune", lat: 18.5621, lng: 73.8345 },
  { name: "Swastik Supermarket", phone: "9823000030", address: "42 Aundh D.P. Road, Pune", city: "Pune", lat: 18.5589, lng: 73.8098 },
];

export async function setupRealWorldCluster() {
  console.log("=== Setting up Real-World Cluster Scenario ===");

  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // 1. Ensure Roles
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

  // Ensure Permissions
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
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleMap.get("warehouse_manager")!, permissionId: perm.id } },
        update: {},
        create: { roleId: roleMap.get("warehouse_manager")!, permissionId: perm.id },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleMap.get("warehouse_operator")!, permissionId: perm.id } },
        update: {},
        create: { roleId: roleMap.get("warehouse_operator")!, permissionId: perm.id },
      });
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

  // 2. Sales Lead (Sunita Rao & Deepak Iyer)
  const leadAdmin = await prisma.adminUser.upsert({
    where: { email: "sunita@gagan.test" },
    update: { name: "Sunita Rao", passwordHash: defaultPasswordHash },
    create: { name: "Sunita Rao", email: "sunita@gagan.test", passwordHash: defaultPasswordHash },
  });

  const leadStaff = await prisma.staffUser.upsert({
    where: { email: "sunita@gagan.test" },
    update: { name: "Sunita Rao", phone: "9812345672", adminUserId: leadAdmin.id },
    create: {
      name: "Sunita Rao",
      email: "sunita@gagan.test",
      phone: "9812345672",
      employeeRef: "MGR-PUNE-01",
      adminUserId: leadAdmin.id,
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: leadStaff.id, roleId: roleMap.get("field_manager")! } },
    update: {},
    create: { staffId: leadStaff.id, roleId: roleMap.get("field_manager")! },
  });

  // Sales Leader Deepak Iyer (matches credentials from user)
  const deepakAdmin = await prisma.adminUser.upsert({
    where: { email: "deepak@gagan.test" },
    update: { name: "Deepak Iyer", passwordHash: defaultPasswordHash },
    create: { name: "Deepak Iyer", email: "deepak@gagan.test", passwordHash: defaultPasswordHash },
  });

  const deepakStaff = await prisma.staffUser.upsert({
    where: { email: "deepak@gagan.test" },
    update: { name: "Deepak Iyer", phone: "9812345681", adminUserId: deepakAdmin.id },
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
    update: { name: "Nikhil Patil", phone: "9812367800", territory: "Pune East Kirana Cluster" },
    create: {
      id: "rep-nikhil-patil-01",
      name: "Nikhil Patil",
      phone: "9812367800",
      territory: "Pune East Kirana Cluster",
    },
  });

  const salesStaff = await prisma.staffUser.upsert({
    where: { phone: "9812367800" },
    update: {
      name: "Nikhil Patil",
      email: "nikhil@gagan.test",
      salesRepId: salesRep.id,
      managerId: deepakStaff.id,
    },
    create: {
      name: "Nikhil Patil",
      email: "nikhil@gagan.test",
      phone: "9812367800",
      employeeRef: "REP-PUNE-01",
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
    where: { email: "warehouse@gagan.test" },
    update: {
      name: "Ramesh Shinde (Warehouse Lead)",
      phone: "9812345690",
      adminUserId: whAdmin.id,
    },
    create: {
      name: "Ramesh Shinde (Warehouse Lead)",
      email: "warehouse@gagan.test",
      phone: "9812345690",
      employeeRef: "WH-PUNE-01",
      adminUserId: whAdmin.id,
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: whStaff.id, roleId: roleMap.get("warehouse_manager")! } },
    update: {},
    create: { staffId: whStaff.id, roleId: roleMap.get("warehouse_manager")! },
  });

  // 4b. Product Master / Catalog Admin
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
    where: { email: "catalog@gagan.test" },
    update: {
      name: "Product Master Lead",
      phone: "9812345699",
      adminUserId: catAdmin.id,
    },
    create: {
      name: "Product Master Lead",
      email: "catalog@gagan.test",
      phone: "9812345699",
      employeeRef: "CAT-PUNE-01",
      adminUserId: catAdmin.id,
    },
  });

  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: catStaff.id, roleId: roleMap.get("catalog_manager")! } },
    update: {},
    create: { staffId: catStaff.id, roleId: roleMap.get("catalog_manager")! },
  });

  // 5. Tiers and Variant for Orders
  const tierA = (await prisma.tier.findFirst({ where: { name: { contains: "Gold" } } })) ?? (await prisma.tier.findFirstOrThrow());
  const tierB = (await prisma.tier.findFirst({ where: { name: { contains: "Silver" } } })) ?? (await prisma.tier.findFirstOrThrow());

  const variant = await prisma.variant.findFirstOrThrow({
    include: { product: true },
  });

  // 6. Seed Cluster of 15 Pending Retailer Proposals for Nikhil Patil
  console.log("Seeding 15 pending retailer proposals for Nikhil Patil...");
  for (const p of PUNE_PENDING_PROPOSALS) {
    const existing = await prisma.retailerProposal.findFirst({
      where: { phone: p.phone },
    });
    if (!existing) {
      await prisma.retailerProposal.create({
        data: {
          businessName: p.name,
          groupName: p.name,
          ownerName: p.owner,
          phone: p.phone,
          shopAddress: p.address,
          deliveryCity: p.city,
          latitude: p.lat,
          longitude: p.lng,
          accuracyMeters: 8,
          transporter: "Pune City Freight",
          shopDurationYears: 5,
          paymentTerms: "Weekly UPI / Net 7",
          aadhaarLast4: "9999",
          proposedTierId: tierA.id,
          status: "pending",
          submittedByStaffId: salesStaff.id,
          orderIntents: {
            create: {
              submittedByStaffId: salesStaff.id,
              idempotencyKey: `intent-seed-${p.phone}`,
              punchedAt: new Date(),
              items: {
                create: [
                  {
                    variantId: variant.id,
                    productName: variant.product?.name ?? "Gagan Toor Dal",
                    unitSize: variant.unitSize,
                    unitsPerCase: variant.unitsPerCase,
                    qty: p.qty,
                  },
                ],
              },
            },
          },
        },
      });
    }
  }

  // 7. Seed Cluster of 15 Active Retailers Assigned to Nikhil Patil
  console.log("Seeding 15 active retailers assigned to Nikhil Patil...");
  const activeRetailerIds: string[] = [];
  for (const r of PUNE_ACTIVE_RETAILERS) {
    let retailer = await prisma.retailer.findUnique({
      where: { phone: r.phone },
    });
    if (!retailer) {
      retailer = await prisma.retailer.create({
        data: {
          name: r.name,
          phone: r.phone,
          shopAddress: r.address,
          deliveryCity: r.city,
          status: "active",
          tierId: tierA.id,
          salesRepId: salesRep.id,
          creditLimit: 50000,
          currentBalance: 0,
          overdueAmount: 0,
        },
      });
      await prisma.retailerLocation.create({
        data: {
          retailerId: retailer.id,
          status: "VERIFIED",
          source: "SALESPERSON_VISIT",
          latitude: r.lat,
          longitude: r.lng,
          accuracyMeters: 5,
          locationVersion: 1,
        },
      });
      await prisma.kycCase.create({
        data: {
          retailerId: retailer.id,
          status: "approved",
          reviewedByStaffId: leadStaff.id,
          reviewedAt: new Date(),
        },
      });
    }
    activeRetailerIds.push(retailer.id);
  }

  // 8. Seed 5 Sample Warehouse Orders across fulfillment stages
  console.log("Seeding sample fulfillment orders for the warehouse manager...");
  const orderConfigs = [
    { retailerIndex: 0, status: "confirmed" as const, orderTotal: 9450, cases: 3 },
    { retailerIndex: 1, status: "confirmed" as const, orderTotal: 15750, cases: 5 },
    { retailerIndex: 2, status: "packed" as const, orderTotal: 6300, cases: 2 },
    { retailerIndex: 3, status: "packed" as const, orderTotal: 12600, cases: 4 },
    { retailerIndex: 4, status: "out_for_delivery" as const, orderTotal: 18900, cases: 6, route: "ROUTE-PUNE-EAST-1" },
  ];

  for (let i = 0; i < orderConfigs.length; i++) {
    const cfg = orderConfigs[i];
    const retId = activeRetailerIds[cfg.retailerIndex];
    const existingOrder = await prisma.order.findFirst({
      where: { retailerId: retId },
    });
    if (!existingOrder) {
      const order = await prisma.order.create({
        data: {
          retailerId: retId,
          status: cfg.status,
          orderTotal: cfg.orderTotal,
          items: {
            create: [
              {
                variantId: variant.id,
                qtyOrdered: cfg.cases,
                unitPrice: cfg.orderTotal / cfg.cases,
                caseWeightKgSnapshot: Number(variant.unitWeightKg ?? 1) * variant.unitsPerCase,
              },
            ],
          },
        },
      });

      const policy = await prisma.creditPolicyVersion.findFirstOrThrow({ where: { active: true } });
      const assessment = await prisma.creditAssessment.create({
        data: {
          retailerId: retId,
          orderId: order.id,
          policyVersionId: policy.id,
          result: "allowed",
          projectedExposure: cfg.orderTotal,
          snapshot: {},
          reasons: [],
        },
      });

      // Authorization for dispatch
      await prisma.dispatchAuthorization.create({
        data: {
          orderId: order.id,
          assessmentId: assessment.id,
          version: 1,
          status: cfg.status === "out_for_delivery" ? "used" : "active",
          reason: "Approved staging credit order",
        },
      });

      if (cfg.route) {
        await prisma.delivery.create({
          data: {
            orderId: order.id,
            routeId: cfg.route,
            deliverySlot: new Date(),
          },
        });
      }
    }
  }

  console.log("=== Scenario Setup Finished Successfully! ===");
  console.log("\nSummary of Roles & Test Logins:");
  console.log("1. Sales Lead:");
  console.log("   - Name: Sunita Rao (Field Manager)");
  console.log("   - Email: sunita@gagan.test / password: password123");
  console.log("   - Action: Review & Approve Nikhil Patil's 15 Pending Retailers at /retailer-approvals");
  console.log("\n2. Field Salesperson:");
  console.log("   - Name: Nikhil Patil");
  console.log("   - Phone: 9812367800 / OTP: 123456");
  console.log("   - Territory: Pune East Kirana Cluster (30 Retailers)");
  console.log("\n3. Warehouse Manager:");
  console.log("   - Name: Ramesh Shinde (Warehouse Fulfillment)");
  console.log("   - Email: warehouse@gagan.test / password: password123");
  console.log("   - Action: Pack, Dispatch, Deliver Orders at /warehouse-orders (Zero access to other modules)");
  console.log("\n4. Product Master / Catalog Admin:");
  console.log("   - Name: Product Master Lead");
  console.log("   - Email: catalog@gagan.test / password: password123");
  console.log("   - Action: Check Products, SKUs, Presentation/Pack Images, and Prices at /catalog");
}

if (require.main === module) {
  setupRealWorldCluster()
    .catch((err) => {
      console.error("Setup error:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
