export const ADMIN_GROUPS = [
  { id: "home", label: "Home" },
  { id: "work", label: "Work" },
  { id: "sales", label: "Sales" },
  { id: "finance", label: "Finance" },
  { id: "field", label: "Field" },
  { id: "system", label: "System" },
] as const;

export type AdminGroupId = (typeof ADMIN_GROUPS)[number]["id"];

export type AdminDestination = {
  id: string;
  group: AdminGroupId;
  label: string;
  route: string | null;
  description: string;
  keywords: readonly string[];
  permissions: readonly string[];
  relatedTo: readonly string[];
};

const STAFF = ["staff.manage"] as const;
const APPROVALS = ["approval.second_invoice", "approval.third_invoice", "legal.decide"] as const;
const COLLECTIONS = ["collection.confirm"] as const;
const CREDIT = ["credit.rating_confirm"] as const;
const SURVEYS = ["survey.manage"] as const;
const WAREHOUSE = ["order.warehouse_process"] as const;
const OPS_ORDERS = ["order.warehouse_process", "dispatch.execute"] as const;
const RETAILER_REVIEW = ["retailer.proposal_review"] as const;
const ORG = ["org.view_all"] as const;
const TEAM_PERFORMANCE = ["performance.view_team"] as const;
const COMMERCIAL = ["staff.manage", "collection.confirm"] as const;
const CORRECTIONS = ["financial.correct"] as const;
const RECOVERY = ["recovery.view", "recovery.update"] as const;
const LEGAL = ["staff.manage", "legal.decide"] as const;
const KYC = ["kyc.view", "kyc.review"] as const;
const ATTENDANCE = ["attendance.review"] as const;
const ROUTES = ["route.manage"] as const;
const EXPENSES = ["expense.review"] as const;
const ISSUES = ["issue.review"] as const;
const FEEDBACK = ["feedback.review"] as const;
const LOCATIONS = ["location.view"] as const;
const VISITS = ["visit.view"] as const;
const IMPORTS = ["data.import", "staff.manage"] as const;
const HOME = [
  "staff.manage",
  "dashboard.view",
  "approval.second_invoice",
  "collection.confirm",
  "credit.rating_confirm",
  "route.manage",
  "attendance.review",
  "performance.view_team",
  "retailer.proposal_review",
  "expense.review",
  "issue.review",
  "kyc.view",
  "recovery.view",
  "financial.correct",
  "org.view_all",
  "location.view",
  "visit.view",
] as const;

