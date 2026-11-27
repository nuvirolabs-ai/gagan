import { useEffect, useState, type ReactNode } from "react";
import { api, inr } from "../api";
import { proposalIntentSourceLabel } from "../orderAttribution";

export type AadhaarPhotoMeta = {
  available?: boolean;
  signedUrl?: string | null;
  contentType?: string;
  sizeBytes?: number;
} | null | undefined;

export function AadhaarPhotoPreview({
  label,
  alt,
  photo,
  onZoom,
}: {
  label: string;
  alt: string;
  photo: AadhaarPhotoMeta;
  onZoom: (src: string, title: string) => void;
}) {
  const rawUrl = photo?.signedUrl ?? null;
  const isDirect = Boolean(rawUrl && /^(https?:|data:|blob:)/i.test(rawUrl));
  const isApiProxy = Boolean(rawUrl && rawUrl.startsWith("/"));

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(isDirect ? rawUrl : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!rawUrl) {
      setResolvedSrc(null);
      return;
    }
    if (isDirect) {
      setResolvedSrc(rawUrl);
      return;
    }
    if (!isApiProxy || typeof api.retailerProposalPhoto !== "function") {
      setResolvedSrc(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .retailerProposalPhoto(rawUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedSrc(null);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [rawUrl, isDirect, isApiProxy]);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", marginBottom: 4 }}>
        {label}
      </div>
      {resolvedSrc && !failed ? (
        <button
          type="button"
          onClick={() => onZoom(resolvedSrc, alt)}
          title="Click to enlarge Aadhaar photo"
          style={{
            padding: 0,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "#fff",
            cursor: "zoom-in",
            overflow: "hidden",
            display: "block",
          }}
        >
          <img
            src={resolvedSrc}
            alt={alt}
            onError={() => setFailed(true)}
            style={{
              display: "block",
              maxWidth: 200,
              maxHeight: 130,
              objectFit: "contain",
            }}
          />
        </button>
      ) : (
        <div
          className="small muted"
          style={{
            padding: "10px 12px",
            border: "1px dashed var(--border)",
            borderRadius: 6,
            maxWidth: 220,
            background: "#f8fafc",
          }}
        >
          {photo && (photo.available === false || failed || rawUrl?.startsWith("local-storage://"))
            ? "Photo file not available on server (earlier upload cleared on restart)"
            : "Photo unavailable"}
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 2 }}>
      <strong>{label}:</strong>{" "}
      <span>{value !== null && value !== undefined && String(value).trim() ? value : "—"}</span>
    </div>
  );
}

const CREDIT_STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  verified: { label: "Credit Verified", bg: "#dcfce7", color: "#166534" },
  flagged: { label: "Flagged by Credit", bg: "#fee2e2", color: "#991b1b" },
  pending: { label: "Pending Credit Review", bg: "#fef3c7", color: "#92400e" },
};

