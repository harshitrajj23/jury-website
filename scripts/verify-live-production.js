const https = require('https');

const TARGET_URL = 'https://jury-website.vercel.app';

function requestUrl(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Live-Production-Verifier/1.0',
        ...(options.headers || {})
      },
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      timeout: 15000,
    };

    const t0 = performance.now();
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = performance.now() - t0;
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json,
          duration,
        });
      });
    });

    req.on('error', (err) => reject({ error: err, duration: performance.now() - t0 }));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 15000ms'));
    });
    req.end();
  });
}

async function verifyLiveProduction() {
  console.log("=================================================================");
  console.log(`  VERIFYING LIVE PRODUCTION: ${TARGET_URL}`);
  console.log("=================================================================\n");

  const tests = [
    { name: "Root Landing Page (/)", url: `${TARGET_URL}/` },
    { name: "Judge Dashboard (/dashboard)", url: `${TARGET_URL}/dashboard` },
    { name: "Admin Console (/admin)", url: `${TARGET_URL}/admin` },
    { name: "Results Podium (/results)", url: `${TARGET_URL}/results` },
    { name: "Event A Results (/results?event=default_event)", url: `${TARGET_URL}/results?event=default_event` },
    { name: "PALS Logo Asset (/pals-logo.svg)", url: `${TARGET_URL}/pals-logo.svg`, checkSvg: true },
    { name: "IEEE Logo Asset (/ieee-logo.svg)", url: `${TARGET_URL}/ieee-logo.svg`, checkSvg: true },
    { name: "Database Health API (/api/db-health)", url: `${TARGET_URL}/api/db-health`, checkJson: true },
  ];

  let allPassed = true;

  for (const t of tests) {
    try {
      const res = await requestUrl(t.url);
      const isOk = res.statusCode >= 200 && res.statusCode < 400;
      const localhostLeak = res.body.includes("localhost") || res.body.includes("127.0.0.1");

      console.log(`[TEST] ${t.name}`);
      console.log(`  - URL: ${t.url}`);
      console.log(`  - Status: HTTP ${res.statusCode} (${res.duration.toFixed(1)}ms)`);
      console.log(`  - Localhost Leak: ${localhostLeak ? "⚠️ DETECTED" : "✅ 0 LEAKS"}`);

      if (t.checkSvg) {
        const isSvg = res.headers['content-type']?.includes('image/svg') || res.body.includes('<svg');
        console.log(`  - SVG Content: ${isSvg ? "✅ VALID SVG" : "❌ INVALID"}`);
        if (!isSvg) allPassed = false;
      }

      if (t.checkJson && res.json) {
        console.log(`  - DB Health: ${res.json.status}`);
        console.log(`  - Active Tables: ${res.json.tables?.join(", ")}`);
        console.log(`  - Data Nodes: Events: ${res.json.data?.events}, Teams: ${res.json.data?.teams}, Jurists: ${res.json.data?.users_and_judges}, Scores: ${res.json.data?.scores}`);
        const hasEventTable = res.json.tables?.includes("Event");
        console.log(`  - Multi-Event Table Active: ${hasEventTable ? "✅ PASS" : "❌ FAIL"}`);
        if (!hasEventTable) allPassed = false;
      }

      if (!isOk || localhostLeak) allPassed = false;
    } catch (err) {
      console.error(`❌ [FAILED] ${t.name}:`, err.message || err);
      allPassed = false;
    }
    console.log("");
  }

  // Test SSE Endpoint
  console.log("[TEST] Realtime SSE Stream Endpoint (/api/realtime/sse)");
  try {
    const sseRes = await new Promise((resolve, reject) => {
      const req = https.request(`${TARGET_URL}/api/realtime/sse`, { method: 'GET', headers: { 'Accept': 'text/event-stream' } }, (res) => {
        const contentType = res.headers['content-type'];
        res.destroy(); // Close after receiving headers
        resolve({ statusCode: res.statusCode, contentType });
      });
      req.on('error', reject);
      req.end();
    });

    const isSse = sseRes.statusCode === 200 && sseRes.contentType?.includes('text/event-stream');
    console.log(`  - Status: HTTP ${sseRes.statusCode} (${sseRes.contentType})`);
    console.log(`  - SSE Streaming Protocol: ${isSse ? "✅ PASS" : "❌ FAIL"}\n`);
    if (!isSse) allPassed = false;
  } catch (err) {
    console.error("  - SSE Stream Check Error:", err.message);
  }

  console.log("=================================================================");
  if (allPassed) {
    console.log("🏆 LIVE PRODUCTION DEPLOYMENT IS 100% HEALTHY AND VERIFIED!");
  } else {
    console.log("❌ SOME LIVE PRODUCTION CHECKS FAILED.");
  }
  console.log("=================================================================\n");

  if (!allPassed) process.exit(1);
}

verifyLiveProduction().catch(console.error);
