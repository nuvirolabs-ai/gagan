import { Router } from "express";

export const privacyPolicyRouter = Router();

privacyPolicyRouter.get("/privacy-policy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Gagan Retailer & Gagan Sales</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .header {
      background: #123122;
      color: #ffffff;
      padding: 32px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
      font-weight: 700;
    }
    .header p {
      margin: 0;
      color: #94a3b8;
      font-size: 14px;
    }
    .container {
      max-width: 800px;
      margin: 32px auto;
      background: #ffffff;
      padding: 36px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    h2 {
      color: #0f172a;
      font-size: 20px;
      margin-top: 28px;
      margin-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
    }
    h3 {
      font-size: 16px;
      color: #334155;
      margin-top: 18px;
      margin-bottom: 8px;
    }
    p, li {
      font-size: 15px;
      color: #475569;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    .badge {
      display: inline-block;
      background: #dcfce7;
      color: #16a34a;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .contact-box {
      background: #f1f5f9;
      border-left: 4px solid #123122;
      padding: 16px 20px;
      border-radius: 4px;
      margin-top: 24px;
    }
    footer {
      text-align: center;
      padding: 24px;
      color: #64748b;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Privacy Policy</h1>
    <p>Gagan Retailer & Gagan Sales Mobile Applications</p>
  </div>
  <div class="container">
    <span class="badge">Effective Date: October 2026</span>
    <p>This Privacy Policy applies to the <strong>Gagan Retailer</strong> (com.gagan.retailer) and <strong>Gagan Sales</strong> (com.gagan.sales) mobile applications and services operated by <strong>Gagan Food Products / Jain Traders & Padam International</strong> ("we", "us", or "our").</p>
    
    <h2>1. Information We Collect</h2>
    <p>When you use our B2B wholesale ordering and field operations applications, we collect the following types of information:</p>
    <ul>
      <li><strong>Account & Identity Data:</strong> Mobile phone number (used for secure one-time password / OTP authentication), user full name, business/shop name, store address, city, and optional GSTIN/PAN details for trade invoicing.</li>
      <li><strong>Location Data (Foreground Only):</strong> 
        <ul>
          <li>In <em>Gagan Retailer</em>: Location data is accessed with your permission to identify your delivery cluster and facilitate accurate warehouse route dispatch.</li>
          <li>In <em>Gagan Sales</em>: Location coordinates are captured strictly during active store check-ins and delivery drop-off verification to prevent proxy visits and ensure transparent trade operations.</li>
          <li><em>We do NOT track your device location in the background when the app is closed or unused.</em></li>
        </ul>
      </li>
      <li><strong>Camera and Photos:</strong> When you photograph or select images for proof of payment (bank transfer slips, cheques) or store display execution evidence. We do not access your photo gallery for any other purpose.</li>
      <li><strong>Commercial & Transactional Data:</strong> Order line items, bag quantities, payment records, outstanding ledger statements, and service requests related to business trade.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <p>We process collected data exclusively for legitimate commercial wholesale operations:</p>
    <ul>
      <li>Processing, confirming, dispatching, and invoicing B2B food grain and pulses sales orders.</li>
      <li>Routing shipments from fulfillment hubs in Indore to your delivery address.</li>
      <li>Authenticating registered retail partners and field representatives.</li>
      <li>Maintaining transparent accounting ledgers and GST tax compliance.</li>
    </ul>

    <h2>3. Data Sharing & Disclosure</h2>
    <p>We respect your privacy and do not sell, rent, or trade your personal or business data. Data is shared strictly with:</p>
    <ul>
      <li>Authorized logistics and dispatch partners to fulfill deliveries.</li>
      <li>Legal and tax authorities as required by Indian law (e.g. GST portal integration).</li>
    </ul>

    <h2>4. Data Security</h2>
    <p>All network communications between the mobile applications and our backend services are encrypted using industry-standard TLS/HTTPS protocols. Sensitive session credentials and tokens are stored in hardware-backed secure storage (iOS Keychain / Android KeyStore).</p>

    <h2>5. Account & Data Deletion Policy</h2>
    <p>Under Google Play user data policies, you have the right to request the deletion of your account and associated personal data.</p>
    <p>To request deletion of your account, you can:</p>
    <ul>
      <li>Email our operations support team at <strong>privacy@gagantoordal.com</strong> with your registered mobile number and shop name.</li>
      <li>Contact your assigned sales representative or field manager.</li>
    </ul>
    <p>Upon verification, your account credentials and personal identifiers will be deleted or anonymized within 30 days, subject to mandatory statutory tax and accounting retention requirements mandated by Indian commercial law.</p>

    <h2>6. Contact Us</h2>
    <div class="contact-box">
      <strong>Gagan Food Products / Jain Traders</strong><br>
      Plot 14-16, Sector B, Sanwer Road Industrial Area,<br>
      Indore, Madhya Pradesh 452015, India<br>
      Email: <strong>privacy@gagantoordal.com</strong> / <strong>support@gagantoordal.com</strong>
    </div>
  </div>
  <footer>
    &copy; 2026 Gagan Food Products. All rights reserved.
  </footer>
</body>
</html>`);
});
