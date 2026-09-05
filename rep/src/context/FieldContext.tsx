import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";

import { repApi } from "../api/repClient";
import { createOutbox, type Outbox } from "../offline/outbox";
import type { OutboxSummary } from "../offline/outboxDomain";
import {
  DEFAULT_SAMPLING,
  decideSample,
  type TrackerReading,
} from "../tracking/fieldTracker";
import { useRep } from "./RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { createSingleFlight } from "../performance/singleFlight";

export interface TrackingState {
  tracking: boolean;
  reason: string;
  message: string;
  pingIntervalSeconds: number;
  workdaySessionId: string | null;
}

interface FieldContextValue {
  today: any | null;
  /**
   * Achievements earned since this session opened, kept until the salesperson
   * dismisses them. The server hands each one over exactly once, so holding
   * them here is what stops a background refresh from swallowing a celebration
   * before it has been seen.
   */
  celebrations: any[];
  dismissCelebration: (id: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  tracking: TrackingState | null;
  outbox: OutboxSummary;
  /** `retryFailed` is the explicit "Sync now" the salesperson presses. */
  flushOutbox: (options?: { retryFailed?: boolean }) => Promise<void>;

  startDay: (input: { latitude: number; longitude: number; accuracyMeters: number }) => Promise<void>;
  endDay: (input: { latitude: number; longitude: number; accuracyMeters: number; managerNote?: string }) => Promise<void>;

  /**
   * Logs a customer activity. Sends it now when there is a connection, and
   * queues it on the phone when there is not. Resolves to how it was handled so
   * the screen can say so honestly.
   */
  logActivity: (input: {
    retailerId: string;
    type: string;
    visitId?: string;
    notes?: string;
    followUpAt?: string;
  }) => Promise<"sent" | "queued">;
}

const FieldContext = createContext<FieldContextValue | undefined>(undefined);

const EMPTY_SUMMARY: OutboxSummary = { pending: 0, failed: 0, synced: 0 };

/**
 * Turns a transport failure into something a salesperson standing in a shop can
 * act on. Anything the server actually said is passed through unchanged.
 */
function offlineMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  const looksOffline =
    error instanceof TypeError ||
    /network request failed|failed to fetch|load failed/i.test(raw);
  return looksOffline
    ? "You're offline. Your day will load as soon as you have a connection."
    : raw || "Could not load your day.";
}

