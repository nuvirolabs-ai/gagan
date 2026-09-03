import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ApiError,
  DEMO_OTP,
  DEMO_PHONE,
  FIXTURE_STAFF,
  FIXTURE_TOKEN,
  founderApi,
  founderSessionStore,
  isDemoOtp,
  isDemoPhone,
  loadSeriesBoard,
  loadTodayBoard,
  setFounderUnauthorizedHandler,
} from "../api/founder";
import type { SeriesBoard, SeriesPeriod, TodayBoard } from "../pulse/types";
import type { StaffIdentity } from "../api/founder";

type FounderContextValue = {
  staff: StaffIdentity | null;
  loading: boolean;
  today: TodayBoard | null;
  series: SeriesBoard | null;
  seriesPeriod: SeriesPeriod;
  setSeriesPeriod: (period: SeriesPeriod) => void;
  refresh: () => Promise<void>;
  requestOtp: (phone: string) => Promise<void>;
  login: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  dataSource: "live" | "fixture";
  apiBaseUrl: string;
};

const FounderContext = createContext<FounderContextValue | undefined>(undefined);

export function FounderProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<TodayBoard | null>(null);
  const [series, setSeries] = useState<SeriesBoard | null>(null);
  const [seriesPeriod, setSeriesPeriodState] = useState<SeriesPeriod>("week");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "fixture">("fixture");

  useEffect(() => {
    setFounderUnauthorizedHandler(() => setStaff(null));
    return () => setFounderUnauthorizedHandler(null);
  }, []);

  const refresh = async (period: SeriesPeriod = seriesPeriod) => {
    const [todayBoard, seriesBoard] = await Promise.all([loadTodayBoard(), loadSeriesBoard(period)]);
    setToday(todayBoard);
    setSeries(seriesBoard);
    setDataSource(todayBoard.source);
  };

  useEffect(() => {
    (async () => {
      const session = await founderSessionStore.load();
      if (!session) {
        setLoading(false);
        return;
      }
      try {
        if (session.accessToken === FIXTURE_TOKEN) {
          setStaff(FIXTURE_STAFF);
        } else {
          const res = await founderApi.me();
          setStaff(res.staff ?? FIXTURE_STAFF);
        }
        await refresh("week");
      } catch {
        await founderSessionStore.clear();
        setStaff(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSeriesPeriod = (period: SeriesPeriod) => {
    setSeriesPeriodState(period);
    void loadSeriesBoard(period).then(setSeries);
  };

  const requestOtp = async (phone: string) => {
    if (isDemoPhone(phone) || founderApi.forceFixture) {
      setChallengeId("fixture-challenge");
      return;
    }
    try {
      const result = await founderApi.requestOtp(phone);
      if (typeof result.challengeId !== "string") throw new Error("Could not start OTP challenge");
      setChallengeId(result.challengeId);
    } catch (error) {
      if (isDemoPhone(phone)) {
        setChallengeId("fixture-challenge");
        return;
      }
      throw error;
    }
  };

  const login = async (phone: string, otp: string) => {
    if ((isDemoPhone(phone) && isDemoOtp(otp)) || (founderApi.forceFixture && otp === DEMO_OTP)) {
      await founderSessionStore.save({ accessToken: FIXTURE_TOKEN, refreshToken: FIXTURE_TOKEN });
      setStaff({ ...FIXTURE_STAFF, phone: phone || DEMO_PHONE });
      setChallengeId(null);
      await refresh("week");
      return;
    }
    if (!challengeId) throw new Error("Request a new OTP first");
    try {
      const res = await founderApi.verifyOtp(challengeId, phone, otp);
      setChallengeId(null);
      setStaff(res.staff ?? { ...FIXTURE_STAFF, phone });
      await refresh("week");
    } catch (error) {
      if (isDemoOtp(otp)) {
        await founderSessionStore.save({ accessToken: FIXTURE_TOKEN, refreshToken: FIXTURE_TOKEN });
        setStaff({ ...FIXTURE_STAFF, phone });
        setChallengeId(null);
        await refresh("week");
        return;
      }
      throw error instanceof ApiError ? error : new Error("Couldn't sign in");
    }
  };

  const logout = async () => {
    try {
      await founderApi.logout();
    } finally {
      setStaff(null);
      setToday(null);
      setSeries(null);
      setChallengeId(null);
    }
  };

  return (
    <FounderContext.Provider
      value={{
        staff,
        loading,
        today,
        series,
        seriesPeriod,
        setSeriesPeriod,
        refresh: () => refresh(seriesPeriod),
        requestOtp,
        login,
        logout,
        dataSource,
        apiBaseUrl: founderApi.baseUrl,
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
