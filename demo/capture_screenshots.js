/* eslint-disable no-console */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const SCREENSHOTS_DIR = path.join(ROOT, "screenshots");
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BACKEND_URL = "http://127.0.0.1:8000/";
const FRONTEND_URL = "http://127.0.0.1:3000/";
const SCREENSHOT_FILES = [
  "homepage.png",
  "problem-input.png",
  "document-upload.png",
  "terminal-loader.png",
  "live-verdict.png",
  "knowledge-graph.png",
  "verdict-panel.png"
];

let puppeteer;

function startProcess(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });
}
function stopProcess(proc) {
  if (!proc || proc.exitCode !== null && proc.exitCode !== undefined || !proc.pid) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(proc.pid), "/t", "/f"], {
      shell: false,
      stdio: ["ignore", "ignore", "ignore"]
    });
    killer.on("exit", resolve);
    killer.on("error", resolve);
  });
}

async function waitForHttp(url, timeoutMs = 90000, watchedProcesses = []) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const proc of watchedProcesses) {
      if (proc.exitCode !== null && proc.exitCode !== undefined) {
        throw new Error(`Process exited early while waiting for ${url}. Exit code: ${proc.exitCode}`);
      }
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // retry until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function ensurePuppeteer() {
  try {
    puppeteer = require(path.join(FRONTEND_DIR, "node_modules", "puppeteer-core"));
  } catch {
    throw new Error(
      "Missing puppeteer-core. Run 'cd frontend && npm install --no-save --package-lock=false puppeteer-core' and retry."
    );
  }
}

function ensureDirectories() {
  if (!fs.existsSync(EDGE_PATH)) {
    throw new Error(`Edge executable not found at: ${EDGE_PATH}`);
  }
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  for (const fileName of fs.readdirSync(SCREENSHOTS_DIR)) {
    if (fileName.toLowerCase().endsWith(".png")) {
      fs.unlinkSync(path.join(SCREENSHOTS_DIR, fileName));
    }
  }
}

function createSamplePdf(pdfPath) {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 123 >>
stream
BT
/F1 18 Tf
72 720 Td
(ADIA market memo sample) Tj
0 -28 Td
(Food delivery demand rose 18 percent year over year.) Tj
0 -28 Td
(Customer retention improved to 63 percent in the latest quarter.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000422 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
492
%%EOF`;
  fs.writeFileSync(pdfPath, pdf, "utf8");
}

async function clickScenario(page, label) {
  const clicked = await page.$$eval("button", (buttons, expected) => {
    const button = buttons.find((item) => item.innerText && item.innerText.includes(expected));
    if (!button) {
      return false;
    }
    button.click();
    return true;
  }, label);
  if (!clicked) {
    throw new Error(`Scenario button not found for: ${label}`);
  }
}

async function captureResultPane(page, selector, fileName) {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Result pane not found for selector: ${selector}`);
  }
  await element.screenshot({ path: path.join(SCREENSHOTS_DIR, fileName) });
}

async function run() {
  ensurePuppeteer();
  ensureDirectories();

  const backendPython = path.join(BACKEND_DIR, "venv", "Scripts", "python.exe");
  const backend = startProcess(
    backendPython,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
    BACKEND_DIR
  );
  const frontend = startProcess(
    "cmd.exe",
    ["/c", "npm run dev -- --hostname 127.0.0.1 --port 3000"],
    FRONTEND_DIR
  );

  backend.stdout.on("data", (buf) => process.stdout.write(`[backend] ${buf}`));
  backend.stderr.on("data", (buf) => process.stderr.write(`[backend] ${buf}`));
  frontend.stdout.on("data", (buf) => process.stdout.write(`[frontend] ${buf}`));
  frontend.stderr.on("data", (buf) => process.stderr.write(`[frontend] ${buf}`));

  let browser;
  const samplePdfPath = path.join(__dirname, "sample-upload.pdf");

  try {
    await waitForHttp(BACKEND_URL, 120000, [backend, frontend]);
    await waitForHttp(FRONTEND_URL, 120000, [backend, frontend]);

    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: "new",
      defaultViewport: { width: 1440, height: 980 },
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "homepage.png"), fullPage: true });

    await page.waitForSelector("#pitch-text");
    await page.type(
      "#pitch-text",
      "VectorMind AI delivers hybrid vector search with rising enterprise traction and strong customer retention.",
      { delay: 10 }
    );
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "problem-input.png"), fullPage: true });

    createSamplePdf(samplePdfPath);
    const fileInput = await page.$("#pitch-file");
    if (!fileInput) {
      throw new Error("Pitch file input not found.");
    }
    await fileInput.uploadFile(samplePdfPath);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "document-upload.png"), fullPage: true });

    await clickScenario(page, "AI SaaS");
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "terminal-loader.png"), fullPage: true });

    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes("CONVICTION") && !text.includes("Amazon Nova arbitrating verdict");
      },
      { timeout: 120000 }
    );

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "live-verdict.png"), fullPage: true });
    await captureResultPane(page, '[data-testid="knowledge-graph-pane"]', "knowledge-graph.png");
    await captureResultPane(page, '[data-testid="verdict-panel-pane"]', "verdict-panel.png");
  } finally {
    if (browser) {
      await browser.close();
    }
    if (fs.existsSync(samplePdfPath)) {
      fs.unlinkSync(samplePdfPath);
    }
    await Promise.all([stopProcess(backend), stopProcess(frontend)]);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});



