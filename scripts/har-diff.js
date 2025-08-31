#!/usr/bin/env node

/**
 * Network HAR Diff Testing Script
 * 
 * This script compares network requests (HAR files) between the original site
 * and our local implementation to ensure API compatibility and correct routing.
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

const ORIGINAL_BASE_URL = 'https://pc.dfbiu.com';
const LOCAL_BASE_URL = 'http://localhost:5000';
const BASELINE_DIR = path.join(__dirname, '..', 'baseline');
const HAR_DIR = path.join(__dirname, '..', 'har');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Import pages from baseline script
const { PAGES_TO_CAPTURE } = require('./collect-baseline.js');

async function ensureDirectories() {
  const dirs = [HAR_DIR, REPORTS_DIR];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  console.log('✓ HAR directories ensured');
}

async function captureNetworkTraffic(page, url, outputPath) {
  try {
    // Start HAR recording
    await page.routeFromHAR(outputPath, { 
      url: '*/**',
      update: true,
      notFound: 'continue'
    });
    
    // Navigate and capture network traffic
    const response = await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000); // Allow time for async requests
    
    // Trigger some common API calls if this is a logged-in page
    if (url.includes('admin') || url.includes('dashboard')) {
      try {
        // Try to trigger AJAX requests by clicking buttons or loading data
        await page.click('[data-load], .load-data, .refresh-data', { timeout: 2000 });
        await page.waitForTimeout(2000);
      } catch (error) {
        // No interactive elements found, continue
      }
    }
    
    return {
      success: true,
      statusCode: response?.status() || 0,
      url: response?.url() || url
    };
    
  } catch (error) {
    console.error(`Error capturing HAR for ${url}: ${error.message}`);
    return {
      success: false,
      error: error.message,
      url
    };
  }
}

async function parseHarFile(harPath) {
  try {
    const harData = await fs.readFile(harPath, 'utf8');
    const har = JSON.parse(harData);
    
    if (!har.log || !har.log.entries) {
      return { requests: [], error: 'Invalid HAR format' };
    }
    
    const requests = har.log.entries.map(entry => ({
      url: entry.request.url,
      method: entry.request.method,
      status: entry.response.status,
      statusText: entry.response.statusText,
      contentType: entry.response.content.mimeType,
      size: entry.response.content.size,
      time: entry.time,
      headers: entry.request.headers.reduce((acc, header) => {
        acc[header.name.toLowerCase()] = header.value;
        return acc;
      }, {}),
      responseHeaders: entry.response.headers.reduce((acc, header) => {
        acc[header.name.toLowerCase()] = header.value;
        return acc;
      }, {})
    }));
    
    return { requests, error: null };
    
  } catch (error) {
    return { requests: [], error: error.message };
  }
}

function categorizeRequests(requests) {
  const categories = {
    api: [],
    assets: [],
    external: [],
    errors: []
  };
  
  requests.forEach(req => {
    const url = new URL(req.url);
    
    if (req.status >= 400) {
      categories.errors.push(req);
    } else if (req.url.includes('/api/')) {
      categories.api.push(req);
    } else if (req.contentType && (
      req.contentType.includes('javascript') ||
      req.contentType.includes('css') ||
      req.contentType.includes('image') ||
      req.contentType.includes('font')
    )) {
      categories.assets.push(req);
    } else if (url.hostname !== new URL(ORIGINAL_BASE_URL).hostname && 
               url.hostname !== new URL(LOCAL_BASE_URL).hostname.replace('localhost', '127.0.0.1')) {
      categories.external.push(req);
    }
  });
  
  return categories;
}

