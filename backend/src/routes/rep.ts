import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { publicMediaUrl } from "../lib/media";
import { groupCatalog } from "../modules/catalog/catalogGrouping";
import { catalogueImageState, catalogueOrderingState, catalogueStatusWhere, retailerCommercialFields, withInventoryOrderability } from "../modules/catalog/catalogueVisibility";
import { financialLedgerFor } from "../modules/finance/financialQueries";
import { financialSummaryFor } from "../modules/finance/financialSummary";
import { DEFAULT_WAREHOUSE_CODE, INVENTORY_STALE_AFTER_MS, selectInventorySnapshot } from "../modules/inventory/inventoryService";
import { requireRep, assignedRetailer, RepRequest } from "../lib/repAuth";
import { createOrderForRetailer } from "../lib/orders";
import { createRateLimiter } from "../platform/http/rateLimit";
import { normalizeIndianPhone } from "../modules/identity/otpService";
import { lazyIdentityOtpService } from "../modules/identity/otpRuntime";
import { createOtpRouter } from "../modules/identity/otpRoutes";
import { createSessionRouter } from "../modules/identity/sessionRoutes";
import { lazyIdentitySessionService } from "../modules/identity/sessionRuntime";
import {
  createRequireSession,
  type IdentityAuthedRequest,
} from "../modules/identity/sessionAuth";
import { internalStatusForOrder, statusFromOrderWithEvents } from "../modules/commercialStatus/statusService";
import { CommercialStatusCode } from "@prisma/client";
import { attributeOrders } from "../modules/orders/orderAttribution";
import { staffWorkspaceState } from "../modules/identity/staffAppAccess";
import { evaluateCoupon } from "../modules/promotions/couponService";
import { Msg91Error, verifyMsg91AccessToken } from "../modules/identity/msg91Service";

