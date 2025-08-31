
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
const { PAGES_TO_CAPTURE } = require('./collect-baseline.js');

async function ensureDirectories() {
  const dirs = [CURRENT_DIR, DIFF_DIR, REPORTS_DIR];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  console.log('✓ Output directories ensured');
}

async function captureCurrentScreenshots(page) {
  console.log('📸 Capturing current screenshots...');
  
  const results = [];
  
  for (const pageInfo of PAGES_TO_CAPTURE) {
    const { name, url } = pageInfo;
    console.log(`Capturing current: ${name}`);
    
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
        path: `${CURRENT_DIR}/${name}.png`,
        fullPage: true 
      });
      
      results.push({ name, success: true });
      
    } catch (error) {
      console.error(`Error capturing ${name}: ${error.message}`);
      results.push({ name, success: false, error: error.message });
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
    summary: {
      total_pages: PAGES_TO_CAPTURE.length,
      successful_captures: captureResults.filter(r => r.success).length,
      failed_captures: captureResults.filter(r => !r.success).length,
      comparisons_performed: comparisonResults.length,
      similar_pages: comparisonResults.filter(r => r.status === 'similar').length,
      different_pages: comparisonResults.filter(r => r.status === 'different').length,
      missing_baselines: comparisonResults.filter(r => r.status === 'missing_baseline').length,
      errors: comparisonResults.filter(r => r.status === 'error').length
    },
    results: comparisonResults,
    capture_results: captureResults
  };
  
  // Write JSON report
  const jsonReportPath = path.join(REPORTS_DIR, 'visual-regression-report.json');
  await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
  
  // Write human-readable report
  const textReportPath = path.join(REPORTS_DIR, 'visual-regression-report.txt');
  let textReport = '';
  textReport += '=== Visual Regression Test Report ===\n';
  textReport += `Generated: ${report.timestamp}\n\n`;
  textReport += 'SUMMARY:\n';
  textReport += `- Total pages tested: ${report.summary.total_pages}\n`;
  textReport += `- Successful captures: ${report.summary.successful_captures}\n`;
  textReport += `- Failed captures: ${report.summary.failed_captures}\n`;
  textReport += `- Similar pages (≤2% diff): ${report.summary.similar_pages}\n`;
  textReport += `- Different pages (>2% diff): ${report.summary.different_pages}\n`;
  textReport += `- Missing baselines: ${report.summary.missing_baselines}\n`;
  textReport += `- Comparison errors: ${report.summary.errors}\n\n`;
  
  textReport += 'DETAILED RESULTS:\n';
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
  console.log('🔍 Starting visual regression testing...');
  
  await ensureDirectories();
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // Capture current screenshots
    const captureResults = await captureCurrentScreenshots(page);
    
    // Compare with baseline
    console.log('🔄 Comparing with baseline images...');
    const comparisonResults = [];
    
    for (const pageInfo of PAGES_TO_CAPTURE) {
      const { name } = pageInfo;
      const baselinePath = path.join(BASELINE_DIR, `${name}.png`);
      const currentPath = path.join(CURRENT_DIR, `${name}.png`);
      const diffPath = path.join(DIFF_DIR, `${name}-diff.png`);
      
      console.log(`Comparing: ${name}`);
      const comparison = await compareImages(baselinePath, currentPath, diffPath);
      comparisonResults.push({ name, ...comparison });
      
      if (comparison.status === 'different') {
        console.log(`⚠️  ${name}: ${comparison.diffPercentage}% difference (threshold: 2%)`);
      } else if (comparison.status === 'similar') {
        console.log(`✅ ${name}: ${comparison.diffPercentage}% difference`);
      } else {
        console.log(`❌ ${name}: ${comparison.status}${comparison.error ? ` - ${comparison.error}` : ''}`);
      }
    }
    
    // Generate comprehensive report
    const report = await generateReport(comparisonResults, captureResults);
    
    // Print summary
    console.log('\n📊 VISUAL REGRESSION SUMMARY:');
    console.log(`✅ Similar pages (≤2%): ${report.summary.similar_pages}`);
    console.log(`⚠️  Different pages (>2%): ${report.summary.different_pages}`);
    console.log(`❌ Missing/errors: ${report.summary.missing_baselines + report.summary.errors}`);
    
    // Exit with error code if there are significant differences
    if (report.summary.different_pages > 0) {
      console.log('\n❌ Visual regression test failed - significant differences detected');
      process.exit(1);
    } else {
      console.log('\n✅ Visual regression test passed - all pages within threshold');
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
