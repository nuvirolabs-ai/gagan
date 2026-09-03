import { colors } from "../theme";
import type { Tone } from "../theme";
import { PULSE_FIXTURE, SALES_14D_AXIS, SERIES_AXIS } from "../fixtures/pulse";
import { compactInr, deltaTone, formatDelta, periodChip } from "./format";
import type {
  AreaSeries,
  ColumnPoint,
  DeltaView,
  FounderPulsePayload,
  HeatCell,
  HorzBar,
  KpiTile,
  PulseSource,
  SeriesBoard,
  SeriesPeriod,
  SparkPoint,
  TodayBoard,
} from "./types";

function asTone(tone: ReturnType<typeof deltaTone>): Tone {
  return tone;
}

function delta(prefix: "D" | "W" | "M", kind: "pct" | "pp" | "abs" | "flat" | "none", value: number | null, digits = 0, invert = false): DeltaView {
  const label = periodChip(prefix, kind, value, digits);
  const tone = asTone(deltaTone(kind, value, invert));
  return { label, tone };
}

function labeledDelta(text: string, kind: "pct" | "pp" | "abs" | "flat" | "none", value: number | null, digits = 0, invert = false): DeltaView {
  if (kind === "none" || value === null) return { label: "—", tone: "muted" };
  if (kind === "flat") return { label: "flat", tone: "muted" };
  return { label: formatDelta(kind, value, digits), tone: asTone(deltaTone(kind, value, invert)) };
}

function areaFrom(values: number[], color: string, xLabels: [string, string, string], formatY?: (v: number) => string): AreaSeries {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points: SparkPoint[] = values.map((v, i) => ({ t: String(i), v }));
  return {
    points,
    minLabel: formatY ? formatY(min) : undefined,
    maxLabel: formatY ? formatY(max) : undefined,
    xLabels,
    color,
  };
}

function columnsFrom(current: number[], prior: number[]): ColumnPoint[] {
  const n = Math.max(current.length, prior.length);
  return Array.from({ length: n }, (_, i) => ({
    current: current[i] ?? 0,
    prior: prior[i] ?? 0,
  }));
}

function heatFrom(values: number[]): HeatCell[] {
  return values.map((v) => ({ v: Math.max(0, Math.min(1, v)) }));
}

function skuLabel(units: number): string {
  if (units >= 1000) return `${(units / 1000).toFixed(1).replace(/\.0$/, "")}k SKU units`;
  return `${units} SKU units`;
}

