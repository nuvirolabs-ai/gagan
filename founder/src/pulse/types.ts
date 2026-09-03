import type { Tone } from "../theme";

export type SeriesPeriod = "day" | "week" | "month";
export type HealthTone = "ok" | "amber" | "crit";
export type KpiId = "sales" | "present" | "otif" | "payments" | "inventory";
export type SparkKind = "area" | "heat" | "columns" | "bars";
export type PulseSource = "live" | "fixture";

export type DeltaView = {
  label: string;
  tone: Tone;
};

export type SparkPoint = {
  t: string;
  v: number;
};

export type AreaSeries = {
  points: SparkPoint[];
  minLabel?: string;
  maxLabel?: string;
  xLabels: [string, string, string];
  color: string;
};

export type ColumnPoint = {
  current: number;
  prior: number;
};

export type HeatCell = {
  v: number;
};

export type HorzBar = {
  current: number;
  prior: number;
  currentLabel: string;
  priorLabel: string;
};

export type TileSpark =
  | { kind: "area"; series: AreaSeries }
  | { kind: "heat"; cells: HeatCell[]; color: string }
  | { kind: "columns"; columns: ColumnPoint[]; color: string }
  | { kind: "bars"; bar: HorzBar; color: string };

export type KpiTile = {
  id: KpiId;
  title: string;
  live?: boolean;
  value: string;
  sub?: string;
  day: DeltaView;
  week: DeltaView;
  month: DeltaView;
  spark: TileSpark;
  footer?: string;
  footerTone?: Tone;
};

export type PeriodCell = {
  text: string;
  tone: Tone;
};

export type PeriodRow = {
  id: KpiId;
  name: string;
  today: PeriodCell;
  week: PeriodCell;
  month: PeriodCell;
};

export type NeedItem = {
  kind: "decide" | "crit";
  title: string;
  value: string;
  meta: string;
};

export type TodayBoard = {
  brand: string;
  title: string;
  viewerName: string;
  hub: string;
  asOfLabel: string;
  health: {
    tone: HealthTone;
    label: string;
    detail: string;
  };
  salesHero: {
    title: string;
    value: string;
    sub: string;
    day: DeltaView;
    week: DeltaView;
    month: DeltaView;
    series: AreaSeries;
  };
  tiles: [KpiTile, KpiTile, KpiTile, KpiTile];
  periodTitle: string;
  period: PeriodRow[];
  needsYou: NeedItem[];
  readout: string;
  source: PulseSource;
};

export type VsPriorChip = {
  id: KpiId;
  name: string;
  delta: DeltaView;
  spark: TileSpark;
};

export type SeriesBoard = {
  period: SeriesPeriod;
  healthLine: string;
  healthTone: HealthTone;
  hubNote: string;
  salesHero: {
    value: string;
    growth: DeltaView;
    vsLabel: string;
    sub: string;
    columns: ColumnPoint[];
    xLabels: [string, string, string];
    heat: HeatCell[];
  };
  tiles: [KpiTile, KpiTile, KpiTile, KpiTile];
  vsPriorTitle: string;
  vsPrior: VsPriorChip[];
  readout: string;
  source: PulseSource;
};

/**
 * Wire shape for GET /founder/pulse.
 * BACKEND TODO: this aggregate is not on the API yet. When it lands, return this
 * payload (or a compatible superset) and the client will drop the fixture.
 */
export type FounderPulsePayload = {
  asOf: string;
  viewerName: string;
  hub: string;
  regionLabel: string;
  health: {
    tone: HealthTone;
    label: string;
    detail: string;
  };
  present: {
    onFloor: number;
    headcount: number;
    dayAbs: number | null;
    weekAbs: number | null;
    monthAbs: number | null;
    weekAvg: number;
    series14: number[];
    heatWeek: number[];
    heatMonth: number[];
  };
  sales: {
    total14: number;
    prior14: number;
    day: number;
    week: number;
    priorWeek: number;
    month: number;
    priorMonth: number;
    dayPct: number;
    weekPct: number;
    monthPct: number;
    series14: number[];
    weekCurrent: number[];
    weekPrior: number[];
    monthCurrent: number[];
    monthPrior: number[];
    dayCurrent: number[];
    dayPrior: number[];
  };
  otif: {
    todayPct: number;
    weekPct: number;
    monthPct: number;
    priorDayPct: number;
    priorWeekPct: number;
    priorMonthPct: number;
    dayPp: number;
    weekPp: number | null;
    monthPp: number;
    pending: number;
    series14: number[];
  };
  payments: {
    total14: number;
    day: number;
    week: number;
    month: number;
    dayPct: number;
    weekPct: number;
    monthPct: number;
    series14: number[];
    weekSeries: number[];
    monthSeries: number[];
    daySeries: number[];
  };
  inventory: {
    value: number;
    priorWeek: number;
    skuUnits: number;
    dayPct: number | null;
    weekPct: number;
    monthPct: number;
    series14: number[];
  };
  needsYou: NeedItem[];
  readoutToday: string;
  readoutSeries: Record<SeriesPeriod, string>;
};
