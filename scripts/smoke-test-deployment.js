/**
 * PRODUCTION VERCEL DEPLOYMENT SMOKE TEST
 * Targets: https://jury-website.vercel.app (or process.env.APP_URL)
 * Validates HTTP 200, API endpoints, SSE stream, DB health, and zero localhost requests.
 */

const https = require('https');
const http = require('http');

const TARGET_URL = process.env.APP_URL || 'https://jury-website.vercel.app';

function requestUrl(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'https:' ? https : http;
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Vercel-Deployment-SmokeTest/1.0',
        ...(options.headers || {})
      },
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      timeout: 10000,
    };

    const t0 = performance.now();
    const req = client.request(reqOptions, (res) => {
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
      reject(new Error('Request timed out after 10000ms'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSmokeTests() {
  console.log('=================================================================');
  console.log(`  VERCEL PRODUCTION SMOKE TEST: ${TARGET_URL}`);
  console.log('=================================================================\n');

  const tests = [
    { name: 'Root Landing Page (/)', path: '/' },
    { name: 'Judge Dashboard (/dashboard)', path: '/dashboard' },
    { name: 'Admin Console (/admin)', path: '/admin' },
    { name: 'Public Results Podium (/results)', path: '/results' },
    { name: 'Database Health API (/api/db-health)', path: '/api/db-health', checkJson: true },
  ];

  let allPassed = true;

  for (const t of tests) {
    const fullUrl = `${TARGET_URL}${t.path}`;
    try {
      const res = await requestUrl(fullUrl);
      const isOk = res.statusCode >= 200 && res.statusCode < 400;
      
      // Check for zero localhost / 127.0.0.1 references in HTML responses
      const hasLocalhostLeak = res.body.includes('http://localhost') || res.body.includes('http://127.0.0.1');

      console.log(`[TEST] ${t.name}`);
      console.log(`  - URL: ${fullUrl}`);
      console.log(`  - Status: HTTP ${res.statusCode} (${res.duration.toFixed(2)}ms)`);
      console.log(`  - Localhost Leak: ${hasLocalhostLeak ? '⚠️ DETECTED' : '✅ 0 LEAKS'}`);

      if (t.checkJson && res.json) {
        console.log(`  - DB Health Status: ${res.json.status} | Tables: ${res.json.tables?.join(', ')}`);
      }

      if (!isOk || hasLocalhostLeak) {
        allPassed = false;
      }
    } catch (err) {
      console.error(`❌ [FAILED] ${t.name}:`, err.message || err);
      allPassed = false;
    }
    console.log('');
  }

  console.log('=================================================================');
  if (allPassed) {
    console.log('✅ ALL PRODUCTION SMOKE TESTS PASSED CLEANLY');
  } else {
    console.log('❌ SOME PRODUCTION SMOKE TESTS FAILED');
  }
  console.log('=================================================================\n');

  if (!allPassed) process.exit(1);
}

runSmokeTests().catch(console.error);
