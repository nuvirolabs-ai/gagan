import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();
const ARTIFACT_DIR = "/Users/tanutejas/.gemini/antigravity/brain/e85421c7-98e4-4a39-b20e-dcd4bca2a260";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9231;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  ws: WebSocket;
  id: number;
  pending: Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>;

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method: string, params: Record<string, any> = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function seedVisualOrders() {
  console.log("Seeding visual orders with realistic aging hours...");
  const retailers = await prisma.retailer.findMany({ take: 6 });
  const variant = await prisma.variant.findFirstOrThrow({ include: { product: true } });
  const now = Date.now();

  const configs = [
    { ret: retailers[0], status: "confirmed" as const, ageHours: 0.6, qty: 3, orderNo: 101 },
    { ret: retailers[1], status: "confirmed" as const, ageHours: 1.4, qty: 5, orderNo: 102 },
    { ret: retailers[2], status: "confirmed" as const, ageHours: 3.8, qty: 2, orderNo: 103 },
    { ret: retailers[3], status: "packed" as const, ageHours: 4.5, qty: 4, orderNo: 104 },
    { ret: retailers[4], status: "packed" as const, ageHours: 7.6, qty: 6, orderNo: 105 },
    { ret: retailers[5], status: "out_for_delivery" as const, ageHours: 2.1, qty: 4, orderNo: 106, route: "ROUTE-INDORE-CENTRAL-1" },
  ];

  for (const c of configs) {
    const createdAt = new Date(now - c.ageHours * 3600 * 1000);
    await prisma.order.create({
      data: {
        retailerId: c.ret.id,
        placedBy: "rep",
        status: c.status,
        orderTotal: c.qty * 1850,
        createdAt,
        items: {
          create: [
            {
              variantId: variant.id,
              qtyOrdered: c.qty,
              unitPrice: 1850,
              caseWeightKgSnapshot: variant.unitWeightKg.mul(variant.unitsPerCase),
            },
          ],
        },
        delivery: c.route
          ? {
              create: {
                routeId: c.route,
              },
            }
          : undefined,
      },
    });
  }
}

async function captureScreenshots() {
  console.log("Spawning Chrome for infographics capture...");
  const chrome = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--user-data-dir=/tmp/chrome-test-wh-info-" + Date.now(),
      "--window-size=1440,950",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { stdio: "ignore" }
  );

  let connected = false;
  for (let i = 0; i < 20; i++) {
    try {
      const check = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (check.ok) {
        connected = true;
        break;
      }
    } catch {}
    await sleep(250);
  }
  if (!connected) throw new Error("Could not connect to headless Chrome CDP");

  const tabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:5173/login`, { method: "PUT" });
  const tab = await tabRes.json();
  const cdp = new CDPClient(tab.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 2, mobile: false });

  await sleep(1500);

  // Login
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const emailInput = document.getElementById("email") || document.querySelector("input[type=email]") || document.querySelector("input[name=email]");
        const passInput = document.getElementById("password") || document.querySelector("input[type=password]") || document.querySelector("input[name=password]");
        const form = document.querySelector(".login-card") || document.querySelector("form");

        const setVal = (input, val) => {
          const proto = Object.getPrototypeOf(input);
          const desc = Object.getOwnPropertyDescriptor(proto, "value");
          desc.set.call(input, val);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };

        setVal(emailInput, "warehouse-lead@gagan.test");
        setVal(passInput, "password123");
        if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      })()
    `,
  });

  await sleep(2500);

  // Navigate to warehouse orders
  await cdp.send("Page.navigate", { url: "http://localhost:5173/warehouse-orders" });
  await sleep(3000);

  console.log("Capturing Warehouse Orders Infographics & Aging SLA dashboard...");
  const screenshotInfographics: any = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${ARTIFACT_DIR}/warehouse_analytics_infographics_dashboard.png`, Buffer.from(screenshotInfographics.data, "base64"));
  console.log("Saved screenshot to warehouse_analytics_infographics_dashboard.png");

  // Click on the first order card to show the modal pop-up with typography and checklist
  console.log("Clicking order row to open fulfillment checklist modal...");
  await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        const row = document.querySelector(".warehouse-order-row") || document.querySelector(".warehouse-order-card");
        if (row) row.click();
      })()
    `,
  });

  await sleep(1500);
  const screenshotModal: any = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${ARTIFACT_DIR}/warehouse_order_modal_checklist.png`, Buffer.from(screenshotModal.data, "base64"));
  console.log("Saved screenshot to warehouse_order_modal_checklist.png");

  cdp.close();
  chrome.kill();
}

async function main() {
  await seedVisualOrders();
  await captureScreenshots();
  console.log("Infographics captured successfully!");
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
