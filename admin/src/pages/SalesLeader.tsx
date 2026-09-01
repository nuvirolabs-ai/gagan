import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api";

const RISK_PILL: Record<string, string> = {
  at_risk: "rejected",
  watch: "placed",
  on_track: "confirmed",
};

const RISK_LABEL: Record<string, string> = {
  at_risk: "At risk",
  watch: "Watch",
  on_track: "On track",
};

function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${value}%`;
}

/**
 * The sales leader's view: who is ahead, who is behind, why, and what to do.
 *
 * Every projection is run rate — the pace so far extended across the days that
 * remain — and is labelled as such. Nothing here says a salesperson will land
 * anywhere, because arithmetic on a pace is not a forecast.
 */
export default function SalesLeader() {
  const [data, setData] = useState<any | null>(null);
  const [tab, setTab] = useState<"team" | "leaderboard" | "actions">("team");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.salesLeader());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the sales dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const team = data?.team;
  const atRisk = (data?.members ?? []).filter((member: any) => member.risk.level === "at_risk");
  const improving = (data?.members ?? []).filter(
    (member: any) => member.risk.level === "on_track" && (member.headlineTarget?.completionPct ?? 0) > 0
  );

  return (
    <div>
      <h1 className="page-title">Sales leader</h1>
      <p className="page-sub">
        Your team — everyone who reports to you, at any depth — measured against target, and where
        the period is heading at the current pace.
      </p>
      {error && <div className="banner error">{error}</div>}

      {loading ? (
        <div className="card empty-state">Loading…</div>
      ) : !team || team.salespeople === 0 ? (
        <div className="card empty-state">
          Nobody reports to you yet. Reporting lines are set in Sales organisation.
        </div>
      ) : (
        <>
          <div className="metrics">
            <div className="metric">
              <div className="metric-label">
                {data.targets?.assigned != null ? "Your target" : "Team target"}
              </div>
              <div className="metric-value">{inr(team.target)}</div>
              {data.targets?.assigned != null ? (
                <div className="small muted">
                  {inr(data.targets.rollup)} cascaded to the team
                  {data.targets.uncascaded > 0 ? ` · ${inr(data.targets.uncascaded)} not yet set` : ""}
                </div>
              ) : (
                <div className="small muted">Sum of the team's individual targets</div>
              )}
            </div>
            <div className="metric">
              <div className="metric-label">Achieved</div>
              <div className="metric-value">
                {inr(team.actual)} <span className="small muted">({pct(team.completionPct)})</span>
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">{data.team.projection.label}</div>
              <div className="metric-value">
                {team.projection.projected == null ? "—" : inr(team.projection.projected)}
              </div>
              <div className="small muted">
                {team.projection.unavailableReason ??
                  `${pct(team.risk.projectedAchievementPct)} of target · ${team.projection.perDay != null ? `${inr(team.projection.perDay)}/day` : ""}`}
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">Selling days</div>
              <div className="metric-value">
                {data.sellingDays.elapsed}/{data.sellingDays.total}
              </div>
              <div className="small muted">{data.sellingDays.remaining} left</div>
            </div>
          </div>

          <div className="metrics">
            <div className="metric">
              <div className="metric-label">Present today</div>
              <div className="metric-value">
                {team.present}/{team.salespeople}
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">Visits</div>
              <div className="metric-value">{team.visits}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Productive outlets</div>
              <div className="metric-value">{team.productiveOutlets}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Orders</div>
              <div className="metric-value">{team.orders}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Collections</div>
              <div className="metric-value">{inr(team.collections)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">New retailers</div>
              <div className="metric-value">{team.newRetailers}</div>
            </div>
          </div>

          <div className="tabs">
            <button className={`tab ${tab === "team" ? "active" : ""}`} onClick={() => setTab("team")}>
              Team
            </button>
            <button
              className={`tab ${tab === "leaderboard" ? "active" : ""}`}
              onClick={() => setTab("leaderboard")}
            >
              Leaderboard
            </button>
            <button
              className={`tab ${tab === "actions" ? "active" : ""}`}
              onClick={() => setTab("actions")}
            >
              Recommended actions
              {data.recommendedActions.length ? ` (${data.recommendedActions.length})` : ""}
            </button>
          </div>

          {tab === "team" ? (
            <>
              {atRisk.length > 0 ? (
                <div className="card">
                  <h2 className="section-title">At risk ({atRisk.length})</h2>
                  <p className="section-copy">
                    Projected below target at the current run rate. Each reason is a measurement,
                    not an opinion.
                  </p>
                  <ul className="reason-list">
                    {atRisk.map((member: any) => (
                      <li key={member.salespersonId}>
                        <strong>{member.name}</strong> — {member.risk.reasons.join(" ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Salesperson</th>
                      <th>Rank</th>
                      <th>Attendance</th>
                      <th>Target</th>
                      <th>Achieved</th>
                      <th>Projected</th>
                      <th>Beat</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((member: any) => (
                      <tr key={member.salespersonId}>
                        <td>
                          <Link to={`/staff/${member.salespersonId}`}>{member.name}</Link>
                        </td>
                        <td>{member.rank == null ? "—" : `#${member.rank}`}</td>
                        <td>{member.attendance}</td>
                        <td>
                          {member.headlineTarget ? inr(member.headlineTarget.target) : "No target"}
                        </td>
                        <td>
                          {member.headlineTarget
                            ? `${inr(member.headlineTarget.actual)} (${member.headlineTarget.completionPct}%)`
                            : inr(member.actuals.order_value ?? 0)}
                        </td>
                        <td>
                          {member.projection.projected == null
                            ? "—"
                            : `${inr(member.projection.projected)} · ${pct(member.risk.projectedAchievementPct)}`}
                        </td>
                        <td>
                          {member.route
                            ? `${member.route.visited}/${member.route.total} · ${member.route.completionPct}%`
                            : "No route"}
                        </td>
                        <td>
                          <span className={`pill ${RISK_PILL[member.risk.level]}`}>
                            {RISK_LABEL[member.risk.level]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                {data.team.projection.label}. Improving: {improving.length} of {team.salespeople}.
              </p>
            </>
          ) : tab === "leaderboard" ? (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "16px 16px 0" }}>
                <h2 className="section-title">{data.leaderboard.metricLabel}</h2>
                <p className="section-copy">{data.leaderboard.metricReason}</p>
              </div>
              {data.leaderboard.entries.length === 0 ? (
                <div className="empty-state">Nobody to rank in this scope.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Salesperson</th>
                      <th>{data.leaderboard.metricLabel}</th>
                      <th>Previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.entries.map((entry: any) => (
                      <tr key={entry.salespersonId}>
                        <td>#{entry.rank}</td>
                        <td>{entry.name}</td>
                        <td>
                          {data.leaderboard.metric === "order_value"
                            ? inr(entry.value)
                            : `${entry.value}%`}
                        </td>
                        <td>{entry.previousRank == null ? "—" : `#${entry.previousRank}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              {data.recommendedActions.length === 0 ? (
                <div className="empty-state">Nothing needs intervention right now.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recommendedActions.map((action: any, index: number) => (
                      <tr key={`${action.type}-${action.salespersonId}-${index}`}>
                        <td>
                          <strong>{action.action}</strong>
                        </td>
                        <td className="small">{action.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