const router = Router();
const maxLedgerSequence = 9_223_372_036_854_775_807n;
const ledgerSequenceCursor = z.string().refine(
  (value) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= maxLedgerSequence
);
const retailerLedgerQuerySchema = z.object({
  beforeSequence: ledgerSequenceCursor.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

/* ---------------------------------- auth --------------------------------- */

async function findStaffAccount(phoneInput: string) {
  const normalized = normalizeIndianPhone(phoneInput);
  return prisma.staffUser.findFirst({
    where: {
      phone: { in: [normalized, normalized.slice(3)] },
      status: "active",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      salesRep: { select: { id: true, name: true, phone: true } },
      roles: { select: { role: { select: { name: true } } } },
    },
  });
}

router.use(
  "/auth",
  createOtpRouter({
    realm: "staff",
    otpService: lazyIdentityOtpService,
    findAccount: findStaffAccount,
    issueIdentity: async (staff, req) => {
      const session = await lazyIdentitySessionService.createSession({
        realm: "staff",
        subjectId: staff.id,
        deviceName: req.header("x-device-name") ?? undefined,
        userAgent: req.header("user-agent") ?? undefined,
      });
      const claims = lazyIdentitySessionService.verifyAccessToken(session.accessToken, "staff");
      const roles = staff.roles.map(({ role }) => role.name);
      const workspace = staffWorkspaceState({
        status: "active", roles, permissions: claims.permissions,
        staffPhone: staff.phone,
        salesRepId: staff.salesRep?.id ?? null,
        salesRepPhone: staff.salesRep?.phone ?? null,
      });
      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        session: { id: session.session.id, expiresAt: session.session.expiresAt },
        staff: {
          id: staff.id,
          name: staff.name,
          phone: staff.phone,
          email: staff.email,
          permissions: claims.permissions,
          roles,
          workspaceMode: workspace.workspaceMode,
          setupCode: workspace.setupCode,
        },
        rep: staff.salesRep,
      };
    },
  })
);

router.use(
  "/auth",
  createSessionRouter({
    realm: "staff",
    sessions: lazyIdentitySessionService,
    otpService: lazyIdentityOtpService,
    resolvePhone: async (staffId) => {
      const staff = await prisma.staffUser.findUniqueOrThrow({
        where: { id: staffId },
        select: { phone: true },
      });
      return staff.phone;
    },
  })
);

async function autoProvisionStaffAccount(phoneInput: string) {
  const normalized = normalizeIndianPhone(phoneInput);
  const plainDigits = normalized.slice(3);

  const existing = await findStaffAccount(phoneInput);
  if (existing) return existing;

  let role = await prisma.role.findFirst({
    where: { name: "salesperson" },
  });
  if (!role) {
    role = await prisma.role.findFirst();
  }

  let salesRep = await prisma.salesRep.findFirst({
    where: { phone: plainDigits },
  });
  if (!salesRep) {
    salesRep = await prisma.salesRep.create({
      data: {
        name: `Field Sales (${plainDigits.slice(-4)})`,
        phone: plainDigits,
        territory: "Indore",
      },
    });
  }

  const staff = await prisma.staffUser.create({
    data: {
      name: `Field Sales (${plainDigits.slice(-4)})`,
      phone: plainDigits,
      email: `sales-${plainDigits}@gagantoordal.com`,
      status: "active",
      salesRepId: salesRep.id,
      roles: role ? { create: { roleId: role.id } } : undefined,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      salesRep: { select: { id: true, name: true, phone: true } },
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  return staff;
}

router.post("/auth/msg91/verify", async (req, res) => {
  const token = req.body.accessToken || req.body["access-token"] || req.body.token;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "missing_token", message: "MSG91 access token is required" });
  }

  try {
    const { phone } = await verifyMsg91AccessToken({
      accessToken: token,
      expectedPhone: req.body.phone,
    });

    let staff = await findStaffAccount(phone);
    if (!staff) {
      staff = await autoProvisionStaffAccount(phone);
    }

    const session = await lazyIdentitySessionService.createSession({
      realm: "staff",
      subjectId: staff.id,
      deviceName: req.header("x-device-name") ?? undefined,
      userAgent: req.header("user-agent") ?? undefined,
    });

    const claims = lazyIdentitySessionService.verifyAccessToken(session.accessToken, "staff");
    const roles = staff.roles.map(({ role }) => role.name);
    const workspace = staffWorkspaceState({
      status: "active",
      roles,
      permissions: claims.permissions,
      staffPhone: staff.phone,
      salesRepId: staff.salesRep?.id ?? null,
      salesRepPhone: staff.salesRep?.phone ?? null,
    });

    return res.json({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      session: { id: session.session.id, expiresAt: session.session.expiresAt },
      staff: {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        email: staff.email,
        permissions: claims.permissions,
        roles,
        workspaceMode: workspace.workspaceMode,
        setupCode: workspace.setupCode,
      },
      rep: staff.salesRep,
    });
  } catch (err) {
    if (err instanceof Msg91Error) {
      return res.status(err.status).json({ error: err.code, details: err.details });
    }
    return res.status(500).json({
      error: "msg91_verification_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
router.post("/auth/msg91", (req, res) => {
  // Alias for /auth/msg91/verify
  return (router as any).handle({ ...req, url: "/auth/msg91/verify" }, res);
});

const requireStaffSession = createRequireSession("staff", lazyIdentitySessionService);

router.get("/me", requireStaffSession, async (req: IdentityAuthedRequest, res) => {
  const staff = await prisma.staffUser.findUnique({
    where: { id: req.identityAuth!.subjectId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      salesRep: { select: { id: true, name: true, phone: true } },
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!staff) return res.status(401).json({ error: "Session no longer valid" });
  const { salesRep, roles: staffRoles, ...identity } = staff;
  const roles = staffRoles.map(({ role }) => role.name);
  const workspace = staffWorkspaceState({
    status: "active", roles, permissions: req.staffAuth!.permissions,
    staffPhone: staff.phone,
    salesRepId: salesRep?.id ?? null,
    salesRepPhone: salesRep?.phone ?? null,
  });
  res.json({
    staff: { ...identity, permissions: req.staffAuth!.permissions, roles, workspaceMode: workspace.workspaceMode, setupCode: workspace.setupCode },
    rep: salesRep,
  });
});

/* -------------------------------- retailers ------------------------------- */

router.get("/retailers", requireRep, async (req: RepRequest, res) => {
  const retailers = await prisma.retailer.findMany({
    where: { salesRepId: req.repId },
    include: { tier: true, location: true },
    orderBy: { name: "asc" },
  });

  const retailerIds = retailers.map((r) => r.id);
  const openInvoices = await prisma.invoice.findMany({
    where: {
      retailerId: { in: retailerIds },
      status: { in: ["open", "partially_paid"] },
    },
    select: {
      retailerId: true,
      outstandingAmount: true,
      dueDate: true,
    },
  });

  const now = new Date();
  const invoicesByRetailer = new Map<string, { count: number; outstanding: number; overdue: number }>();
  for (const inv of openInvoices) {
    const existing = invoicesByRetailer.get(inv.retailerId) ?? { count: 0, outstanding: 0, overdue: 0 };
    const amount = Number(inv.outstandingAmount || 0);
    existing.count += 1;
    existing.outstanding += amount;
    if (new Date(inv.dueDate) < now) {
      existing.overdue += amount;
    }
    invoicesByRetailer.set(inv.retailerId, existing);
  }

  const summary = retailers.map((r) => {
    const invData = invoicesByRetailer.get(r.id);
    const hasLocalInvoices = (invData?.count ?? 0) > 0;
    const limit = Number(r.creditLimit || 0);
    const outstanding = hasLocalInvoices ? invData!.outstanding : Number(r.currentBalance || 0);
    const overdue = hasLocalInvoices ? invData!.overdue : Number(r.overdueAmount || 0);
    const reconciliationRequired = hasLocalInvoices && Math.abs(Number(r.currentBalance || 0) - outstanding) > 0.01;
    const balance = outstanding;

    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      shopAddress: r.shopAddress,
      deliveryCity: (r as any).deliveryCity ?? null,
      tier: r.tier.name,
      internalSegment: r.internalSegment,
      location: r.location ? {
        status: r.location.status,
        latitude: r.location.latitude ? Number(r.location.latitude) : null,
        longitude: r.location.longitude ? Number(r.location.longitude) : null,
        accuracyMeters: r.location.accuracyMeters ? Number(r.location.accuracyMeters) : null,
      } : null,
      creditLimit: limit,
      outstanding: balance,
      overdue,
      available: Math.max(limit - balance, 0),
      utilisationPct: limit > 0 ? Math.round((balance / limit) * 100) : 0,
      reconciliationRequired,
      financialSummary: {
        outstanding,
        overdue,
        creditLimit: limit,
        creditUsed: balance,
        availableCredit: Math.max(limit - balance, 0),
        reconciliationRequired,
      },
    };
  });

  res.json({
    retailers: summary,
    totals: {
      count: summary.length,
      outstanding: summary.reduce((s, r) => s + (r.reconciliationRequired ? 0 : r.outstanding), 0),
      overdue: summary.reduce((s, r) => s + (r.reconciliationRequired ? 0 : r.overdue), 0),
      reconciliationRequiredCount: summary.filter((r) => r.reconciliationRequired).length,
    },
  });
});

router.get("/retailers/:id/summary", requireRep, async (req: RepRequest, res) => {
  const retailer = await prisma.retailer.findFirst({
    where: { id: req.params.id, salesRepId: req.repId },
    select: {
      id: true, name: true, phone: true, shopAddress: true, status: true,
      internalSegment: true, creditLimit: true, currentBalance: true, overdueAmount: true,
      tier: { select: { name: true } },
      location: true,
    },
  });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });
  const [financialSummary, kycCase, creditProfile, lastOrder] = await Promise.all([
    financialSummaryFor(prisma, retailer.id),
    prisma.kycCase.findUnique({ where: { retailerId: retailer.id }, select: { status: true } }),
    prisma.creditProfile.findUnique({ where: { retailerId: retailer.id }, select: { kycVerifiedAt: true } }),
    prisma.order.findFirst({ where: { retailerId: retailer.id }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, orderTotal: true } }),
  ]);
  const limit = financialSummary?.creditLimit ?? Number(retailer.creditLimit);
  const balance = financialSummary?.creditUsed ?? Number(retailer.currentBalance);
  res.json({
    retailer: {
      id: retailer.id, name: retailer.name, phone: retailer.phone,
      shopAddress: retailer.shopAddress, tier: retailer.tier.name,
      internalSegment: retailer.internalSegment, lifecycle: retailer.status,
    },
    location: retailer.location ? {
      status: retailer.location.status,
      latitude: retailer.location.latitude ? Number(retailer.location.latitude) : null,
      longitude: retailer.location.longitude ? Number(retailer.location.longitude) : null,
      accuracyMeters: retailer.location.accuracyMeters ? Number(retailer.location.accuracyMeters) : null,
    } : null,
    kyc: { status: kycCase?.status ?? null, legacyVerified: creditProfile?.kycVerifiedAt != null },
    credit: {
      creditLimit: limit, outstanding: balance,
      overdue: financialSummary?.overdue ?? Number(retailer.overdueAmount),
      available: financialSummary?.availableCredit ?? Math.max(limit - balance, 0),
      utilisationPct: limit > 0 ? Math.round((balance / limit) * 100) : 0,
    },
    financialSummary: financialSummary ? {
      reconciliationRequired: financialSummary.reconciliationRequired,
      entityBalances: financialSummary.entityBalances,
    } : null,
    lastOrderSummary: lastOrder,
    recentOrders: [],
    recentLedger: [],
  });
});

router.get("/retailers/:id/visits", requireRep, async (req: RepRequest, res) => {
  const retailer = await assignedRetailer(req.repId!, req.params.id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });
  const [visits, activeVisitElsewhere] = await Promise.all([
    prisma.salesVisit.findMany({
      where: { retailerId: retailer.id, salespersonId: req.staffId },
      orderBy: { checkedInAt: "desc" }, take: 5,
    }),
    prisma.salesVisit.findFirst({
      where: { salespersonId: req.staffId, checkedOutAt: null, retailerId: { not: retailer.id } },
      orderBy: { checkedInAt: "desc" },
      include: { retailer: { select: { id: true, name: true } } },
    }),
  ]);
  res.json({ visits, activeVisitElsewhere });
});

router.get("/retailers/:id", requireRep, async (req: RepRequest, res) => {
  const retailer = await assignedRetailer(req.repId!, req.params.id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const [tier, orders, entries, kycCase, creditProfile, financialSummary, location] = await Promise.all([
    prisma.tier.findUnique({ where: { id: retailer.tierId } }),
    prisma.order.findMany({
      where: { retailerId: retailer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: { include: { variant: { include: { product: true } } } },
        heldBy: { select: { id: true, name: true } },
        commercialStatusEvents: {
          orderBy: { createdAt: "desc" },
          include: { actorStaff: { select: { id: true, name: true } } },
        },
      },
    }),
    financialLedgerFor(prisma, retailer.id).then((ledger) => ledger.slice(0, 5)),
    prisma.kycCase.findUnique({ where: { retailerId: retailer.id }, select: { id: true, status: true, submittedAt: true, reviewedAt: true, rejectionReason: true } }),
    prisma.creditProfile.findUnique({ where: { retailerId: retailer.id }, select: { kycVerifiedAt: true } }),
    financialSummaryFor(prisma, retailer.id),
    prisma.retailerLocation.findUnique({ where: { retailerId: retailer.id } }),
  ]);

  const limit = financialSummary?.creditLimit ?? Number(retailer.creditLimit);
  const balance = financialSummary?.creditUsed ?? Number(retailer.currentBalance);
  const attributedRecentOrders = await attributeOrders(orders);
  const recentOrders = attributedRecentOrders.map((order, index) => {
    const { heldBy: _heldBy, ...publicOrder } = order;
    return { ...publicOrder, commercialStatus: statusFromOrderWithEvents(orders[index]) };
  });

  res.json({
    retailer: {
      id: retailer.id,
      name: retailer.name,
      phone: retailer.phone,
      shopAddress: retailer.shopAddress,
      tier: tier?.name ?? "—",
      internalSegment: retailer.internalSegment,
      lifecycle: retailer.status,
    },
    location: location ? {
      status: location.status,
      latitude: location.latitude ? Number(location.latitude) : null,
      longitude: location.longitude ? Number(location.longitude) : null,
      accuracyMeters: location.accuracyMeters ? Number(location.accuracyMeters) : null,
    } : null,
    kyc: { ...kycCase, legacyVerified: creditProfile?.kycVerifiedAt != null },
    credit: {
      creditLimit: limit,
      outstanding: balance,
      overdue: financialSummary?.overdue ?? Number(retailer.overdueAmount),
      available: financialSummary?.availableCredit ?? Math.max(limit - balance, 0),
      utilisationPct: limit > 0 ? Math.round((balance / limit) * 100) : 0,
    },
    financialSummary,
    recentOrders,
    recentLedger: entries,
  });
});

router.get("/retailers/:id/ledger", requireRep, async (req: RepRequest, res) => {
  const retailer = await assignedRetailer(req.repId!, req.params.id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const parsed = retailerLedgerQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_ledger_query" });

  const { beforeSequence, limit } = parsed.data;
  const [financialSummary, fetchedEntries] = await Promise.all([
    financialSummaryFor(prisma, retailer.id),
    financialLedgerFor(prisma, retailer.id, {
      ...(beforeSequence === undefined ? {} : { beforeSequence: BigInt(beforeSequence) }),
      take: limit + 1,
    }),
  ]);
  if (!financialSummary) return res.status(404).json({ error: "Retailer not found" });

  const hasMore = fetchedEntries.length > limit;
  const entries = hasMore ? fetchedEntries.slice(0, limit) : fetchedEntries;
  res.json({
    financialSummary,
    entries,
    nextCursor: hasMore ? entries[entries.length - 1]?.sequence ?? null : null,
  });
});

/** Catalog priced for the selected retailer's tier, not the rep's. */
router.get("/retailers/:id/catalog", requireRep, async (req: RepRequest, res) => {
  const retailer = await assignedRetailer(req.repId!, req.params.id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const [products, priceList, overrides, inventory, drafts] = await Promise.all([
    prisma.product.findMany({
      where: { catalogStatus: catalogueStatusWhere(), variants: { some: { catalogStatus: catalogueStatusWhere() } } },
      include: { variants: { where: { catalogStatus: catalogueStatusWhere() } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.priceList.findMany({ where: { tierId: retailer.tierId } }),
    prisma.priceOverride.findMany({ where: { retailerId: retailer.id } }),
    prisma.inventorySnapshot.findMany({ where: { warehouseCode: DEFAULT_WAREHOUSE_CODE } }),
    prisma.catalogOrderingDraft.findMany(),
  ]);

  const tierPrice = new Map(priceList.map((p) => [p.variantId, Number(p.price)]));
  const overridePrice = new Map(overrides.map((o) => [o.variantId, Number(o.price)]));
  const draftsMap = new Map((drafts || []).map((d) => [d.variantId, Number((d.values as any)?.discount || 0)]));

  const catalog = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
      imageUrl: publicMediaUrl(req, product.imageUrl),
    description: product.description,
    variants: product.variants.map((v) => {
      const inventorySnapshot = selectInventorySnapshot(product, v, inventory);
      const override = overridePrice.get(v.id);
      const rate = override ?? tierPrice.get(v.id) ?? null;
      const caseWeightKg = Number(v.unitWeightKg) * v.unitsPerCase;
      const rateBasis=(overrides.find(p=>p.variantId===v.id) ?? priceList.find(p=>p.variantId===v.id))?.rateBasis ?? "case";
      const price=rate===null?null:rateBasis==="quintal"?Math.round(rate*caseWeightKg)/100:rate;
      const discount = draftsMap.get(v.id) ?? 0;
      const availability = {
        available: 999999,
        warehouseCode: DEFAULT_WAREHOUSE_CODE,
        status: "available",
        syncedAt: new Date(),
      };
      return {
        id: v.id,
        imageUrl: publicMediaUrl(req, v.imageUrl ?? product.imageUrl),
        unitSize: v.unitSize,
        unit: v.unit,
        unitsPerCase: v.unitsPerCase,
        caseWeightKg,
        commercialRate:rate,rateBasis,...retailerCommercialFields(v),
        discount,
        price,
        catalogStatus: v.catalogStatus,
        ...withInventoryOrderability(catalogueOrderingState(v.catalogStatus, v.gstPercent?.toString() ?? null, v.gstPendingOrderAllowed), availability),
        ...catalogueImageState(v),
        rateLabel: (() => {
          if (rate === null) return null;
          const gst = v.gstPercent == null ? null : Number(v.gstPercent);
          const gstLabel = gst != null && Number.isFinite(gst) ? (gst === 0 ? "Including 0% GST (Nil)" : `Including ${gst}% GST`) : "Excluding GST";
          return `${rateBasis === "quintal" ? "per quintal" : "per case"} · ${gstLabel}`;
        })(),
        isOverride: override != null,
        pricePerKg:
          price != null && caseWeightKg > 0 ? Math.round((price / caseWeightKg) * 100) / 100 : null,
        availability,
      };
    }),
  }));

  res.json({
    catalog,
    groups: groupCatalog(catalog.map((product, index) => ({ ...product, sapMaterialId: products[index].sapMaterialId }))),
    categories: [...new Set(products.map((p) => p.category))].sort(),
  });
});

/* --------------------------------- orders --------------------------------- */

/**
 * Canonical read model for a salesperson's order detail. The order remains the
 * source of truth; audit events are only used to show transitions that were
 * actually recorded by Admin/delivery services.
 */
router.get("/orders/:id", requireRep, async (req: RepRequest, res) => {
  const order = await prisma.order.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { placedByRepId: req.repId },
        { retailer: { salesRepId: req.repId } },
      ],
    },
    include: {
      retailer: { select: { id: true, name: true, phone: true, shopAddress: true } },
      items: { include: { variant: { include: { product: true } } } },
      delivery: true,
      invoice: { select: { invoiceNumber: true, invoiceDate: true, dueDate: true, total: true, outstandingAmount: true, commercialSnapshot:true } },
      commercialStatusEvents: {
        where: { code: CommercialStatusCode.SALES_ORDER_PUNCHED },
        select: { code: true, actorStaff: { select: { name: true } } },
      },
    },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  const [attributedOrder] = await attributeOrders([order]);

  const events = await prisma.auditEvent.findMany({
    where: { subjectType: "order", subjectId: order.id, action: { startsWith: "order." } },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, metadata: true, createdAt: true },
  });
  res.json({ order: attributedOrder, events, commercialStatus: await internalStatusForOrder(order.id) });
});

/**
 * List all orders punched by this salesperson or assigned to their retailers.
 */
router.get("/orders", requireRep, async (req: RepRequest, res) => {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { placedByRepId: req.repId },
        { retailer: { salesRepId: req.repId } },
      ],
    },
    include: {
      retailer: { select: { id: true, name: true, phone: true, shopAddress: true, deliveryCity: true } },
      items: { include: { variant: { include: { product: true } } } },
      delivery: true,
      invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true, total: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const attributed = await attributeOrders(orders);
  res.json({ orders: attributed });
});

/**
 * Cancel an order punched by this salesperson.
 * Permitted only on the same calendar day, and only if status has not advanced past placed/confirmed.
 */
router.post("/orders/:id/cancel", requireRep, async (req: RepRequest, res) => {
  const order = await prisma.order.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { placedByRepId: req.repId },
        { retailer: { salesRepId: req.repId } },
      ],
    },
    include: { retailer: true },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found or not punched by you" });
  }

  // 1. Same-day check
  const todayStr = new Date().toDateString();
  const orderDateStr = new Date(order.createdAt).toDateString();
  if (todayStr !== orderDateStr) {
    return res.status(400).json({ error: "Orders can only be cancelled on the same day they were punched" });
  }

  // 2. Status progression check
  if (order.status !== "placed" && order.status !== "confirmed") {
    return res.status(400).json({
      error: `Order cannot be cancelled because its fulfillment status has already changed to ${order.status}`,
    });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "rejected",
    },
  });

  await prisma.auditEvent.create({
    data: {
      subjectType: "order",
      subjectId: order.id,
      action: "order.cancelled_by_rep",
      actorStaffId: req.staffId ?? null,
      metadata: { reason: "Cancelled by sales representative on same day" },
    },
  });

  res.json({ ok: true, order: updated });
});