function weekdayLabel(iso: string): string {
  const date = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function presentValue(onFloor: number, headcount: number): string {
  return `${onFloor}/${headcount}`;
}

function otifKind(pp: number | null): "pp" | "flat" | "none" {
  if (pp === null) return "flat";
  return "pp";
}

function seriesForPeriod(payload: FounderPulsePayload, period: SeriesPeriod) {
  if (period === "day") {
    return {
      salesCurrent: payload.sales.dayCurrent,
      salesPrior: payload.sales.dayPrior,
      payments: payload.payments.daySeries,
      presentHeat: payload.present.heatWeek.slice(-7),
      otifCur: payload.otif.todayPct,
      otifPri: payload.otif.priorDayPct,
      salesValue: payload.sales.day,
      salesPriorValue: payload.sales.day / (1 + payload.sales.dayPct / 100),
      salesPct: payload.sales.dayPct,
      vsLabel: "vs prior day",
      sub: `today · vs prior ${compactInr(payload.sales.day / (1 + payload.sales.dayPct / 100))} · ${payload.regionLabel}`,
      presentValue: presentValue(payload.present.onFloor, payload.present.headcount),
      paymentsValue: compactInr(payload.payments.day),
      otifValue: `${payload.otif.todayPct}%`,
      paymentsMeta: `${compactInr(payload.payments.total14)} 14d`,
    };
  }
  if (period === "month") {
    return {
      salesCurrent: payload.sales.monthCurrent,
      salesPrior: payload.sales.monthPrior,
      payments: payload.payments.monthSeries,
      presentHeat: payload.present.heatMonth,
      otifCur: payload.otif.monthPct,
      otifPri: payload.otif.priorMonthPct,
      salesValue: payload.sales.month,
      salesPriorValue: payload.sales.priorMonth,
      salesPct: payload.sales.monthPct,
      vsLabel: "vs prior month",
      sub: `30d · vs prior ${compactInr(payload.sales.priorMonth)} · ${payload.regionLabel}`,
      presentValue: `avg ${payload.present.weekAvg}/${payload.present.headcount}`,
      paymentsValue: compactInr(payload.payments.month),
      otifValue: `${payload.otif.monthPct}% mo`,
      paymentsMeta: `${compactInr(payload.payments.total14)} 14d`,
    };
  }
  return {
    salesCurrent: payload.sales.weekCurrent,
    salesPrior: payload.sales.weekPrior,
    payments: payload.payments.weekSeries,
    presentHeat: payload.present.heatWeek,
    otifCur: payload.otif.weekPct,
    otifPri: payload.otif.priorWeekPct,
    salesValue: payload.sales.week,
    salesPriorValue: payload.sales.priorWeek,
    salesPct: payload.sales.weekPct,
    vsLabel: "vs prior week",
    sub: `7d · vs prior ${compactInr(payload.sales.priorWeek)} · ${payload.regionLabel}`,
    presentValue: `avg ${payload.present.weekAvg}/${payload.present.headcount}`,
    paymentsValue: compactInr(payload.payments.week),
    otifValue: `${payload.otif.weekPct}% wk`,
    paymentsMeta: `${compactInr(payload.payments.total14)} 14d`,
  };
}

export function mapTodayBoard(payload: FounderPulsePayload, source: PulseSource): TodayBoard {
  const presentTitle = "Present · LIVE";
  const present: KpiTile = {
    id: "present",
    title: presentTitle,
    live: true,
    value: presentValue(payload.present.onFloor, payload.present.headcount),
    day: delta("D", "abs", payload.present.dayAbs),
    week: delta("W", "abs", payload.present.weekAbs),
    month: delta("M", "none", payload.present.monthAbs),
    spark: {
      kind: "area",
      series: areaFrom(payload.present.series14, colors.present, SALES_14D_AXIS),
    },
  };

  const otif: KpiTile = {
    id: "otif",
    title: "Delivery · OTIF",
    value: `${payload.otif.todayPct}%`,
    sub: `${payload.otif.pending} pending`,
    day: delta("D", "pp", payload.otif.dayPp),
    week: delta("W", otifKind(payload.otif.weekPp), payload.otif.weekPp),
    month: delta("M", "pp", payload.otif.monthPp),
    spark: {
      kind: "area",
      series: areaFrom(payload.otif.series14, colors.up, SALES_14D_AXIS),
    },
  };

  const payments: KpiTile = {
    id: "payments",
    title: "Payments In",
    value: compactInr(payload.payments.total14),
    day: delta("D", "pct", payload.payments.dayPct),
    week: delta("W", "pct", payload.payments.weekPct),
    month: delta("M", "pct", payload.payments.monthPct),
    spark: {
      kind: "area",
      series: areaFrom(payload.payments.series14, colors.pay, SALES_14D_AXIS),
    },
  };

  const inventory: KpiTile = {
    id: "inventory",
    title: "Inventory",
    value: compactInr(payload.inventory.value),
    sub: skuLabel(payload.inventory.skuUnits),
    day: delta("D", "none", payload.inventory.dayPct),
    week: delta("W", "pct", payload.inventory.weekPct),
    month: delta("M", "pct", payload.inventory.monthPct),
    spark: {
      kind: "area",
      series: areaFrom(payload.inventory.series14, colors.stock, SALES_14D_AXIS),
    },
  };

  const salesSeries = areaFrom(payload.sales.series14, colors.up, SALES_14D_AXIS, compactInr);

  return {
    brand: "Gagan · Founders",
    title: "Today",
    viewerName: payload.viewerName,
    hub: payload.hub,
    asOfLabel: `${weekdayLabel(payload.asOf)} · live`,
    health: payload.health,
    salesHero: {
      title: "Total sales · 14d",
      value: compactInr(payload.sales.total14),
      sub: `${payload.regionLabel} · vs prior ${compactInr(payload.sales.prior14)}`,
      day: { label: `Day (${formatDelta("pct", payload.sales.dayPct, 1)})`, tone: asTone(deltaTone("pct", payload.sales.dayPct)) },
      week: { label: `Week (${formatDelta("pct", payload.sales.weekPct, 1)})`, tone: asTone(deltaTone("pct", payload.sales.weekPct)) },
      month: { label: `Month (${formatDelta("pct", payload.sales.monthPct, 1)})`, tone: asTone(deltaTone("pct", payload.sales.monthPct)) },
      series: salesSeries,
    },
    tiles: [present, otif, payments, inventory],
    periodTitle: "Period · five KPIs",
    period: [
      {
        id: "present",
        name: "Present",
        today: { text: presentValue(payload.present.onFloor, payload.present.headcount), tone: "muted" },
        week: { text: `avg ${payload.present.weekAvg}`, tone: "up" },
        month: {
          text: payload.present.monthPct != null ? `${payload.present.monthPct}%` : "—",
          tone: "muted",
        },
      },
      {
        id: "sales",
        name: "Sales",
        today: { text: compactInr(payload.sales.day), tone: "muted" },
        week: { text: compactInr(payload.sales.week), tone: "up" },
        month: { text: compactInr(payload.sales.month), tone: "up" },
      },
      {
        id: "otif",
        name: "Delivery",
        today: { text: `${payload.otif.todayPct}%`, tone: "muted" },
        week: { text: `${payload.otif.weekPct}%`, tone: "muted" },
        month: { text: `${payload.otif.monthPct}%`, tone: "down" },
      },
      {
        id: "payments",
        name: "Payments",
        today: { text: compactInr(payload.payments.day), tone: "muted" },
        week: { text: compactInr(payload.payments.week), tone: "up" },
        month: { text: compactInr(payload.payments.month), tone: "up" },
      },
      {
        id: "inventory",
        name: "Inventory",
        today: { text: compactInr(payload.inventory.value), tone: "muted" },
        week: { text: formatDelta("pct", payload.inventory.weekPct), tone: "down" },
        month: { text: formatDelta("pct", payload.inventory.monthPct), tone: "up" },
      },
    ],
    needsYou: payload.needsYou,
    readout: payload.readoutToday,
    source,
    stagingGaps: payload.stagingGaps ?? [],
  };
}

function otifBar(cur: number, pri: number): HorzBar {
  return {
    current: cur,
    prior: pri,
    currentLabel: `${Math.round(cur)}`,
    priorLabel: `${Math.round(pri)}`,
  };
}

function inventoryBar(payload: FounderPulsePayload): HorzBar {
  const scale = Math.max(payload.inventory.value, payload.inventory.priorWeek);
  return {
    current: payload.inventory.value / scale,
    prior: payload.inventory.priorWeek / scale,
    currentLabel: compactInr(payload.inventory.value).replace("₹", ""),
    priorLabel: compactInr(payload.inventory.priorWeek).replace("₹", ""),
  };
}

export function mapSeriesBoard(payload: FounderPulsePayload, period: SeriesPeriod, source: PulseSource): SeriesBoard {
  const slice = seriesForPeriod(payload, period);
  const axis = SERIES_AXIS[period];
  const otifTone: Tone = slice.otifCur < slice.otifPri ? "warn" : slice.otifCur > slice.otifPri ? "up" : "muted";
  const present: KpiTile = {
    id: "present",
    title: "Present · Series",
    value: slice.presentValue,
    day: delta("D", "abs", payload.present.dayAbs),
    week: delta("W", "abs", payload.present.weekAbs),
    month: delta("M", "none", payload.present.monthAbs),
    spark: { kind: "heat", cells: heatFrom(slice.presentHeat), color: colors.present },
  };
  const otif: KpiTile = {
    id: "otif",
    title: "Delivery · OTIF",
    value: slice.otifValue,
    day: delta("D", "pp", payload.otif.dayPp),
    week: delta("W", otifKind(payload.otif.weekPp), payload.otif.weekPp),
    month: delta("M", "pp", payload.otif.monthPp),
    spark: { kind: "bars", bar: otifBar(slice.otifCur, slice.otifPri), color: colors.up },
    footer:
      period === "week"
        ? `${payload.otif.todayPct}% today · flat vs prior`
        : period === "month"
          ? `${payload.otif.todayPct}% today · ${payload.otif.monthPp}pp vs prior`
          : `${payload.otif.todayPct}% now · ${formatDelta("pp", payload.otif.dayPp)} vs prior`,
    footerTone: period === "week" ? "muted" : payload.otif.monthPp < 0 && period === "month" ? "down" : "up",
  };
  const payments: KpiTile = {
    id: "payments",
    title: "Payments · Series",
    value: slice.paymentsValue,
    day: delta("D", "pct", payload.payments.dayPct),
    week: delta("W", "pct", payload.payments.weekPct),
    month: delta("M", "pct", payload.payments.monthPct),
    spark: {
      kind: "columns",
      columns: columnsFrom(slice.payments, slice.payments.map((v) => v * 0.92)),
      color: colors.pay,
    },
    footer: slice.paymentsMeta,
  };
  const inventory: KpiTile = {
    id: "inventory",
    title: "Inventory · Series",
    value: compactInr(payload.inventory.value),
    day: delta("D", "none", payload.inventory.dayPct),
    week: delta("W", "pct", payload.inventory.weekPct),
    month: delta("M", "pct", payload.inventory.monthPct),
    spark: { kind: "bars", bar: inventoryBar(payload), color: colors.stock },
    footer: `easing ${formatDelta("pct", payload.inventory.weekPct)} vs prior`,
    footerTone: "down",
  };

  const healthLine =
    period === "week"
      ? `Week · sales ${formatDelta("pct", payload.sales.weekPct, 1)}`
      : period === "month"
        ? `Month · sales ${formatDelta("pct", payload.sales.monthPct, 1)}`
        : `Day · sales ${formatDelta("pct", payload.sales.dayPct, 1)}`;

  return {
    period,
    healthLine,
    healthTone: otifTone === "warn" || payload.health.tone === "amber" ? "amber" : payload.health.tone,
    hubNote: `OTIF soft · ${payload.hub.replace(" hub", "")}`,
    salesHero: {
      value: compactInr(slice.salesValue),
      growth: labeledDelta(formatDelta("pct", slice.salesPct, 1), "pct", slice.salesPct, 1),
      vsLabel: slice.vsLabel,
      sub: slice.sub,
      columns: columnsFrom(slice.salesCurrent, slice.salesPrior),
      xLabels: axis,
      heat: heatFrom(slice.salesCurrent.map((v) => v / Math.max(...slice.salesCurrent))),
    },
    tiles: [present, otif, payments, inventory],
    vsPriorTitle: `Vs prior ${period} · five KPIs`,
    vsPrior: [
      {
        id: "sales",
        name: "Sales",
        delta: labeledDelta("", "pct", payload.sales[period === "day" ? "dayPct" : period === "month" ? "monthPct" : "weekPct"], 1),
        spark: { kind: "area", series: areaFrom(slice.salesCurrent, colors.up, axis) },
      },
      {
        id: "present",
        name: "Present",
        delta: labeledDelta("", "abs", payload.present.weekAbs),
        spark: { kind: "heat", cells: heatFrom(slice.presentHeat.slice(0, 7)), color: colors.present },
      },
      {
        id: "otif",
        name: "OTIF",
        delta: labeledDelta("", otifKind(payload.otif.weekPp), payload.otif.weekPp),
        spark: { kind: "bars", bar: otifBar(slice.otifCur, slice.otifPri), color: colors.warn },
      },
      {
        id: "payments",
        name: "Pay",
        delta: labeledDelta("", "pct", payload.payments[period === "day" ? "dayPct" : period === "month" ? "monthPct" : "weekPct"]),
        spark: { kind: "columns", columns: columnsFrom(slice.payments.slice(-7), slice.payments.slice(-7)), color: colors.pay },
      },
      {
        id: "inventory",
        name: "Stock",
        delta: labeledDelta("", "pct", payload.inventory.weekPct),
        spark: { kind: "bars", bar: inventoryBar(payload), color: colors.stock },
      },
    ],
    readout: payload.readoutSeries[period],
    source,
  };
}

export function defaultTodayBoard(source: PulseSource = "fixture"): TodayBoard {
  return mapTodayBoard(PULSE_FIXTURE, source);
}

export function defaultSeriesBoard(period: SeriesPeriod = "week", source: PulseSource = "fixture"): SeriesBoard {
  return mapSeriesBoard(PULSE_FIXTURE, period, source);
}

export { PULSE_FIXTURE };