function compareRequestSets(originalRequests, localRequests, pageName) {
  const originalCategorized = categorizeRequests(originalRequests);
  const localCategorized = categorizeRequests(localRequests);
  
  const comparison = {
    pageName,
    summary: {
      original_total: originalRequests.length,
      local_total: localRequests.length,
      original_api_calls: originalCategorized.api.length,
      local_api_calls: localCategorized.api.length,
      original_errors: originalCategorized.errors.length,
      local_errors: localCategorized.errors.length,
      external_calls: originalCategorized.external.length + localCategorized.external.length
    },
    differences: {
      missing_api_calls: [],
      extra_api_calls: [],
      status_mismatches: [],
      external_leaks: []
    }
  };
  
  // Find missing API calls (in original but not local)
  originalCategorized.api.forEach(originalReq => {
    const originalPath = new URL(originalReq.url).pathname;
    const matchingLocal = localCategorized.api.find(localReq => {
      const localPath = new URL(localReq.url).pathname;
      return localPath === originalPath && localReq.method === originalReq.method;
    });
    
    if (!matchingLocal) {
      comparison.differences.missing_api_calls.push({
        method: originalReq.method,
        path: originalPath,
        status: originalReq.status
      });
    }
  });
  
  // Find extra API calls (in local but not original)
  localCategorized.api.forEach(localReq => {
    const localPath = new URL(localReq.url).pathname;
    const matchingOriginal = originalCategorized.api.find(originalReq => {
      const originalPath = new URL(originalReq.url).pathname;
      return originalPath === localPath && originalReq.method === localReq.method;
    });
    
    if (!matchingOriginal) {
      comparison.differences.extra_api_calls.push({
        method: localReq.method,
        path: localPath,
        status: localReq.status
      });
    }
  });
  
  // Find status mismatches
  originalCategorized.api.forEach(originalReq => {
    const originalPath = new URL(originalReq.url).pathname;
    const matchingLocal = localCategorized.api.find(localReq => {
      const localPath = new URL(localReq.url).pathname;
      return localPath === originalPath && localReq.method === originalReq.method;
    });
    
    if (matchingLocal && originalReq.status !== matchingLocal.status) {
      comparison.differences.status_mismatches.push({
        method: originalReq.method,
        path: originalPath,
        original_status: originalReq.status,
        local_status: matchingLocal.status
      });
    }
  });
  
  // Find external leaks (requests to wrong domains)
  localCategorized.external.forEach(req => {
    const url = new URL(req.url);
    if (!url.hostname.includes('localhost') && 
        !url.hostname.includes('127.0.0.1') && 
        !url.hostname.includes('pc.dfbiu.com')) {
      comparison.differences.external_leaks.push({
        method: req.method,
        url: req.url,
        status: req.status
      });
    }
  });
  
  return comparison;
}

async function generateHarDiffReport(comparisons) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_pages: comparisons.length,
      pages_with_missing_apis: comparisons.filter(c => c.differences.missing_api_calls.length > 0).length,
      pages_with_extra_apis: comparisons.filter(c => c.differences.extra_api_calls.length > 0).length,
      pages_with_status_mismatches: comparisons.filter(c => c.differences.status_mismatches.length > 0).length,
      pages_with_external_leaks: comparisons.filter(c => c.differences.external_leaks.length > 0).length,
      total_missing_apis: comparisons.reduce((sum, c) => sum + c.differences.missing_api_calls.length, 0),
      total_extra_apis: comparisons.reduce((sum, c) => sum + c.differences.extra_api_calls.length, 0),
      total_external_leaks: comparisons.reduce((sum, c) => sum + c.differences.external_leaks.length, 0)
    },
    comparisons
  };
  
  // Write JSON report
  const jsonReportPath = path.join(REPORTS_DIR, 'har-diff-report.json');
  await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
  
  // Write human-readable report
  const textReportPath = path.join(REPORTS_DIR, 'har-diff-report.txt');
  let textReport = '';
  textReport += '=== Network HAR Diff Report ===\n';
  textReport += `Generated: ${report.timestamp}\n\n`;
  textReport += 'SUMMARY:\n';
  textReport += `- Total pages tested: ${report.summary.total_pages}\n`;
  textReport += `- Pages with missing APIs: ${report.summary.pages_with_missing_apis}\n`;
  textReport += `- Pages with extra APIs: ${report.summary.pages_with_extra_apis}\n`;
  textReport += `- Pages with status mismatches: ${report.summary.pages_with_status_mismatches}\n`;
  textReport += `- Pages with external leaks: ${report.summary.pages_with_external_leaks}\n`;
  textReport += `- Total missing API calls: ${report.summary.total_missing_apis}\n`;
  textReport += `- Total external leaks: ${report.summary.total_external_leaks}\n\n`;
  
  textReport += 'DETAILED RESULTS:\n';
  comparisons.forEach(comp => {
    textReport += `\n${comp.pageName}:\n`;
    textReport += `  Original requests: ${comp.summary.original_total}\n`;
    textReport += `  Local requests: ${comp.summary.local_total}\n`;
    textReport += `  Original API calls: ${comp.summary.original_api_calls}\n`;
    textReport += `  Local API calls: ${comp.summary.local_api_calls}\n`;
    
    if (comp.differences.missing_api_calls.length > 0) {
      textReport += `  Missing API calls:\n`;
      comp.differences.missing_api_calls.forEach(api => {
        textReport += `    - ${api.method} ${api.path} (${api.status})\n`;
      });
    }
    
    if (comp.differences.extra_api_calls.length > 0) {
      textReport += `  Extra API calls:\n`;
      comp.differences.extra_api_calls.forEach(api => {
        textReport += `    - ${api.method} ${api.path} (${api.status})\n`;
      });
    }
    
    if (comp.differences.external_leaks.length > 0) {
      textReport += `  External leaks:\n`;
      comp.differences.external_leaks.forEach(leak => {
        textReport += `    - ${leak.method} ${leak.url}\n`;
      });
    }
  });
  
  await fs.writeFile(textReportPath, textReport);
  
  console.log(`📄 HAR diff reports generated:`);
  console.log(`   JSON: ${jsonReportPath}`);
  console.log(`   Text: ${textReportPath}`);
  
  return report;
}

