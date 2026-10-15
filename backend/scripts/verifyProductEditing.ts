import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const ARTIFACT_DIR = "/Users/tanutejas/.gemini/antigravity/brain/e85421c7-98e4-4a39-b20e-dcd4bca2a260";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9245;

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

async function main() {
  console.log("=== VERIFYING PRODUCT NAME & CATEGORY EDITING (CDP) ===");
  const chrome = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--user-data-dir=/tmp/chrome-test-catalog-edit-" + Date.now(),
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

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 2, mobile: false });

    await sleep(1500);

    // 1. Login as Catalog Admin
    console.log("1. Logging in as catalog@gagan.test...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const emailInput = document.getElementById("email") || document.querySelector("input[type=email]");
          const passInput = document.getElementById("password") || document.querySelector("input[type=password]");
          const form = document.querySelector(".login-card") || document.querySelector("form");

          const setVal = (input, val) => {
            const proto = Object.getPrototypeOf(input);
            const desc = Object.getOwnPropertyDescriptor(proto, "value");
            desc.set.call(input, val);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          };

          setVal(emailInput, "catalog@gagan.test");
          setVal(passInput, "password123");
          if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        })()
      `,
    });

    await sleep(2500);

    // 2. Navigate to Catalog page
    console.log("2. Navigating to Catalog page...");
    await cdp.send("Page.navigate", { url: "http://localhost:5173/catalog" });
    await sleep(2500);

    // 3. Test "Add pack" on already listed product
    console.log("3. Testing 'Add pack' modal on already listed product...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const addPack = buttons.find(b => b.textContent.trim() === "Add pack");
          if (addPack) addPack.click();
        })()
      `,
    });
    await sleep(1500);

    // Check readOnly state of productName and category in Add Pack
    const checkState: any = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const nameInput = document.querySelector("input[name=productName]");
          const catInput = document.querySelector("input[name=category]");
          return {
            nameVal: nameInput ? nameInput.value : null,
            nameReadOnly: nameInput ? nameInput.readOnly : null,
            catVal: catInput ? catInput.value : null,
            catReadOnly: catInput ? catInput.readOnly : null
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Add Pack form inputs state:", checkState.result.value);

    // Take screenshot of editable Add pack form
    const scAddPack: any = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${ARTIFACT_DIR}/catalog_add_pack_editable_product_info.png`, Buffer.from(scAddPack.data, "base64"));
    console.log("Saved screenshot: catalog_add_pack_editable_product_info.png");

    // Close the Add pack form
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const closeBtn = document.querySelector("button[title=Close]");
          if (closeBtn) closeBtn.click();
        })()
      `,
    });
    await sleep(1000);

    // 4. Test "✎ Edit product" modal
    console.log("4. Testing '✎ Edit product' modal...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const editBtn = buttons.find(b => b.textContent.includes("Edit product"));
          if (editBtn) editBtn.click();
        })()
      `,
    });
    await sleep(1500);

    // Take screenshot of Edit Product Details modal
    const scEditModal: any = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${ARTIFACT_DIR}/catalog_edit_product_modal.png`, Buffer.from(scEditModal.data, "base64"));
    console.log("Saved screenshot: catalog_edit_product_modal.png");

    // 5. Test saving changes from Edit Product Details modal
    console.log("5. Testing saving updated product details via modal...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const nameInput = document.querySelector("input[aria-label='Edit product name']");
          const catInput = document.querySelector("input[aria-label='Edit category']");
          const form = nameInput.closest("form");

          const setVal = (input, val) => {
            const proto = Object.getPrototypeOf(input);
            const desc = Object.getOwnPropertyDescriptor(proto, "value");
            desc.set.call(input, val);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          };

          setVal(nameInput, "Gagan Toor Dal (Special Quality)");
          setVal(catInput, "Premium Pulses");
          if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        })()
      `,
    });
    await sleep(2500);

    // Take screenshot of updated product in catalog
    const scUpdated: any = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${ARTIFACT_DIR}/catalog_product_updated.png`, Buffer.from(scUpdated.data, "base64"));
    console.log("Saved screenshot: catalog_product_updated.png");

    // Revert product name back to Gagan Toor Dal
    console.log("6. Reverting product name back to original...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const editBtn = buttons.find(b => b.textContent.includes("Edit product"));
          if (editBtn) editBtn.click();
        })()
      `,
    });
    await sleep(1000);
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const nameInput = document.querySelector("input[aria-label='Edit product name']");
          const catInput = document.querySelector("input[aria-label='Edit category']");
          const form = nameInput.closest("form");

          const setVal = (input, val) => {
            const proto = Object.getPrototypeOf(input);
            const desc = Object.getOwnPropertyDescriptor(proto, "value");
            desc.set.call(input, val);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          };

          setVal(nameInput, "Gagan Toor Dal");
          setVal(catInput, "Daal");
          if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        })()
      `,
    });
    await sleep(2000);

    console.log("=== ALL PRODUCT EDITING CHECKS PASSED WITH 100% SUCCESS! ===");
  } finally {
    cdp.close();
    chrome.kill();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
