import { test } from "@playwright/test";
import path from "path";

const OG_HTML = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&family=Inter:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
    color: #fff;
    padding: 72px 80px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .mark {
    display: flex; align-items: center; gap: 18px;
  }
  .mark-box {
    width: 64px; height: 64px; border-radius: 16px;
    background: rgba(255,255,255,0.18);
    display: flex; align-items: center; justify-content: center;
  }
  .mark-text { font-family: 'DM Sans'; font-weight: 700; font-size: 36px; letter-spacing: -0.5px; }
  h1 {
    font-family: 'DM Sans'; font-weight: 700; font-size: 72px;
    line-height: 1.05; letter-spacing: -1.5px;
    max-width: 1000px;
  }
  .tag { display: inline-block; padding: 6px 14px; border-radius: 999px; background: rgba(255,255,255,0.18); font-size: 16px; font-weight: 500; margin-bottom: 28px; }
  .sub { font-size: 28px; line-height: 1.35; max-width: 900px; opacity: 0.9; font-weight: 400; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; font-size: 18px; opacity: 0.85; }
  .meta { display: flex; gap: 28px; }
  .meta strong { font-weight: 600; }
</style>
</head>
<body>
  <div class="mark">
    <div class="mark-box">
      <svg width="44" height="44" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="#fff">
        <ellipse cx="32" cy="40" rx="11" ry="9"/>
        <ellipse cx="20" cy="26" rx="5" ry="6"/>
        <ellipse cx="27" cy="18" rx="4.5" ry="5.5"/>
        <ellipse cx="37" cy="18" rx="4.5" ry="5.5"/>
        <ellipse cx="44" cy="26" rx="5" ry="6"/>
      </svg>
    </div>
    <div class="mark-text">OpenVPM</div>
  </div>

  <div>
    <span class="tag">Open source · MIT licensed</span>
    <h1>The open-source veterinary PIMS the industry has been waiting for.</h1>
    <p class="sub" style="margin-top: 24px;">
      API-first. Self-hostable. Free, forever. Built for clinics and AI builders.
    </p>
  </div>

  <div class="footer">
    <div class="meta">
      <span><strong>openvpm.com</strong></span>
      <span>github.com/evangauer/openvpm</span>
    </div>
    <div>Live demo · demo.openvpm.com</div>
  </div>
</body></html>`;

test("generate og-image.png", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(OG_HTML, { waitUntil: "networkidle" });
  // Allow font loading
  await page.waitForTimeout(1500);
  const out = path.resolve(__dirname, "../apps/www/public/og-image.png");
  await page.screenshot({ path: out, type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
});
