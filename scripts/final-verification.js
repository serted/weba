#!/usr/bin/env node

/**
 * Final Verification Script
 * 
 * Performs comprehensive testing and validation to ensure pixel-perfect 
 * replication of https://pc.dfbiu.com/ across all user states and pages.
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const LOCAL_BASE_URL = 'http://localhost:5000';
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

// Test configurations
const USER_STATES = ['guest', 'user', 'admin'];
const TEST_SUITES = {
  'baseline-capture': {
    name: 'Baseline Capture',
    script: 'collect-baseline.js',
    description: 'Capture all pages from original site'
  },
  'visual-regression': {
    name: 'Visual Regression',
    script: 'visual-regression.js',
    description: 'Compare screenshots with 2% threshold'
  },
  'html-diff': {
    name: 'HTML Structure Diff',
    script: 'html-diff.js', 
    description: 'Compare DOM structure and CSS'
  },
  'har-diff': {
    name: 'Network HAR Diff',
    script: 'har-diff.js',
    description: 'Compare API calls and network requests'
  },
  'cypress-e2e': {
    name: 'Cypress E2E Tests',
    command: 'npx cypress run --headless',
    description: 'Run all Cypress tests including modals and auth'
  },
  'phpunit': {
    name: 'PHPUnit Tests',
    command: 'vendor/bin/phpunit --configuration tests/phpunit.xml',
    description: 'Run PHP unit tests'
  }
};

async function ensureDirectories() {
  const dirs = [REPORTS_DIR, SCREENSHOTS_DIR];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function checkServerHealth() {
  console.log('🏥 Checking server health...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Check health endpoint
    const healthResponse = await page.goto(`${LOCAL_BASE_URL}/health`, { timeout: 10000 });
    const healthStatus = healthResponse?.status();
    
    if (healthStatus === 200) {
      const healthData = await page.textContent('body');
      console.log('✅ Health endpoint OK:', healthData);
      return { healthy: true, details: healthData };
    } else {
      console.error(`❌ Health endpoint returned ${healthStatus}`);
      return { healthy: false, error: `HTTP ${healthStatus}` };
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return { healthy: false, error: error.message };
  } finally {
    await browser.close();
  }
}

async function runTestSuite(suiteName, suiteConfig) {
  console.log(`\n🧪 Running ${suiteConfig.name}...`);
  console.log(`📋 ${suiteConfig.description}`);
  
  const startTime = Date.now();
  
  try {
    let result;
    
    if (suiteConfig.script) {
      // Run Node.js script
      const scriptPath = path.join(__dirname, suiteConfig.script);
      const command = `node "${scriptPath}"`;
      
      result = execSync(command, { 
        encoding: 'utf8', 
        timeout: 300000, // 5 minutes timeout
        stdio: 'pipe'
      });
      
    } else if (suiteConfig.command) {
      // Run shell command
      result = execSync(suiteConfig.command, { 
        encoding: 'utf8',
        timeout: 300000,
        stdio: 'pipe'
      });
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ ${suiteConfig.name} completed in ${duration}ms`);
    
    return {
      suite: suiteName,
      name: suiteConfig.name,
      status: 'passed',
      duration,
      output: result?.toString().substring(0, 1000) // Limit output size
    };
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`❌ ${suiteConfig.name} failed:`, error.message);
    
    return {
      suite: suiteName,
      name: suiteConfig.name,
      status: 'failed',
      duration,
      error: error.message,
      output: error.stdout?.toString().substring(0, 1000),
      stderr: error.stderr?.toString().substring(0, 1000)
    };
  }
}

async function runModalTests() {
  console.log('\n🪟 Running comprehensive modal tests...');
  
  try {
    const cypressResult = execSync('npx cypress run --spec "cypress/e2e/modal.cy.js" --headless', {
      encoding: 'utf8',
      timeout: 180000,
      stdio: 'pipe'
    });
    
    console.log('✅ Modal tests completed successfully');
    return { status: 'passed', output: cypressResult };
    
  } catch (error) {
    console.error('❌ Modal tests failed:', error.message);
    return { 
      status: 'failed', 
      error: error.message,
      output: error.stdout?.toString(),
      stderr: error.stderr?.toString()
    };
  }
}

async function runAuthFlowTests() {
  console.log('\n🔐 Running authentication flow tests...');
  
  try {
    const cypressResult = execSync('npx cypress run --spec "cypress/e2e/auth-ui.cy.js" --headless', {
      encoding: 'utf8',
      timeout: 180000,
      stdio: 'pipe'
    });
    
    console.log('✅ Auth flow tests completed successfully');
    return { status: 'passed', output: cypressResult };
    
  } catch (error) {
    console.error('❌ Auth flow tests failed:', error.message);
    return { 
      status: 'failed', 
      error: error.message,
      output: error.stdout?.toString(),
      stderr: error.stderr?.toString()
    };
  }
}

async function generateFinalReport(testResults, healthCheck, modalTests, authTests) {
  console.log('\n📊 Generating comprehensive final report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    summary: {
      total_tests: Object.keys(TEST_SUITES).length + 2, // +2 for modal and auth
      passed: testResults.filter(r => r.status === 'passed').length + 
             (modalTests.status === 'passed' ? 1 : 0) +
             (authTests.status === 'passed' ? 1 : 0),
      failed: testResults.filter(r => r.status === 'failed').length +
             (modalTests.status === 'failed' ? 1 : 0) +
             (authTests.status === 'failed' ? 1 : 0),
      server_health: healthCheck.healthy
    },
    health_check: healthCheck,
    test_results: testResults,
    modal_tests: modalTests,
    auth_tests: authTests,
    user_states_tested: USER_STATES,
    recommendations: []
  };
  
  // Add recommendations based on results
  if (!healthCheck.healthy) {
    report.recommendations.push('Fix server health issues before deployment');
  }
  
  if (testResults.some(r => r.status === 'failed')) {
    report.recommendations.push('Address failed test suites before proceeding');
  }
  
  if (modalTests.status === 'failed') {
    report.recommendations.push('Fix modal interaction issues');
  }
  
  if (authTests.status === 'failed') {
    report.recommendations.push('Fix authentication flow problems');
  }
  
  // Calculate overall success rate
  const totalTests = report.summary.total_tests;
  const passedTests = report.summary.passed;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  report.overall_success_rate = `${successRate}%`;
  report.deployment_ready = successRate >= 95 && healthCheck.healthy;
  
  // Write JSON report
  const jsonReportPath = path.join(REPORTS_DIR, 'final-verification-report.json');
  await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
  
  // Write human-readable report
  const textReportPath = path.join(REPORTS_DIR, 'final-verification-report.txt');
  let textReport = '';
  textReport += '=== FINAL VERIFICATION REPORT ===\n';
  textReport += `Generated: ${report.timestamp}\n`;
  textReport += `Overall Success Rate: ${report.overall_success_rate}\n`;
  textReport += `Deployment Ready: ${report.deployment_ready ? 'YES' : 'NO'}\n\n`;
  
  textReport += 'SUMMARY:\n';
  textReport += `- Total Tests: ${report.summary.total_tests}\n`;
  textReport += `- Passed: ${report.summary.passed}\n`;
  textReport += `- Failed: ${report.summary.failed}\n`;
  textReport += `- Server Health: ${report.summary.server_health ? 'OK' : 'FAILED'}\n\n`;
  
  textReport += 'TEST SUITE RESULTS:\n';
  testResults.forEach(result => {
    textReport += `- ${result.name}: ${result.status.toUpperCase()}`;
    if (result.duration) {
      textReport += ` (${result.duration}ms)`;
    }
    textReport += '\n';
  });
  
  textReport += `- Modal Tests: ${modalTests.status.toUpperCase()}\n`;
  textReport += `- Auth Flow Tests: ${authTests.status.toUpperCase()}\n\n`;
  
  if (report.recommendations.length > 0) {
    textReport += 'RECOMMENDATIONS:\n';
    report.recommendations.forEach(rec => {
      textReport += `- ${rec}\n`;
    });
    textReport += '\n';
  }
  
  textReport += 'USER STATES TESTED:\n';
  USER_STATES.forEach(state => {
    textReport += `- ${state.toUpperCase()}\n`;
  });
  
  await fs.writeFile(textReportPath, textReport);
  
  console.log('📄 Final reports generated:');
  console.log(`   JSON: ${jsonReportPath}`);
  console.log(`   Text: ${textReportPath}`);
  
  return report;
}

async function main() {
  console.log('🚀 Starting Final Verification Process...');
  console.log('=========================================');
  
  await ensureDirectories();
  
  // Check server health first
  const healthCheck = await checkServerHealth();
  if (!healthCheck.healthy) {
    console.error('❌ Server is not healthy. Please fix health issues before proceeding.');
    process.exit(1);
  }
  
  // Run all test suites
  const testResults = [];
  for (const [suiteName, suiteConfig] of Object.entries(TEST_SUITES)) {
    const result = await runTestSuite(suiteName, suiteConfig);
    testResults.push(result);
  }
  
  // Run specialized tests
  const modalTests = await runModalTests();
  const authTests = await runAuthFlowTests();
  
  // Generate comprehensive report
  const finalReport = await generateFinalReport(testResults, healthCheck, modalTests, authTests);
  
  // Print final summary
  console.log('\n' + '='.repeat(50));
  console.log('🎯 FINAL VERIFICATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`📊 Overall Success Rate: ${finalReport.overall_success_rate}`);
  console.log(`🚀 Deployment Ready: ${finalReport.deployment_ready ? 'YES' : 'NO'}`);
  console.log(`✅ Passed Tests: ${finalReport.summary.passed}/${finalReport.summary.total_tests}`);
  console.log(`❌ Failed Tests: ${finalReport.summary.failed}/${finalReport.summary.total_tests}`);
  console.log(`🏥 Server Health: ${finalReport.summary.server_health ? 'OK' : 'FAILED'}`);
  
  if (finalReport.deployment_ready) {
    console.log('\n🎉 All tests passed! Ready for deployment.');
    console.log('📦 Proceed with packaging using: npm run pack');
  } else {
    console.log('\n⚠️  Some issues detected. Please review the report and fix before deployment.');
    if (finalReport.recommendations.length > 0) {
      console.log('\n📋 Recommendations:');
      finalReport.recommendations.forEach(rec => {
        console.log(`   - ${rec}`);
      });
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Final verification failed:', error);
    process.exit(1);
  });
}

module.exports = { main };