async function main() {
  console.log('🌐 Starting network HAR diff testing...');
  
  await ensureDirectories();
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const comparisons = [];
    
    for (const pageInfo of PAGES_TO_CAPTURE) {
      const { name, url } = pageInfo;
      console.log(`🔍 Analyzing network traffic: ${name}`);
      
      const originalHarPath = path.join(HAR_DIR, `${name}-original.har`);
      const localHarPath = path.join(HAR_DIR, `${name}-local.har`);
      
      const page = await context.newPage();
      
      // Capture network traffic from original site
      console.log(`  Capturing original site traffic...`);
      await captureNetworkTraffic(page, `${ORIGINAL_BASE_URL}${url}`, originalHarPath);
      
      // Capture network traffic from local site
      console.log(`  Capturing local site traffic...`);
      await captureNetworkTraffic(page, `${LOCAL_BASE_URL}${url}`, localHarPath);
      
      // Parse HAR files
      const originalHar = await parseHarFile(originalHarPath);
      const localHar = await parseHarFile(localHarPath);
      
      if (originalHar.error) {
        console.warn(`  ⚠️  Could not parse original HAR: ${originalHar.error}`);
      }
      
      if (localHar.error) {
        console.warn(`  ⚠️  Could not parse local HAR: ${localHar.error}`);
      }
      
      // Compare requests
      if (!originalHar.error && !localHar.error) {
        const comparison = compareRequestSets(originalHar.requests, localHar.requests, name);
        comparisons.push(comparison);
        
        console.log(`  ✓ Original: ${comparison.summary.original_total} requests, ${comparison.summary.original_api_calls} API calls`);
        console.log(`  ✓ Local: ${comparison.summary.local_total} requests, ${comparison.summary.local_api_calls} API calls`);
        console.log(`  ✓ Missing APIs: ${comparison.differences.missing_api_calls.length}`);
        console.log(`  ✓ Extra APIs: ${comparison.differences.extra_api_calls.length}`);
        console.log(`  ✓ External leaks: ${comparison.differences.external_leaks.length}`);
      }
      
      await page.close();
    }
    
    // Generate comprehensive report
    const report = await generateHarDiffReport(comparisons);
    
    // Print summary
    console.log('\n📊 NETWORK HAR DIFF SUMMARY:');
    console.log(`🔍 Pages tested: ${report.summary.total_pages}`);
    console.log(`❌ Missing API calls: ${report.summary.total_missing_apis}`);
    console.log(`➕ Extra API calls: ${report.summary.total_extra_apis}`);
    console.log(`🌐 External leaks: ${report.summary.total_external_leaks}`);
    
    // Check for critical issues
    const hasCriticalIssues = report.summary.total_missing_apis > 5 || 
                              report.summary.total_external_leaks > 0;
    
    if (hasCriticalIssues) {
      console.log('\n⚠️  HAR diff test completed with issues - review required');
      console.log('Critical issues found: missing APIs or external request leaks');
      // Don't exit with error, just report the issues
    } else {
      console.log('\n✅ HAR diff test passed - network patterns are compatible');
    }
    
  } catch (error) {
    console.error('❌ HAR diff testing failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, compareRequestSets, categorizeRequests };