export const ADMIN_NAV_GROUPS: { id: AdminGroupId; label: string; destinations: AdminDestination[] }[] = [
  {
    id: "home",
    label: "Home",
    destinations: [
      {
        id: "work",
        group: "home",
        label: "Work",
        route: "/",
        description: "Operations home",
        keywords: ["home", "dashboard", "work"],
        permissions: HOME,
        relatedTo: ["/"],
      },
    ],
  },
  {
    id: "work",
    label: "Work",
    destinations: [
      {
        id: "approvals",
        group: "work",
        label: "Approvals",
        route: "/approvals",
        description: "Invoice and order approvals",
        keywords: ["approval", "approve", "approve order", "order approval", "invoice"],
        permissions: APPROVALS,
        relatedTo: ["/approvals", "/orders"],
      },
      {
        id: "collections",
        group: "work",
        label: "Collections",
        route: "/collections",
        description: "Confirm collections and receipts",
        keywords: ["collection", "payment", "receipt"],
        permissions: COLLECTIONS,
        relatedTo: ["/collections", "/ledger"],
      },
      {
        id: "credit-reviews",
        group: "work",
        label: "Credit reviews",
        route: "/credit-reviews",
        description: "Confirm credit ratings",
        keywords: ["credit", "rating"],
        permissions: CREDIT,
        relatedTo: ["/credit-reviews"],
      },
      {
        id: "market-surveys",
        group: "work",
        label: "Market surveys",
        route: "/market-surveys",
        description: "Field market surveys",
        keywords: ["survey", "market"],
        permissions: SURVEYS,
        relatedTo: ["/market-surveys"],
      },
      {
        id: "warehouse-orders",
        group: "work",
        label: "Warehouse orders",
        route: "/warehouse-orders",
        description: "Pack and dispatch warehouse orders",
        keywords: ["warehouse", "pack", "dispatch"],
        permissions: WAREHOUSE,
        relatedTo: ["/warehouse-orders"],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    destinations: [
      {
        id: "orders",
        group: "sales",
        label: "Orders",
        route: "/orders",
        description: "Review and approve orders",
        keywords: ["order", "approve order", "order approval"],
        permissions: OPS_ORDERS,
        relatedTo: ["/orders", "/approvals", "/warehouse-orders"],
      },
      {
        id: "retailers",
        group: "sales",
        label: "Retailers",
        route: "/retailers",
        description: "Shops, stores, and customers",
        keywords: ["retailer", "customer", "shop", "store"],
        permissions: STAFF,
        relatedTo: ["/retailers", "/retailer-approvals", "/orders"],
      },
      {
        id: "retailer-approvals",
        group: "sales",
        label: "New retailers",
        route: "/retailer-approvals",
        description: "Review new retailer proposals",
        keywords: ["new retailer", "proposal", "shop", "store"],
        permissions: RETAILER_REVIEW,
        relatedTo: ["/retailer-approvals", "/retailers"],
      },
      {
        id: "sales-organisation",
        group: "sales",
        label: "Organisation",
        route: "/sales-organisation",
        description: "Sales organisation",
        keywords: ["organisation", "organization", "org"],
        permissions: ORG,
        relatedTo: ["/sales-organisation"],
      },
      {
        id: "sales-leader",
        group: "sales",
        label: "Sales leader",
        route: "/sales-leader",
        description: "Sales leader performance",
        keywords: ["sales leader", "salesman", "salesperson", "sales person", "sales rep"],
        permissions: TEAM_PERFORMANCE,
        relatedTo: ["/sales-leader"],
      },
      {
        id: "catalog",
        group: "sales",
        label: "Catalog",
        route: "/catalog",
        description: "Catalogue, pricing, and ordering setup",
        keywords: ["catalog", "catalogue", "product", "gst", "tax", "price", "stock", "inventory"],
        permissions: STAFF,
        relatedTo: ["/catalog", "/commercial", "/imports"],
      },
      {
        id: "commercial",
        group: "sales",
        label: "Commercial",
        route: "/commercial",
        description: "Commercial terms and billing",
        keywords: ["commercial", "gst", "tax", "billing"],
        permissions: COMMERCIAL,
        relatedTo: ["/commercial", "/catalog"],
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    destinations: [
      {
        id: "ledger",
        group: "finance",
        label: "Ledger",
        route: "/ledger",
        description: "Retailer ledger balances",
        keywords: ["ledger", "payment", "collection", "receipt", "balance"],
        permissions: STAFF,
        relatedTo: ["/ledger", "/collections"],
      },
      {
        id: "corrections",
        group: "finance",
        label: "Corrections",
        route: "/corrections",
        description: "Financial corrections",
        keywords: ["correction", "financial"],
        permissions: CORRECTIONS,
        relatedTo: ["/corrections"],
      },
      {
        id: "recovery",
        group: "finance",
        label: "Recovery",
        route: "/recovery",
        description: "Overdue recovery",
        keywords: ["recovery", "overdue"],
        permissions: RECOVERY,
        relatedTo: ["/recovery"],
      },
      {
        id: "legal",
        group: "finance",
        label: "Legal",
        route: "/legal",
        description: "Legal decisions",
        keywords: ["legal"],
        permissions: LEGAL,
        relatedTo: ["/legal"],
      },
      {
        id: "kyc",
        group: "finance",
        label: "KYC",
        route: "/kyc",
        description: "Know your customer reviews",
        keywords: ["kyc", "document"],
        permissions: KYC,
        relatedTo: ["/kyc"],
      },
    ],
  },
  {
    id: "field",
    label: "Field",
    destinations: [
      {
        id: "field-team",
        group: "field",
        label: "Team & leave",
        route: "/field-team",
        description: "Attendance and leave",
        keywords: ["attendance", "leave", "team"],
        permissions: ATTENDANCE,
        relatedTo: ["/field-team"],
      },
      {
        id: "field-planning",
        group: "field",
        label: "Routes & tasks",
        route: "/field-planning",
        description: "Beats, market routes, and tasks",
        keywords: ["beat", "route", "market route", "task"],
        permissions: ROUTES,
        relatedTo: ["/field-planning"],
      },
      {
        id: "field-expenses",
        group: "field",
        label: "Expenses",
        route: "/field-expenses",
        description: "Review field expenses",
        keywords: ["expense"],
        permissions: EXPENSES,
        relatedTo: ["/field-expenses"],
      },
      {
        id: "service-issues",
        group: "field",
        label: "Issues",
        route: "/service-issues",
        description: "Review service issues",
        keywords: ["issue", "complaint"],
        permissions: ISSUES,
        relatedTo: ["/service-issues"],
      },
      {
        id: "salesperson-feedback",
        group: "field",
        label: "Feedback",
        route: "/salesperson-feedback",
        description: "Salesperson feedback",
        keywords: ["feedback", "salesman", "salesperson", "sales person", "sales rep"],
        permissions: FEEDBACK,
        relatedTo: ["/salesperson-feedback"],
      },
      {
        id: "locations",
        group: "field",
        label: "Store locations",
        route: "/locations",
        description: "Store and shop locations",
        keywords: ["location", "store", "shop"],
        permissions: LOCATIONS,
        relatedTo: ["/locations"],
      },
      {
        id: "visits",
        group: "field",
        label: "Visits",
        route: "/visits",
        description: "Field visits",
        keywords: ["visit", "store"],
        permissions: VISITS,
        relatedTo: ["/visits", "/locations"],
      },
    ],
  },
  {
    id: "system",
    label: "System",
    destinations: [
      {
        id: "staff",
        group: "system",
        label: "Users & roles",
        route: "/staff",
        description: "Users, roles, and salespeople",
        keywords: ["user", "role", "staff", "salesman", "salesperson", "sales person", "sales rep"],
        permissions: STAFF,
        relatedTo: ["/staff"],
      },
      {
        id: "sap",
        group: "system",
        label: "SAP sync",
        route: "/sap",
        description: "SAP synchronisation",
        keywords: ["sap", "sync"],
        permissions: STAFF,
        relatedTo: ["/sap", "/orders"],
      },
      {
        id: "imports",
        group: "system",
        label: "Data import",
        route: "/imports",
        description: "Authorised data imports",
        keywords: ["import", "inventory", "stock", "quantity", "data"],
        permissions: IMPORTS,
        relatedTo: ["/imports", "/catalog"],
      },
    ],
  },
];

export const ADMIN_ACTIONS: AdminDestination[] = [
  {
    id: "approve-order",
    group: "sales",
    label: "Approve order",
    route: "/orders",
    description: "Open orders ready for approval",
    keywords: ["approve", "order", "order approval"],
    permissions: STAFF,
    relatedTo: ["/orders", "/approvals"],
  },
  {
    id: "review-approval",
    group: "work",
    label: "Review approval",
    route: "/approvals",
    description: "Open the approvals queue",
    keywords: ["approve order", "order approval", "approval"],
    permissions: APPROVALS,
    relatedTo: ["/approvals", "/orders"],
  },
  {
    id: "create-retailer",
    group: "sales",
    label: "Create retailer",
    route: "/retailers",
    description: "Open retailers",
    keywords: ["create retailer", "new shop", "customer"],
    permissions: STAFF,
    relatedTo: ["/retailers"],
  },
  {
    id: "review-new-retailer",
    group: "sales",
    label: "Review new retailer",
    route: "/retailer-approvals",
    description: "Open new retailer proposals",
    keywords: ["new retailer", "proposal"],
    permissions: RETAILER_REVIEW,
    relatedTo: ["/retailer-approvals"],
  },
  {
    id: "setup-ordering",
    group: "sales",
    label: "Set up ordering",
    route: "/catalog",
    description: "Open catalogue ordering setup",
    keywords: ["ordering", "setup", "gst", "price"],
    permissions: STAFF,
    relatedTo: ["/catalog"],
  },
  {
    id: "update-gst",
    group: "sales",
    label: "Update GST",
    route: "/catalog",
    description: "Open catalogue GST setup",
    keywords: ["gst", "tax"],
    permissions: STAFF,
    relatedTo: ["/catalog", "/commercial"],
  },
  {
    id: "set-selling-price",
    group: "sales",
    label: "Set selling price",
    route: "/catalog",
    description: "Open catalogue selling prices",
    keywords: ["price", "rate", "selling price"],
    permissions: STAFF,
    relatedTo: ["/catalog"],
  },
  {
    id: "import-inventory",
    group: "system",
    label: "Import inventory",
    route: "/imports?type=inventory",
    description: "Open the authorised inventory import",
    keywords: ["inventory", "stock", "quantity", "import"],
    permissions: IMPORTS,
    relatedTo: ["/catalog", "/imports"],
  },
  {
    id: "review-collection",
    group: "work",
    label: "Review collection",
    route: "/collections",
    description: "Open collections",
    keywords: ["collection", "payment", "receipt"],
    permissions: COLLECTIONS,
    relatedTo: ["/collections"],
  },
  {
    id: "assign-role",
    group: "system",
    label: "Assign role",
    route: "/staff",
    description: "Open users and roles",
    keywords: ["role", "user", "salesman", "salesperson", "sales person", "sales rep"],
    permissions: STAFF,
    relatedTo: ["/staff"],
  },
  {
    id: "review-feedback",
    group: "field",
    label: "Review salesperson feedback",
    route: "/salesperson-feedback",
    description: "Open salesperson feedback",
    keywords: ["feedback", "salesman", "salesperson", "sales person", "sales rep"],
    permissions: FEEDBACK,
    relatedTo: ["/salesperson-feedback"],
  },
];

export const ADMIN_UNAVAILABLE: AdminDestination[] = [
  {
    id: "catalogue-identity",
    group: "sales",
    label: "Catalogue identity approval",
    route: null,
    description: "Requires controlled catalogue publication workflow",
    keywords: ["catalogue identity", "catalog identity", "catalogue key", "internal code", "publication", "identity"],
    permissions: STAFF,
    relatedTo: ["/catalog"],
  },
];

export const CATALOGUE_IDENTITY_UNAVAILABLE = "Not available in Admin";
