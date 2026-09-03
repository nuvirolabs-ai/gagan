import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadSeriesBoard, loadTodayBoard } from "../api/founder";
import type { SeriesBoard, SeriesPeriod, TodayBoard } from "../pulse/types";

type FounderContextValue = {
  today: TodayBoard | null;
  series: SeriesBoard | null;
  seriesPeriod: SeriesPeriod;
  setSeriesPeriod: (period: SeriesPeriod) => void;
  refresh: () => Promise<void>;
  dataSource: "live" | "fixture";
  stagingGaps: string[];
};

const FounderContext = createContext<FounderContextValue | undefined>(undefined);

export function FounderProvider({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  const [today, setToday] = useState<TodayBoard | null>(null);
  const [series, setSeries] = useState<SeriesBoard | null>(null);
  const [seriesPeriod, setSeriesPeriodState] = useState<SeriesPeriod>("week");
  const [dataSource, setDataSource] = useState<"live" | "fixture">("fixture");
  const [stagingGaps, setStagingGaps] = useState<string[]>([]);

  const refresh = useCallback(async (period: SeriesPeriod = seriesPeriod) => {
    const [todayBoard, seriesBoard] = await Promise.all([loadTodayBoard(), loadSeriesBoard(period)]);
    setToday(todayBoard);
    setSeries(seriesBoard);
    setDataSource(todayBoard.source);
    setStagingGaps(todayBoard.stagingGaps ?? []);
  }, [seriesPeriod]);

  useEffect(() => {
    if (!enabled) return;
    void refresh("week");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const setSeriesPeriod = (period: SeriesPeriod) => {
    setSeriesPeriodState(period);
    void loadSeriesBoard(period).then(setSeries);
  };

  return (
    <FounderContext.Provider
      value={{
        today,
        series,
        seriesPeriod,
        setSeriesPeriod,
        refresh: () => refresh(seriesPeriod),
        dataSource,
        stagingGaps,
      }}
    >
      {children}
    </FounderContext.Provider>
  );
}

export function useFounder() {
  const ctx = useContext(FounderContext);
  if (!ctx) throw new Error("useFounder must be used within FounderProvider");
  return ctx;
}
