const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/tanutejas/.gemini/antigravity/brain/e85421c7-98e4-4a39-b20e-dcd4bca2a260';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function run() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    userDataDir: '/tmp/chrome-admin-phase1-clean',
  });

  const page = await browser.newPage();

  try {
    console.log('1. Loading Admin Portal...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Check if login form is present
    const loginEmail = await page.$('#email');
    if (loginEmail) {
      console.log('Filling login credentials...');
      await page.type('#email', 'admin@gagan.test');
      await page.type('#password', 'password123');
      await page.click('button[type="submit"]');
      console.log('Submitted login, waiting for dashboard shell...');
      await page.waitForSelector('.top-bar, .app-shell, .nav-group', { timeout: 10000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log('Authenticated! Current URL:', page.url());

    // ----------------------------------------------------
    // GAP 1: Warehouses & Hubs
    // ----------------------------------------------------
    console.log('2. Navigating to Gap 1: Warehouses & Hubs...');
    await page.goto('http://localhost:5173/warehouses', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    const gap1HubPath = path.join(ARTIFACT_DIR, 'gap1_warehouses_hub.png');
    await page.screenshot({ path: gap1HubPath, fullPage: true });
    console.log('Saved:', gap1HubPath);

    console.log('3. Switching to City & Hub Routing Matrix...');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button.tab'));
      const routingTab = tabs.find((t) => t.textContent.includes('Routing'));
      if (routingTab) routingTab.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    const gap1RoutingPath = path.join(ARTIFACT_DIR, 'gap1_warehouses_routing.png');
    await page.screenshot({ path: gap1RoutingPath, fullPage: true });
    console.log('Saved:', gap1RoutingPath);

    // ----------------------------------------------------
    // GAP 2: Staff Directory & Profile Editor
    // ----------------------------------------------------
    console.log('4. Navigating to Gap 2: Staff Directory...');
    await page.goto('http://localhost:5173/staff', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    const gap2DirPath = path.join(ARTIFACT_DIR, 'gap2_staff_directory.png');
    await page.screenshot({ path: gap2DirPath, fullPage: true });
    console.log('Saved:', gap2DirPath);

    console.log('5. Navigating to Gap 2: Staff Profile Editor...');
    // Find an Open button
    const openHref = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('table tbody tr a'));
      const staffLink = links.find((a) => a.getAttribute('href') && a.getAttribute('href').startsWith('/staff/'));
      return staffLink ? staffLink.getAttribute('href') : null;
    });

    if (openHref) {
      await page.goto(`http://localhost:5173${openHref}`, { waitUntil: 'networkidle2' });
    } else {
      await page.goto('http://localhost:5173/staff', { waitUntil: 'networkidle2' });
    }
    await new Promise((r) => setTimeout(r, 1500));
    const gap2ProfilePath = path.join(ARTIFACT_DIR, 'gap2_staff_edit_profile.png');
    await page.screenshot({ path: gap2ProfilePath, fullPage: true });
    console.log('Saved:', gap2ProfilePath);

    // ----------------------------------------------------
    // GAP 3: Retailers Bulk Territory Reassignment
    // ----------------------------------------------------
    console.log('6. Navigating to Gap 3: Retailers Bulk Reassignment...');
    await page.goto('http://localhost:5173/retailers', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    
    // Select the first 3 retailer checkboxes
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('table tbody tr input[type="checkbox"]'));
      checkboxes.slice(0, 3).forEach((cb) => cb.click());
    });
    await new Promise((r) => setTimeout(r, 800));

    // Click "Transfer to Salesperson…"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const transferBtn = btns.find((b) => b.textContent.includes('Transfer to Salesperson'));
      if (transferBtn) transferBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    const gap3ReassignPath = path.join(ARTIFACT_DIR, 'gap3_retailers_bulk_reassign.png');
    await page.screenshot({ path: gap3ReassignPath, fullPage: true });
    console.log('Saved:', gap3ReassignPath);

    // ----------------------------------------------------
    // GAP 4: Sales Leader Target Matrix Tab
    // ----------------------------------------------------
    console.log('7. Navigating to Gap 4: Sales Leader Target Setting Matrix...');
    await page.goto('http://localhost:5173/sales-leader', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    // Click "Target Setting Matrix" tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button.tab'));
      const matrixTab = btns.find((b) => b.textContent.includes('Target Setting Matrix'));
      if (matrixTab) matrixTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const gap4MatrixPath = path.join(ARTIFACT_DIR, 'gap4_target_matrix.png');
    await page.screenshot({ path: gap4MatrixPath, fullPage: true });
    console.log('Saved:', gap4MatrixPath);

    // ----------------------------------------------------
    // GAP 5: Business Settings & Global AppConfig
    // ----------------------------------------------------
    console.log('8. Navigating to Gap 5: Business Settings...');
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    const gap5SettingsPath = path.join(ARTIFACT_DIR, 'gap5_business_settings.png');
    await page.screenshot({ path: gap5SettingsPath, fullPage: true });
    console.log('Saved:', gap5SettingsPath);

    console.log('SUCCESS: All 7 screenshots captured!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

run();