export function BilingualProposalReview({
  proposal,
  onZoom,
  headerActions,
  creditActionSlot,
}: {
  proposal: any;
  onZoom: (src: string, title: string) => void;
  headerActions?: ReactNode;
  creditActionSlot?: ReactNode;
}) {
  const hiSnap = (proposal.hindiSnapshot && typeof proposal.hindiSnapshot === "object"
    ? proposal.hindiSnapshot
    : {}) as Record<string, string | null>;

  const salesmanName = proposal.submittedBy?.name ?? "Field Sales";
  const salesmanPhone = proposal.submittedBy?.phone ?? proposal.phone;
  const salesmanHi = hiSnap.salesmanNameHi || salesmanName;

  const enTitleParts = [proposal.businessName, proposal.addressLine2, proposal.deliveryCity].filter(Boolean);
  const hiTitleParts = [
    proposal.businessNameHi || proposal.businessName,
    proposal.addressLine2Hi || proposal.addressLine2,
    proposal.deliveryCityHi || proposal.deliveryCity,
  ].filter(Boolean);

  const enLocationLine = [proposal.pinCode, proposal.tehsil, proposal.district, proposal.state]
    .filter(Boolean)
    .join(" · ");
  const hiLocationLine = [
    proposal.pinCode,
    proposal.tehsilHi || proposal.tehsil,
    proposal.districtHi || proposal.district,
    proposal.stateHi || proposal.state,
  ]
    .filter(Boolean)
    .join(" · ");

  const references: any[] = Array.isArray(proposal.references) ? proposal.references : [];
  const creditStatusMeta =
    CREDIT_STATUS_STYLE[proposal.creditVerificationStatus || "pending"] ?? CREDIT_STATUS_STYLE.pending;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      {/* Header matching side-by-side bilingual layout */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          paddingBottom: 14,
          borderBottom: "1px solid var(--border, #e5e7eb)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
            flex: "1 1 560px",
          }}
        >
          <div>
            <div className="section-kicker">PROPOSAL REVIEW</div>
            <h2 style={{ margin: "2px 0 4px", fontSize: 19 }}>{enTitleParts.join(", ")}</h2>
            <div className="muted small">
              Submitted by {salesmanName}
              {salesmanPhone ? ` · ${salesmanPhone}` : ""}
            </div>
            {proposal.locationNeedsReview ? (
              <span
                className="pill"
                style={{
                  marginTop: 6,
                  display: "inline-block",
                  background: "#fef3c7",
                  color: "#92400e",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                ⚠ Custom town/tehsil added — verify spelling
              </span>
            ) : null}
          </div>

          <div>
            <div className="section-kicker">प्रस्ताव समीक्षा</div>
            <h2 style={{ margin: "2px 0 4px", fontSize: 19 }}>{hiTitleParts.join(", ")}</h2>
            <div className="muted small">
              {salesmanHi} द्वारा सबमिट किया गया
              {salesmanPhone ? ` · ${salesmanPhone}` : ""}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span
            className="pill"
            style={{
              background: creditStatusMeta.bg,
              color: creditStatusMeta.color,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {creditStatusMeta.label}
          </span>
          {headerActions}
        </div>
      </div>

      {/* Mirrored 2-column bilingual rows */}
      <div style={{ display: "grid", gap: 18, marginTop: 16 }}>
        {/* 1. BUSINESS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div>
            <div className="section-kicker">BUSINESS</div>
            <KV label="Group" value={proposal.groupName} />
            <KV label="Contact" value={proposal.ownerName} />
            <KV label="Mobile" value={proposal.phone} />
            <KV label="Telephone" value={proposal.telephone} />
            <KV label="Transporter" value={proposal.transporter} />
            <KV label="Broker" value={proposal.broker} />
          </div>
          <div>
            <div className="section-kicker">व्यवसाय</div>
            <KV label="समूह" value={hiSnap.groupNameHi || proposal.groupName} />
            <KV label="संपर्क" value={hiSnap.ownerNameHi || proposal.ownerName} />
            <KV label="मोबाइल" value={proposal.phone} />
            <KV label="टेलीफोन" value={proposal.telephone} />
            <KV label="ट्रांसपोर्टर" value={proposal.transporterHi || proposal.transporter} />
            <KV label="ब्रोकर" value={hiSnap.brokerHi || proposal.broker} />
          </div>
        </div>

        {/* 2. ADDRESS & DELIVERY */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
            alignItems: "start",
            borderTop: "1px solid #f1f5f9",
            paddingTop: 14,
          }}
        >
          <div>
            <div className="section-kicker">ADDRESS &amp; DELIVERY</div>
            <div style={{ fontSize: 13 }}>{proposal.shopAddress || "—"}</div>
            {proposal.addressLine2 ? (
              <KV label="Address - 2 / Landmark" value={proposal.addressLine2} />
            ) : null}
            {enLocationLine ? <div style={{ fontSize: 13, marginBottom: 4 }}>{enLocationLine}</div> : null}
            <KV label="Beat Name" value={proposal.beatName} />
            <KV label="Delivery city" value={proposal.deliveryCity} />
            <KV
              label="Shop duration"
              value={proposal.shopDurationYears != null ? `${proposal.shopDurationYears} years` : null}
            />
            {proposal.latitude != null && proposal.longitude != null ? (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <a
                  href={`https://maps.google.com/?q=${Number(proposal.latitude)},${Number(proposal.longitude)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Map pin: {Number(proposal.latitude).toFixed(5)}, {Number(proposal.longitude).toFixed(5)} ↗
                </a>
              </div>
            ) : null}
          </div>

          <div>
            <div className="section-kicker">पता और डिलीवरी</div>
            <div style={{ fontSize: 13 }}>{proposal.shopAddressHi || proposal.shopAddress || "—"}</div>
            {proposal.addressLine2 || proposal.addressLine2Hi ? (
              <KV
                label="पता - 2 / लैंडमार्क"
                value={proposal.addressLine2Hi || proposal.addressLine2}
              />
            ) : null}
            {hiLocationLine ? <div style={{ fontSize: 13, marginBottom: 4 }}>{hiLocationLine}</div> : null}
            <KV label="बीट का नाम" value={proposal.beatNameHi || proposal.beatName} />
            <KV label="डिलीवरी शहर" value={proposal.deliveryCityHi || proposal.deliveryCity} />
            <KV
              label="दुकान की अवधि"
              value={proposal.shopDurationYears != null ? `${proposal.shopDurationYears} वर्ष` : null}
            />
          </div>
        </div>

        {/* 3. COMMERCIAL */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
            alignItems: "start",
            borderTop: "1px solid #f1f5f9",
            paddingTop: 14,
          }}
        >
          <div>
            <div className="section-kicker">COMMERCIAL</div>
            <KV label="GSTIN" value={proposal.gstin} />
            <KV label="Payment terms" value={proposal.paymentTerms} />
            <KV
              label="Credit Limit"
              value={proposal.proposedCreditLimit != null ? inr(Number(proposal.proposedCreditLimit)) : null}
            />
            <KV label="Grade" value={proposal.grade} />
            <KV label="Buyer Category" value={proposal.buyerCategory} />
            <KV label="Buyer Sub Category" value={proposal.buyerSubCategory} />
            <KV label="UPI ID" value={proposal.upiId} />
            <KV label="Salesman" value={salesmanName} />
            <KV label="Remark" value={proposal.remark ?? proposal.notes} />
          </div>

          <div>
            <div className="section-kicker">वाणिज्यिक</div>
            <KV label="जीएसटीआईएन" value={proposal.gstin} />
            <KV label="भुगतान की शर्तें" value={hiSnap.paymentTermsHi || proposal.paymentTerms} />
            <KV
              label="क्रेडिट सीमा"
              value={proposal.proposedCreditLimit != null ? inr(Number(proposal.proposedCreditLimit)) : null}
            />
            <KV label="ग्रेड" value={hiSnap.gradeHi || proposal.grade} />
            <KV label="खरीदार श्रेणी" value={hiSnap.buyerCategoryHi || proposal.buyerCategory} />
            <KV label="खरीदार उप-श्रेणी" value={hiSnap.buyerSubCategoryHi || proposal.buyerSubCategory} />
            <KV label="यूपीआई आईडी" value={proposal.upiId} />
            <KV label="सेल्समैन" value={salesmanHi} />
            <KV label="टिप्पणी" value={hiSnap.remarkHi || proposal.remark || proposal.notes} />
          </div>
        </div>

        {/* 4. IDENTITY */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
            alignItems: "start",
            borderTop: "1px solid #f1f5f9",
            paddingTop: 14,
          }}
        >
          <div>
            <div className="section-kicker">IDENTITY</div>
            <KV label="Aadhaar" value={proposal.aadhaarNumberMasked ?? "Not supplied"} />
            <div className="small muted">
              Full Aadhaar is encrypted and is never returned to this page.
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
              <AadhaarPhotoPreview
                label="FRONT SIDE"
                alt="Aadhaar Front Side Preview"
                photo={proposal.aadhaarPhoto}
                onZoom={onZoom}
              />
              {proposal.aadhaarPhotoBack ? (
                <AadhaarPhotoPreview
                  label="BACK SIDE"
                  alt="Aadhaar Back Side Preview"
                  photo={proposal.aadhaarPhotoBack}
                  onZoom={onZoom}
                />
              ) : null}
            </div>
          </div>

          <div>
            <div className="section-kicker">पहचान</div>
            <KV label="आधार" value={proposal.aadhaarNumberMasked ?? "उपलब्ध नहीं"} />
            <div className="small muted">
              पूरा आधार एन्क्रिप्टेड है और इस पेज पर कभी वापस नहीं दिखाया जाता है।
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              सामने का भाग: {proposal.aadhaarPhoto?.available ? "उपलब्ध" : "उपलब्ध नहीं"} · पीछे का भाग:{" "}
              {proposal.aadhaarPhotoBack?.available ? "उपलब्ध" : "उपलब्ध नहीं"}
            </div>
          </div>
        </div>
      </div>

      {/* 5. VOUCHED SAME-CITY RETAILER REFERENCES */}
      <div
        style={{
          marginTop: 18,
          background: "#f8fafc",
          padding: "14px 16px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div>
            <div className="section-kicker" style={{ color: "#0f172a" }}>
              SAME-CITY RETAILER REFERENCES ({references.length}) · समान शहर के संदर्भ
            </div>
            <div className="small muted">
              Existing retailers who vouched for safe supply in {proposal.deliveryCity || "this city"}.
            </div>
          </div>
          {proposal.creditVerifiedAt ? (
            <div className="small muted">
              Reviewed by {proposal.creditVerifiedBy?.name ?? "Credit Team"} on{" "}
              {new Date(proposal.creditVerifiedAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {proposal.creditVerificationNotes ? ` — "${proposal.creditVerificationNotes}"` : ""}
            </div>
          ) : null}
        </div>

        {references.length === 0 ? (
          <div className="small muted">No retailer references recorded on this legacy request.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", background: "#fff" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px" }}>#</th>
                  <th style={{ padding: "6px 8px" }}>Vouching Retailer</th>
                  <th style={{ padding: "6px 8px" }}>Owner</th>
                  <th style={{ padding: "6px 8px" }}>Mobile</th>
                  <th style={{ padding: "6px 8px" }}>City</th>
                  <th style={{ padding: "6px 8px" }}>Type</th>
                  <th style={{ padding: "6px 8px" }}>Address / Note</th>
                </tr>
              </thead>
              <tbody>
                {references.map((ref: any, idx: number) => (
                  <tr key={ref.id ?? idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 700 }}>{idx + 1}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                      {ref.existingRetailer?.name || ref.retailerName}
                    </td>
                    <td style={{ padding: "6px 8px" }}>{ref.ownerName || "—"}</td>
                    <td style={{ padding: "6px 8px" }}>{ref.existingRetailer?.phone || ref.phone || "—"}</td>
                    <td style={{ padding: "6px 8px" }}>{ref.city}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <span
                        className="pill"
                        style={{
                          fontSize: 10.5,
                          background: ref.isExistingCustomer ? "#dcfce7" : "#e0f2fe",
                          color: ref.isExistingCustomer ? "#166534" : "#0369a1",
                        }}
                      >
                        {ref.isExistingCustomer ? "DB Customer" : "Market Ref"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", color: "#475569" }}>
                      {[ref.shopAddress, ref.notes].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {creditActionSlot ? <div style={{ marginTop: 12 }}>{creditActionSlot}</div> : null}
      </div>

      {/* 6. PUNCHED ORDER DEMAND */}
      {proposal.orderIntents?.length ? (
        <div
          style={{
            marginTop: 14,
            background: "#eff6ff",
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #bfdbfe",
          }}
        >
          <div className="section-kicker" style={{ color: "#1d4ed8" }}>
            Punched Order Demand ({proposal.orderIntents.length})
          </div>
          <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#1e3a8a" }}>
            Preliminary punched demand from the mobile field app. Approving this store automatically creates the official Warehouse Order.
          </p>
          {proposal.orderIntents.map((intent: any) => (
            <div
              key={intent.id}
              style={{
                fontSize: 12,
                padding: "6px 0",
                borderBottom: "1px dashed #bfdbfe",
              }}
            >
              <strong>{proposalIntentSourceLabel(intent)}</strong> · Punched at{" "}
              {intent.punchedAt
                ? new Date(intent.punchedAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
              {intent.items?.length ? (
                <div style={{ marginTop: 4, color: "#1e293b" }}>
                  Lines:{" "}
                  {intent.items
                    .map(
                      (i: any) =>
                        `${i.qty} case${i.qty === 1 ? "" : "s"}${
                          i.productName ? ` · ${i.productName}` : ` (SKU: ${i.variantId})`
                        }`
                    )
                    .join(", ")}
                </div>
              ) : null}
              {intent.convertedOrder ? (
                <div style={{ marginTop: 4, color: "#15803d", fontWeight: 700 }}>
                  Converted to Warehouse Order #GGN-{String(intent.convertedOrder.orderNo).padStart(8, "0")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