const repOrderSchema = z.object({
  commercial: z.object({quoteId:z.string(),revision:z.number().int().positive()}).optional(),
  couponCode: z.string().trim().max(30).optional(),
  retailerId: z.string(),
  items: z.array(z.object({ variantId: z.string(), qty: z.number().int().positive() })).min(1),
  dispatchDate: z.string().trim().optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
  transportName: z.string().trim().max(100).optional().nullable(),
});

router.post("/orders/validate-coupon", requireRep, (req: RepRequest, res) => {
  const parsed = z.object({
    code: z.string().trim().min(1),
    subtotal: z.number().min(0),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const result = evaluateCoupon(parsed.data.code, parsed.data.subtotal);
  res.json(result);
});

router.post("/orders", requireRep, createRateLimiter({ name: "rep-order", limit: 20, windowMs: 60_000 }), async (req: RepRequest, res) => {
  const idempotencyKey = req.header("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return res.status(400).json({ error: "idempotency_key_required" });
  }
  const parsed = repOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const retailer = await assignedRetailer(req.repId!, parsed.data.retailerId);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const result = await createOrderForRetailer(
    retailer.id,
    parsed.data.items,
    "rep",
    req.repId,
    req.staffId,
    idempotencyKey,
    parsed.data.commercial,
    parsed.data.couponCode,
    {
      dispatchDate: parsed.data.dispatchDate,
      remarks: parsed.data.remarks,
      transportName: parsed.data.transportName,
    }
  );
  if (!result.ok) return res.status(result.status).json(result.body);

  res.status(201).json({
    order: result.order,
    creditDecision: result.decision,
    approvalRequest: result.approvalRequest ?? null,
    dispatchAuthorization: result.dispatchAuthorization ?? null,
  });
});

export default router;
