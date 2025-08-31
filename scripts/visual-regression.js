
#!/usr/bin/env node

/**
 * Visual Regression Testing Script
 * 
 * This script captures screenshots of our local application and compares them
 * with the baseline screenshots using pixelmatch. Reports differences > 2% threshold.
 */

const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs').promises;
const path = require('path');

const LOCAL_BASE_URL = 'http://localhost:5000';
const BASELINE_DIR = path.join(__dirname, '..', 'baseline');
const CURRENT_DIR = path.join(__dirname, '..', 'screenshots', 'current');
const DIFF_DIR = path.join(__dirname, '..', 'screenshots', 'diff');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Import pages from baseline script
const { PAGES_TO_CAPTURE, USER_CREDENTIALS } = require('./collect-baseline.js');

// User state configurations
const USER_STATES = ['guest', 'user', 'admin'];

async function loginToLocalSite(page, userState = 'user') {
  if (userState === 'guest') {
    console.log('👤 Using guest state (no login)');
    return { success: true };
  }
  
  const credentials = USER_CREDENTIALS[userState] || USER_CREDENTIALS.user;
  console.log(`🔐 Logging into local site as ${userState}...`);
  
  try {
    // Navigate to login page
    await page.goto(`${LOCAL_BASE_URL}/login`, { waitUntil: 'networkidle' });
    
    // Fill login form
    await page.fill('input[name="username"], input[name="email"], #username, #email', credentials.username);
    await page.fill('input[name="password"], #password', credentials.password);
    
    // Submit form
    await page.click('button[type="submit"], input[type="submit"], .btn-login, .login-btn');
    
    // Wait for successful login
    await page.waitForLoadState('networkidle');
    
    // Verify login success
    const loggedIn = await page.locator('a[href*="logout"], .logout, .dashboard, .profile-menu').first().isVisible();
    
    if (loggedIn) {
      console.log(`✓ Successfully logged into local site as ${userState}`);
      return { success: true };
    } else {
      console.warn(`⚠ Login as ${userState} may have failed`);
      return { success: false, error: 'Login verification failed' };
    }
    
  } catch (error) {
    console.error(`Login error for ${userState}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function ensureDirectories() {
  const dirs = [CURRENT_DIR, DIFF_DIR, REPORTS_DIR];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  console.log('✓ Output directories ensured');
}

async function captureCurrentScreenshots(page, userState) {
  console.log(`📸 Capturing current screenshots for ${userState} state...`);
  
  const results = [];
  
  // Filter pages based on what's accessible to this user state
  const accessiblePages = PAGES_TO_CAPTURE.filter(pageInfo => 
    pageInfo.states.includes(userState)
  );
  
  console.log(`📋 ${accessiblePages.length} pages accessible for ${userState} state`);
  
  for (const pageInfo of accessiblePages) {
    const { name, url } = pageInfo;
    const filename = `${name}-${userState}`;
    console.log(`Capturing current: ${filename}`);
    
    try {
      await page.goto(`${LOCAL_BASE_URL}${url}`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      await page.waitForTimeout(2000);
      
      // Handle any modals that might be open
      try {
        await page.locator('.modal, .popup, .dialog').first().waitFor({ timeout: 1000 });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (error) {
        // No modal found, continue
      }
      
      await page.screenshot({ 
        path: `${CURRENT_DIR}/${filename}.png`,
        fullPage: true 
      });
      
      results.push({ name: filename, success: true, userState });
      
    } catch (error) {
      console.error(`Error capturing ${filename}: ${error.message}`);
      results.push({ name: filename, success: false, error: error.message, userState });
    }
  }
  
  return results;
}

async function compareImages(baselinePath, currentPath, diffPath) {
  try {
    const baselineExists = await fs.access(baselinePath).then(() => true).catch(() => false);
    const currentExists = await fs.access(currentPath).then(() => true).catch(() => false);
    
    if (!baselineExists) {
      return { 
        status: 'missing_baseline', 
        error: 'Baseline image not found',
        diffPixels: 0,
        diffPercentage: 0
      };
    }
    
    if (!currentExists) {
      return { 
        status: 'missing_current', 
        error: 'Current image not found',
        diffPixels: 0,
        diffPercentage: 0
      };
    }
    
    const baseline = PNG.sync.read(await fs.readFile(baselinePath));
    const current = PNG.sync.read(await fs.readFile(currentPath));
    
    // Ensure images have the same dimensions
    const width = Math.max(baseline.width, current.width);
    const height = Math.max(baseline.height, current.height);
    
    // Resize images if needed
    if (baseline.width !== width || baseline.height !== height) {
      const resizedBaseline = new PNG({ width, height });
      PNG.bitblt(baseline, resizedBaseline, 0, 0, baseline.width, baseline.height, 0, 0);
      baseline.data = resizedBaseline.data;
      baseline.width = width;
      baseline.height = height;
    }
    
    if (current.width !== width || current.height !== height) {
      const resizedCurrent = new PNG({ width, height });
      PNG.bitblt(current, resizedCurrent, 0, 0, current.width, current.height, 0, 0);
      current.data = resizedCurrent.data;
      current.width = width;
      current.height = height;
    }
    
    const diff = new PNG({ width, height });
    
    const diffPixels = pixelmatch(
      baseline.data, 
      current.data, 
      diff.data, 
      width, 
      height,
      { threshold: 0.1 }
    );
    
    const totalPixels = width * height;
    const diffPercentage = (diffPixels / totalPixels) * 100;
    
    // Save diff image
    await fs.writeFile(diffPath, PNG.sync.write(diff));
    
    return {
      status: diffPercentage > 2 ? 'different' : 'similar',
      diffPixels,
      diffPercentage: diffPercentage.toFixed(2),
      width,
      height,
      totalPixels
    };
    
  } catch (error) {
    return { 
      status: 'error', 
      error: error.message,
      diffPixels: 0,
      diffPercentage: 0
    };
  }
}

async function generateReport(comparisonResults, captureResults) {
  const report = {
    timestamp: new Date().toISOString(),
    user_states: USER_STATES,
    summary: {
      total_states: USER_STATES.length,
      total_comparisons: comparisonResults.length,
      successful_captures: captureResults.filter(r => r.success).length,
      failed_captures: captureResults.filter(r => !r.success).length,
      similar_pages: comparisonResults.filter(r => r.status === 'similar').length,
      different_pages: comparisonResults.filter(r => r.status === 'different').length,
      missing_baselines: comparisonResults.filter(r => r.status === 'missing_baseline').length,
      errors: comparisonResults.filter(r => r.status === 'error').length
    },
    results_by_state: {},
    results: comparisonResults,
    capture_results: captureResults
  };
  
  // Group results by user state
  for (const userState of USER_STATES) {
    const stateResults = comparisonResults.filter(r => r.name.endsWith(`-${userState}`));
    const stateCaptures = captureResults.filter(r => r.userState === userState);
    
    report.results_by_state[userState] = {
      total: stateResults.length,
      successful_captures: stateCaptures.filter(r => r.success).length,
      similar: stateResults.filter(r => r.status === 'similar').length,
      different: stateResults.filter(r => r.status === 'different').length,
      missing_baseline: stateResults.filter(r => r.status === 'missing_baseline').length,
      errors: stateResults.filter(r => r.status === 'error').length
    };
  }
  
  // Write JSON report
  const jsonReportPath = path.join(REPORTS_DIR, 'visual-regression-report.json');
  await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
  
  // Write human-readable report
  const textReportPath = path.join(REPORTS_DIR, 'visual-regression-report.txt');
  let textReport = '';
  textReport += '=== Visual Regression Test Report ===\n';
  textReport += `Generated: ${report.timestamp}\n\n`;
  textReport += 'OVERALL SUMMARY:\n';
  textReport += `- User states tested: ${report.summary.total_states} (${USER_STATES.join(', ')})\n`;
  textReport += `- Total comparisons: ${report.summary.total_comparisons}\n`;
  textReport += `- Successful captures: ${report.summary.successful_captures}\n`;
  textReport += `- Failed captures: ${report.summary.failed_captures}\n`;
  textReport += `- Similar pages (≤2% diff): ${report.summary.similar_pages}\n`;
  textReport += `- Different pages (>2% diff): ${report.summary.different_pages}\n`;
  textReport += `- Missing baselines: ${report.summary.missing_baselines}\n`;
  textReport += `- Comparison errors: ${report.summary.errors}\n\n`;
  
  textReport += 'RESULTS BY USER STATE:\n';
  for (const [userState, stateData] of Object.entries(report.results_by_state)) {
    textReport += `\n${userState.toUpperCase()}:\n`;
    textReport += `  Total: ${stateData.total}\n`;
    textReport += `  Similar: ${stateData.similar}\n`;
    textReport += `  Different: ${stateData.different}\n`;
    textReport += `  Missing/Errors: ${stateData.missing_baseline + stateData.errors}\n`;
  }
  
  textReport += '\n\nDETAILED RESULTS:\n';
  for (const result of comparisonResults) {
    textReport += `\n${result.name}:\n`;
    textReport += `  Status: ${result.status}\n`;
    if (result.diffPercentage !== undefined) {
      textReport += `  Difference: ${result.diffPercentage}%\n`;
    }
    if (result.error) {
      textReport += `  Error: ${result.error}\n`;
    }
  }
  
  await fs.writeFile(textReportPath, textReport);
  
  console.log(`📄 Reports generated:`);
  console.log(`   JSON: ${jsonReportPath}`);
  console.log(`   Text: ${textReportPath}`);
  
  return report;
}

async function main() {
  console.log('🔍 Starting comprehensive visual regression testing for all user states...');
  
  await ensureDirectories();
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const allCaptureResults = [];
  const allComparisonResults = [];
  
  try {
    for (const userState of USER_STATES) {
      console.log(`\n🔄 Processing ${userState.toUpperCase()} state...`);
      
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
      });
      
      const page = await context.newPage();
      
      // Login for this user state
      const loginResult = await loginToLocalSite(page, userState);
      if (!loginResult.success && userState !== 'guest') {
        console.warn(`⚠ Could not login as ${userState}, skipping state`);
        await context.close();
        continue;
      }
      
      // Capture current screenshots for this state
      const captureResults = await captureCurrentScreenshots(page, userState);
      allCaptureResults.push(...captureResults);
      
      // Compare with baseline for this state
      console.log(`🔄 Comparing ${userState} screenshots with baseline...`);
      
      for (const pageInfo of PAGES_TO_CAPTURE) {
        if (!pageInfo.states.includes(userState)) continue;
        
        const { name } = pageInfo;
        const filename = `${name}-${userState}`;
        const baselinePath = path.join(BASELINE_DIR, `${filename}.png`);
        const currentPath = path.join(CURRENT_DIR, `${filename}.png`);
        const diffPath = path.join(DIFF_DIR, `${filename}-diff.png`);
        
        console.log(`Comparing: ${filename}`);
        const comparison = await compareImages(baselinePath, currentPath, diffPath);
        allComparisonResults.push({ name: filename, ...comparison });
        
        if (comparison.status === 'different') {
          console.log(`⚠️  ${filename}: ${comparison.diffPercentage}% difference (threshold: 2%)`);
        } else if (comparison.status === 'similar') {
          console.log(`✅ ${filename}: ${comparison.diffPercentage}% difference`);
        } else {
          console.log(`❌ ${filename}: ${comparison.status}${comparison.error ? ` - ${comparison.error}` : ''}`);
        }
      }
      
      await context.close();
      console.log(`✅ ${userState.toUpperCase()} state completed`);
    }
    
    // Generate comprehensive report
    const report = await generateReport(allComparisonResults, allCaptureResults);
    
    // Print final summary
    console.log('\n📊 COMPREHENSIVE VISUAL REGRESSION SUMMARY:');
    console.log(`🔄 User states tested: ${USER_STATES.length} (${USER_STATES.join(', ')})`);
    console.log(`✅ Similar pages (≤2%): ${report.summary.similar_pages}`);
    console.log(`⚠️  Different pages (>2%): ${report.summary.different_pages}`);
    console.log(`❌ Missing/errors: ${report.summary.missing_baselines + report.summary.errors}`);
    
    // Show breakdown by state
    console.log('\n📋 Breakdown by user state:');
    for (const [userState, stateData] of Object.entries(report.results_by_state)) {
      const successRate = stateData.total > 0 ? ((stateData.similar / stateData.total) * 100).toFixed(1) : '0';
      console.log(`   ${userState}: ${stateData.similar}/${stateData.total} similar (${successRate}%)`);
    }
    
    // Exit with error code if there are significant differences
    if (report.summary.different_pages > 0) {
      console.log('\n❌ Visual regression test FAILED - significant differences detected');
      console.log('📄 Check reports/visual-regression-report.txt for details');
      process.exit(1);
    } else {
      console.log('\n✅ Visual regression test PASSED - all pages within 2% threshold');
    }
    
  } catch (error) {
    console.error('❌ Visual regression testing failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, compareImages };
