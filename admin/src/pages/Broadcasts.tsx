import { useEffect, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";

interface BroadcastMessage {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "urgent";
  audience: "all_users" | "all_salespeople" | "all_retailers" | "city";
  targetCity: string | null;
  channels: string[];
  status: "draft" | "scheduled" | "sent" | "cancelled";
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  authorName: string;
  createdAt: string;
}

interface BroadcastMetrics {
  totalBroadcasts: number;
  activeBroadcasts: number;
  deliveredPushAlerts: number;
  scheduledPipeline: number;
}

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [metrics, setMetrics] = useState<BroadcastMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [composeForm, setComposeForm] = useState({
    title: "",
    body: "",
    priority: "normal" as "normal" | "urgent",
    audience: "all_retailers" as "all_users" | "all_salespeople" | "all_retailers" | "city",
    targetCity: "",
    channels: ["in_app", "push"],
    sendOption: "now" as "now" | "later",
    scheduledAt: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.broadcasts({
        status: statusFilter === "all" ? undefined : statusFilter,
        audience: audienceFilter === "all" ? undefined : audienceFilter,
        search: searchQuery.trim() || undefined,
      });
      setBroadcasts(res.broadcasts || []);
      setMetrics(res.metrics || null);
      setError(null);
    } catch (err) {
      setError(explain(err, "Failed to load broadcast communications"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [statusFilter, audienceFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadData();
  };

  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.title.trim() || !composeForm.body.trim()) {
      setError("Please provide both a broadcast title and message body.");
      return;
    }
    if (composeForm.channels.length === 0) {
      setError("Please select at least one delivery channel.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.createBroadcast({
        title: composeForm.title.trim(),
        body: composeForm.body.trim(),
        priority: composeForm.priority,
        audience: composeForm.audience,
        targetCity: composeForm.audience === "city" ? composeForm.targetCity.trim() : null,
        channels: composeForm.channels,
        scheduledAt:
          composeForm.sendOption === "later" && composeForm.scheduledAt
            ? new Date(composeForm.scheduledAt).toISOString()
            : null,
      });

      setNotice(
        composeForm.sendOption === "later"
          ? "Broadcast scheduled successfully in delivery pipeline."
          : "Broadcast dispatched successfully across selected channels!"
      );
      setShowComposeModal(false);
      setComposeForm({
        title: "",
        body: "",
        priority: "normal",
        audience: "all_retailers",
        targetCity: "",
        channels: ["in_app", "push"],
        sendOption: "now",
        scheduledAt: "",
      });
      await loadData();
    } catch (err) {
      setError(explain(err, "Failed to dispatch broadcast"));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelBroadcast = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this broadcast?")) return;
    try {
      await api.cancelBroadcast(id);
      setNotice("Broadcast cancelled successfully.");
      await loadData();
    } catch (err) {
      setError(explain(err, "Failed to cancel broadcast"));
    }
  };

  const handleResendBroadcast = async (id: string) => {
    try {
      await api.resendBroadcast(id);
      setNotice("Broadcast re-dispatched to recipients!");
      await loadData();
    } catch (err) {
      setError(explain(err, "Failed to re-dispatch broadcast"));
    }
  };

  const toggleChannel = (ch: string) => {
    setComposeForm((prev) => {
      const exists = prev.channels.includes(ch);
      return {
        ...prev,
        channels: exists ? prev.channels.filter((c) => c !== ch) : [...prev.channels, ch],
      };
    });
  };

  return (
    <div style={{ maxWidth: 1200, paddingBottom: 60 }}>
      {/* Top Header */}
      <div className="between" style={{ marginBottom: 18, alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Notification & Broadcast Center</h1>
          <p className="page-sub" style={{ margin: "4px 0 0" }}>
            Compose, target, and dispatch price alerts, trade schemes, and operational advisories across mobile push, in-app banners, and SMS.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary" onClick={() => void loadData()} disabled={loading}>
            Refresh
          </button>
          <button
            className="primary"
            style={{ background: "#2563eb", borderColor: "#2563eb", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setShowComposeModal(true)}
          >
            <span>📢</span> Compose Broadcast
          </button>
        </div>
      </div>

      {notice && (
        <div className="banner success" style={{ marginBottom: 16 }}>
          {notice}
          <button className="ghost" style={{ float: "right", padding: 0 }} onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="banner error" style={{ marginBottom: 16 }}>
          {error}
          <button className="ghost" style={{ float: "right", padding: 0 }} onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 18, borderLeft: "4px solid #2563eb" }}>
          <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            Total Broadcasts
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginTop: 4 }}>
            {metrics?.totalBroadcasts ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Historical message broadcasts
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #059669" }}>
          <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            Active Announcements
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#059669", marginTop: 4 }}>
            {metrics?.activeBroadcasts ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Live in apps or scheduled
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #d97706" }}>
          <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            Delivered Push Alerts
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706", marginTop: 4 }}>
            {metrics?.deliveredPushAlerts ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Push notifications triggered
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: "4px solid #7c3aed" }}>
          <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            Scheduled Pipeline
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>
            {metrics?.scheduledPipeline ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Queued for automated dispatch
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: "14px 18px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>
            Status:
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "all", label: "All Status" },
              { id: "sent", label: "Sent" },
              { id: "scheduled", label: "Scheduled" },
              { id: "cancelled", label: "Cancelled" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                className={statusFilter === st.id ? "primary" : "secondary"}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  ...(statusFilter === st.id ? { background: "#2563eb", borderColor: "#2563eb" } : {}),
                }}
                onClick={() => setStatusFilter(st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>Audience:</span>
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              style={{ padding: "4px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #d1d5db" }}
            >
              <option value="all">All Audiences</option>
              <option value="all_retailers">All Retailers</option>
              <option value="all_salespeople">All Salespeople</option>
              <option value="all_users">All Users</option>
              <option value="city">City-Specific</option>
            </select>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="search"
            placeholder="Search broadcasts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: "6px 12px", fontSize: 13, width: 220, borderRadius: 6, border: "1px solid #d1d5db" }}
          />
          <button type="submit" className="secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
            Search
          </button>
        </form>
      </div>

      {/* Broadcasts Outbox Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
            Broadcast Outbox & Delivery Manifest ({broadcasts.length})
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
            Real-time delivery status, targeted segment, and channel reach for outgoing communications.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>Loading broadcasts...</div>
        ) : broadcasts.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
            No broadcasts match the selected filter. Click "+ Compose Broadcast" to create one.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                    Broadcast / Announcement
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                    Priority
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                    Target Audience
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                    Channels
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                    Recipients
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase" }}>
                    Status & Date
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, color: "#4b5563", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((b) => {
                  const isUrgent = b.priority === "urgent";
                  const audienceLabel =
                    b.audience === "all_retailers"
                      ? "🏪 All Retailers"
                      : b.audience === "all_salespeople"
                      ? "👔 All Salespeople"
                      : b.audience === "city"
                      ? `📍 City: ${b.targetCity || "Indore"}`
                      : "👥 All Users";

                  return (
                    <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "14px 16px", maxWidth: 360 }}>
                        <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>
                          {b.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#4b5563",
                            marginTop: 4,
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {b.body}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                          Author: {b.authorName}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            background: isUrgent ? "#fef2f2" : "#eff6ff",
                            color: isUrgent ? "#b91c1c" : "#1d4ed8",
                            border: `1px solid ${isUrgent ? "#fecaca" : "#bfdbfe"}`,
                          }}
                        >
                          {isUrgent ? "🔥 URGENT" : "ℹ️ NORMAL"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600, color: "#374151" }}>{audienceLabel}</div>
                      </td>

                      <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {b.channels.map((ch) => (
                            <span
                              key={ch}
                              style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background:
                                  ch === "push" ? "#fdf2f8" : ch === "sms" ? "#fef3c7" : "#e0e7ff",
                                color:
                                  ch === "push" ? "#be185d" : ch === "sms" ? "#b45309" : "#4338ca",
                              }}
                            >
                              {ch === "in_app" ? "In-App" : ch.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>
                          {b.recipientCount}
                        </div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>accounts targeted</div>
                      </td>

                      <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              b.status === "sent"
                                ? "#ecfdf5"
                                : b.status === "scheduled"
                                ? "#fef3c7"
                                : "#f3f4f6",
                            color:
                              b.status === "sent"
                                ? "#065f46"
                                : b.status === "scheduled"
                                ? "#92400e"
                                : "#6b7280",
                          }}
                        >
                          {b.status.toUpperCase()}
                        </span>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                          {b.sentAt
                            ? new Date(b.sentAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : b.scheduledAt
                            ? `Scheduled: ${new Date(b.scheduledAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "Draft"}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "right", verticalAlign: "top" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {b.status === "sent" && (
                            <button
                              className="ghost"
                              style={{ fontSize: 11, padding: "3px 8px" }}
                              onClick={() => void handleResendBroadcast(b.id)}
                            >
                              Resend
                            </button>
                          )}
                          {(b.status === "sent" || b.status === "scheduled") && (
                            <button
                              className="ghost"
                              style={{ fontSize: 11, padding: "3px 8px", color: "#b91c1c" }}
                              onClick={() => void handleCancelBroadcast(b.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compose Broadcast Modal */}
      {showComposeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div className="between" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                Compose Broadcast Announcement
              </h2>
              <button
                className="ghost"
                style={{ fontSize: 16, padding: "2px 8px" }}
                onClick={() => setShowComposeModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleComposeSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Broadcast Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Trade Scheme / Festive Dispatch Advisory"
                  value={composeForm.title}
                  onChange={(e) => setComposeForm({ ...composeForm, title: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Message Content *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write message copy that will be delivered to field apps and mobile notifications..."
                  value={composeForm.body}
                  onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Priority Level
                  </label>
                  <select
                    value={composeForm.priority}
                    onChange={(e) => setComposeForm({ ...composeForm, priority: e.target.value as any })}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                  >
                    <option value="normal">Normal (Standard Alert)</option>
                    <option value="urgent">Urgent (High Priority / Push Banner)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Target Audience
                  </label>
                  <select
                    value={composeForm.audience}
                    onChange={(e) => setComposeForm({ ...composeForm, audience: e.target.value as any })}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                  >
                    <option value="all_retailers">All Retailers (Wholesale Stores)</option>
                    <option value="all_salespeople">All Salespeople (Field Force)</option>
                    <option value="all_users">All Users (Retailers + Staff)</option>
                    <option value="city">Specific City Hub</option>
                  </select>
                </div>
              </div>

              {composeForm.audience === "city" && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Target Destination City
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indore, Ujjain, Dewas, Bhopal"
                    value={composeForm.targetCity}
                    onChange={(e) => setComposeForm({ ...composeForm, targetCity: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Delivery Channels (Select All Applicable)
                </label>
                <div style={{ display: "flex", gap: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={composeForm.channels.includes("in_app")}
                      onChange={() => toggleChannel("in_app")}
                    />
                    In-App Notification
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={composeForm.channels.includes("push")}
                      onChange={() => toggleChannel("push")}
                    />
                    Mobile Push Alert
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={composeForm.channels.includes("sms")}
                      onChange={() => toggleChannel("sms")}
                    />
                    SMS Gateway
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 20, padding: 12, background: "#f9fafb", borderRadius: 8 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Dispatch Schedule
                </label>
                <div style={{ display: "flex", gap: 16, marginBottom: composeForm.sendOption === "later" ? 10 : 0 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="sendOption"
                      checked={composeForm.sendOption === "now"}
                      onChange={() => setComposeForm({ ...composeForm, sendOption: "now" })}
                    />
                    Dispatch Immediately
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="sendOption"
                      checked={composeForm.sendOption === "later"}
                      onChange={() => setComposeForm({ ...composeForm, sendOption: "later" })}
                    />
                    Schedule for Later
                  </label>
                </div>

                {composeForm.sendOption === "later" && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="datetime-local"
                      required
                      value={composeForm.scheduledAt}
                      onChange={(e) => setComposeForm({ ...composeForm, scheduledAt: e.target.value })}
                      style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                    />
                  </div>
                )}
              </div>

              <div className="between" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowComposeModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  style={{ background: "#2563eb", borderColor: "#2563eb" }}
                  disabled={busy}
                >
                  {busy ? "Broadcasting..." : composeForm.sendOption === "later" ? "Queue Broadcast" : "Dispatch Broadcast Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
