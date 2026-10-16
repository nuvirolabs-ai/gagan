import { useEffect, useState } from "react";
import { api, inr } from "../api";
import { explain } from "../errorCopy";

interface AppConfig {
  id: string;
  freeDeliveryThreshold: number;
  minOrderValue: number;
  supportPhone: string;
  creditRolloutMode: "shadow" | "enforce";
  attendanceSelfieRequired: boolean;
  locationTrackingEnabled: boolean;
  locationPingIntervalSeconds: number;
}

export default function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.appConfig();
      setConfig(data.config);
      setError(null);
    } catch (err) {
      setError(explain(err, "Could not load global configuration"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.updateAppConfig({
        freeDeliveryThreshold: Number(config.freeDeliveryThreshold),
        minOrderValue: Number(config.minOrderValue),
        supportPhone: config.supportPhone.trim(),
        creditRolloutMode: config.creditRolloutMode,
        attendanceSelfieRequired: config.attendanceSelfieRequired,
        locationTrackingEnabled: config.locationTrackingEnabled,
        locationPingIntervalSeconds: Number(config.locationPingIntervalSeconds),
      });
      setConfig(result.config);
      setNotice("System policies and commercial thresholds updated successfully.");
    } catch (err) {
      setError(explain(err, "Could not update configuration"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="muted" style={{ padding: 22 }}>Loading business settings…</div>;
  }

  if (!config) {
    return (
      <div className="card empty-state">
        <p>Configuration could not be loaded.</p>
        <button onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="between" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Business Settings & System Policies</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Configure commercial order thresholds, customer support lines, and on-ground field policies.
          </p>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <form onSubmit={handleSave}>
        {/* Card 1: Commercial Rules */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 className="section-title">Commercial & Delivery Thresholds</h2>
          <p className="section-copy">
            These rules control customer ordering eligibility, minimum basket limits, and support contact details.
          </p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="min-order">
                Minimum Order Value (₹)
                <span className="small muted" style={{ display: "block", marginTop: 2 }}>
                  Orders below this amount cannot proceed to review or placement.
                </span>
              </label>
              <input
                id="min-order"
                type="number"
                min="0"
                step="100"
                value={config.minOrderValue}
                onChange={(e) => setConfig({ ...config, minOrderValue: Number(e.target.value) })}
                required
              />
              <span className="small muted">Formatted: {inr(config.minOrderValue)}</span>
            </div>

            <div className="field">
              <label htmlFor="free-delivery">
                Free Delivery Threshold (₹)
                <span className="small muted" style={{ display: "block", marginTop: 2 }}>
                  Baskets meeting this value qualify for waived logistics charges.
                </span>
              </label>
              <input
                id="free-delivery"
                type="number"
                min="0"
                step="100"
                value={config.freeDeliveryThreshold}
                onChange={(e) => setConfig({ ...config, freeDeliveryThreshold: Number(e.target.value) })}
                required
              />
              <span className="small muted">Formatted: {inr(config.freeDeliveryThreshold)}</span>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="support-phone">
                Customer Support & Helpdesk Phone
                <span className="small muted" style={{ display: "block", marginTop: 2 }}>
                  Displayed in mobile apps for retailer helpline and WhatsApp support.
                </span>
              </label>
              <input
                id="support-phone"
                type="tel"
                placeholder="e.g. 9812345680"
                value={config.supportPhone}
                onChange={(e) => setConfig({ ...config, supportPhone: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Field Policies */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 className="section-title">Field Sales & Workforce Policies</h2>
          <p className="section-copy">
            Device-level controls that determine how salesperson apps collect attendance and GPS telemetry.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label className="check-row" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <input
                type="checkbox"
                style={{ marginTop: 4 }}
                checked={config.attendanceSelfieRequired}
                onChange={(e) => setConfig({ ...config, attendanceSelfieRequired: e.target.checked })}
              />
              <div>
                <strong>Mandatory Attendance Photo / Selfie</strong>
                <div className="small muted">
                  When enabled, sales reps must take a live verification camera photo to clock in and clock out.
                </div>
              </div>
            </label>

            <label className="check-row" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <input
                type="checkbox"
                style={{ marginTop: 4 }}
                checked={config.locationTrackingEnabled}
                onChange={(e) => setConfig({ ...config, locationTrackingEnabled: e.target.checked })}
              />
              <div>
                <strong>Salesperson GPS Location Tracking</strong>
                <div className="small muted">
                  When enabled, rep apps record background route pings throughout open workdays.
                </div>
              </div>
            </label>

            <div className="field" style={{ maxWidth: 320, marginTop: 4 }}>
              <label htmlFor="ping-interval">GPS Location Ping Interval</label>
              <select
                id="ping-interval"
                value={config.locationPingIntervalSeconds}
                onChange={(e) => setConfig({ ...config, locationPingIntervalSeconds: Number(e.target.value) })}
              >
                <option value={60}>Every 1 minute (High Accuracy / Testing)</option>
                <option value={180}>Every 3 minutes</option>
                <option value={300}>Every 5 minutes (Recommended Balance)</option>
                <option value={600}>Every 10 minutes (Battery Saver)</option>
                <option value={900}>Every 15 minutes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Credit Policy Gate */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 className="section-title">Credit Policy & Risk Rollout Mode</h2>
          <p className="section-copy">
            System-level gate governing whether overdue balances and credit limits block checkout.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="check-row" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <input
                type="radio"
                name="creditRolloutMode"
                value="shadow"
                checked={config.creditRolloutMode === "shadow"}
                onChange={() => setConfig({ ...config, creditRolloutMode: "shadow" })}
              />
              <div>
                <strong>Shadow Mode (Monitoring Only)</strong>
                <div className="small muted">
                  Evaluates retailer credit limits and flags over-limit orders without interrupting checkout.
                </div>
              </div>
            </label>

            <label className="check-row" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <input
                type="radio"
                name="creditRolloutMode"
                value="enforce"
                checked={config.creditRolloutMode === "enforce"}
                onChange={() => setConfig({ ...config, creditRolloutMode: "enforce" })}
              />
              <div>
                <strong>Enforced Mode (Active Gate)</strong>
                <div className="small muted">
                  Strictly enforces credit limits. Orders exceeding credit limit or with past-due invoices require manager override.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving Policies…" : "Save All Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