/** Device-unique enough to be an idempotency key for an offline replay. */
function clientReference(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function FieldProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useRep();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const enabled = capabilities.canRunFieldDay;

  const [today, setToday] = useState<any | null>(null);
  const [celebrations, setCelebrations] = useState<any[]>([]);
  const [tracking, setTracking] = useState<TrackingState | null>(null);
  const [outbox, setOutbox] = useState<OutboxSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshGate = useRef(createSingleFlight());

  const lastReading = useRef<TrackerReading | null>(null);
  const queue = useRef<Outbox | null>(null);
  if (!queue.current) {
    queue.current = createOutbox({
      senders: {
        customer_activity: (payload) => repApi.logActivity(payload),
        location_ping: (payloads) => repApi.sendPings(payloads),
      },
    });
  }

  const flushOutbox = useCallback<FieldContextValue["flushOutbox"]>(async (options) => {
    if (!queue.current) return;
    try {
      setOutbox(await queue.current.flush({ includeFailed: options?.retryFailed }));
    } catch {
      setOutbox(await queue.current.summary());
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await refreshGate.current(async () => {
      setLoading(true);
      try {
        const payload = await repApi.today();
        setToday(payload);
        setTracking(payload.tracking ?? null);
        const earned: any[] = payload.achievements?.new ?? [];
        if (earned.length > 0) {
          setCelebrations((current) => {
            const seen = new Set(current.map((event) => event.id));
            return [...current, ...earned.filter((event) => !seen.has(event.id))];
          });
        }
        setError(null);
      } catch (err) {
        // A failed refresh must not wipe the last good day the salesperson saw,
        // and a dropped connection should read like one rather than like a
        // browser error string.
        setError(offlineMessage(err));
      } finally {
        setLoading(false);
      }
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setToday(null);
      setTracking(null);
      setCelebrations([]);
      return;
    }
    void refresh();
    void flushOutbox();
  }, [enabled, refresh, flushOutbox]);

  // Coming back to the app is the moment worth spending a sync on.
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
        void flushOutbox();
      }
    });
    return () => subscription.remove();
  }, [enabled, refresh, flushOutbox]);

  /**
   * Foreground movement sampling. It only runs while the server says tracking
   * is active — which means the workday is open, the tenant allows it, and the
   * salesperson can see the banner saying so.
   */
  useEffect(() => {
    if (!enabled || !tracking?.tracking) return;
    let cancelled = false;
    const intervalMs = Math.max(60, tracking.pingIntervalSeconds) * 1000;

    const sample = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const reading: TrackerReading = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? 0,
          recordedAt: position.timestamp,
          speedMps: position.coords.speed,
          headingDegrees: position.coords.heading,
        };
        const decision = decideSample({
          reading,
          last: lastReading.current,
          policy: { ...DEFAULT_SAMPLING, intervalSeconds: tracking.pingIntervalSeconds },
        });
        if (!decision.record) return;
        lastReading.current = reading;
        await queue.current!.queuePing(clientReference("ping"), {
          recordedAt: new Date(reading.recordedAt).toISOString(),
          latitude: reading.latitude,
          longitude: reading.longitude,
          accuracyMeters: reading.accuracyMeters,
          ...(reading.speedMps != null && reading.speedMps >= 0
            ? { speedMps: reading.speedMps }
            : {}),
          ...(reading.headingDegrees != null && reading.headingDegrees >= 0
            ? { headingDegrees: reading.headingDegrees }
            : {}),
        });
        await flushOutbox();
      } catch {
        // A single missed reading is not worth telling the salesperson about;
        // the queue and the next tick recover on their own.
      }
    };

    void sample();
    const timer = setInterval(() => void sample(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, tracking?.tracking, tracking?.pingIntervalSeconds, flushOutbox]);

  const startDay = useCallback(
    async (input: { latitude: number; longitude: number; accuracyMeters: number; managerNote?: string }) => {
      await repApi.startDay({ ...input, devicePlatform: Platform.OS });
      lastReading.current = null;
      await refresh();
    },
    [refresh]
  );

  const endDay = useCallback(
    async (input: { latitude: number; longitude: number; accuracyMeters: number }) => {
      // Anything still buffered belongs to the day being closed, so it goes
      // first — after clock-out the server will not accept it.
      await flushOutbox();
      await repApi.endDay({ ...input, devicePlatform: Platform.OS });
      lastReading.current = null;
      await refresh();
    },
    [refresh, flushOutbox]
  );

  const logActivity = useCallback<FieldContextValue["logActivity"]>(
    async (input) => {
      const reference = clientReference("activity");
      try {
        await repApi.logActivity({ ...input, clientReference: reference });
        void refresh();
        return "sent";
      } catch (error) {
        const raw = error instanceof Error ? error.message : "";
        const looksOffline =
          error instanceof TypeError ||
          /network request failed|failed to fetch|load failed/i.test(raw);
        if (!looksOffline) throw error;
        setOutbox(await queue.current!.queueActivity(reference, input));
        return "queued";
      }
    },
    [refresh]
  );

  const dismissCelebration = useCallback((id: string) => {
    setCelebrations((current) => current.filter((event) => event.id !== id));
  }, []);

  const value = useMemo<FieldContextValue>(
    () => ({
      today,
      celebrations,
      dismissCelebration,
      loading,
      error,
      refresh,
      tracking,
      outbox,
      flushOutbox,
      startDay,
      endDay,
      logActivity,
    }),
    [
      today,
      celebrations,
      dismissCelebration,
      loading,
      error,
      refresh,
      tracking,
      outbox,
      flushOutbox,
      startDay,
      endDay,
      logActivity,
    ]
  );

  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>;
}

export function useField() {
  const context = useContext(FieldContext);
  if (!context) throw new Error("useField must be used within FieldProvider");
  return context;
}
