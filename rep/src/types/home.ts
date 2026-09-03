export type RouteStopStatus = "NEXT" | "DONE" | "PLANNED";

export interface SalesHomeStop {
  id: string;
  name: string;
  address: string;
  area: string;
  timeLabel: string;
  status: RouteStopStatus;
}

export interface SalesHomePayload {
  staff: { id: string; name: string };
  territory: string | null;
  greeting: "morning" | "afternoon" | "evening";
  sales: {
    today: number;
    week: number;
    dailyTarget: number;
    weeklyTarget: number;
    dailyPct: number;
    weeklyPct: number;
    milestones: number[];
    hitMilestones: number[];
    currentMilestone: number | null;
    nextMilestone: number | null;
  };
  route: {
    planned: number;
    done: number;
    remaining: number;
    coveragePct: number;
    onTrack: boolean;
    stops: SalesHomeStop[];
    next: SalesHomeStop | null;
  };
  attendance: {
    punchedIn: boolean;
    activeVisit: { id: string; retailerId: string; retailerName: string | null } | null;
  };
  badges: { notifications: number };
}

export interface StockHubItem {
  productId: string;
  name: string;
  category: string;
  sapMaterialId: string | null;
  variants: Array<{ id: string; unitSize: string; unitsPerCase: number }>;
  availability: {
    available: number | null;
    warehouseCode: string;
    status: string;
    syncedAt: string | null;
  };
}

export interface StockHubPayload {
  warehouseCode: string;
  stockTakeAvailable: boolean;
  items: StockHubItem[];
}
