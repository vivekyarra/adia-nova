/* eslint-disable no-console */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const SCREENSHOTS_DIR = path.join(ROOT, "screenshots");
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
let puppeteer;

const BACKEND_URL = "http://127.0.0.1:8000/";
const FRONTEND_URL = "http://127.0.0.1:3000/";
const SCREENSHOT_FILES = [
  "homepage.png",
  "problem-input.png",
  "document-upload.png",
  "ai-reasoning-output.png",
  "dashboard-results.png",
  "agent-pipeline.png",
  "confidence-score.png"
];

function startProcess(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
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
      const res = await fetch(url);
      if (res.ok) {
        return true;
      }
    } catch {
      // keep retrying
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function run() {
  console.log("Starting screenshot capture...");
  try {
    // Install with: cd frontend && npm install --no-save puppeteer-core
    puppeteer = require(path.join(FRONTEND_DIR, "node_modules", "puppeteer-core"));
  } catch (error) {
    throw new Error(
      "Missing puppeteer-core. Run 'cd frontend && npm install --no-save puppeteer-core' and retry."
    );
  }

  if (!fs.existsSync(EDGE_PATH)) {
    throw new Error(`Edge executable not found at: ${EDGE_PATH}`);
  }
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  for (const fileName of SCREENSHOT_FILES) {
    const fullPath = path.join(SCREENSHOTS_DIR, fileName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

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
  backend.on("exit", (code) => console.log(`[backend] exited with code ${code}`));
  frontend.on("exit", (code) => console.log(`[frontend] exited with code ${code}`));

  let browser;
  try {
    console.log("Waiting for backend...");
    await waitForHttp(BACKEND_URL, 120000, [backend, frontend]);
    console.log("Waiting for frontend...");
    await waitForHttp(FRONTEND_URL, 120000, [backend, frontend]);

    console.log("Launching browser...");
    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: "new",
      defaultViewport: { width: 1440, height: 980 },
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle2" });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "homepage.png"), fullPage: true });

    const sampleProblem = "Should a startup launch a food delivery app in Hyderabad?";
    await page.click("#problem");
    await page.keyboard.type(sampleProblem);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "problem-input.png"), fullPage: true });

    const uploadFilePath = path.join(__dirname, "upload-sample.txt");
    fs.writeFileSync(
      uploadFilePath,
      "Demand trend snapshot: urban food delivery orders rose 18% while customer retention improved to 63%.",
      "utf-8"
    );
    const fileInput = await page.$("#files");
    if (!fileInput) {
      throw new Error("File input not found.");
    }
    await fileInput.uploadFile(uploadFilePath);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "document-upload.png"), fullPage: true });

    await page.click("button[type='submit']");

    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Decision Report") &&
        document.body.innerText.includes("Decision Process Timeline"),
      { timeout: 120000 }
    );

    const pipelineElement = await page.$('[data-testid="agent-pipeline"]');
    if (pipelineElement) {
      await pipelineElement.screenshot({ path: path.join(SCREENSHOTS_DIR, "agent-pipeline.png") });
    } else {
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "agent-pipeline.png"), fullPage: true });
    }

    const confidenceElement = await page.$('[data-testid="confidence-score-card"]');
    if (confidenceElement) {
      await confidenceElement.screenshot({ path: path.join(SCREENSHOTS_DIR, "confidence-score.png") });
    } else {
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "confidence-score.png"), fullPage: true });
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "ai-reasoning-output.png"), fullPage: true });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((resolve) => setTimeout(resolve, 700));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "dashboard-results.png"), fullPage: true });

    fs.unlinkSync(uploadFilePath);
    console.log("Screenshot capture completed.");
  } finally {
    if (browser) {
      await browser.close();
    }

    backend.kill("SIGTERM");
    frontend.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
