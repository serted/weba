#!/usr/bin/env node

/**
 * Playwright Baseline Capture Script
 * 
 * This script logs into the original site (https://pc.dfbiu.com/) with credentials test228/test228,
 * navigates through all 14 pages, and captures:
 * - Screenshots (baseline/[page].png)
 * - HTML content (baseline/[page].html) 
 * - CSS stylesheets (baseline/styles.css)
 * - HAR network logs (baseline/[page].har)
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://pc.dfbiu.com';
const LOGIN_USERNAME = 'test228';
const LOGIN_PASSWORD = 'test228';
const BASELINE_DIR = path.join(__dirname, '..', 'baseline');

// Define all 14 pages to capture with user state requirements
const PAGES_TO_CAPTURE = [
  { name: 'home', url: '/', requiresAuth: false, states: ['guest', 'user', 'admin'] },
  { name: 'login', url: '/login', requiresAuth: false, states: ['guest'] },
  { name: 'register', url: '/register', requiresAuth: false, states: ['guest'] },
  { name: 'dashboard', url: '/dashboard', requiresAuth: true, states: ['user', 'admin'] },
  { name: 'profile', url: '/profile', requiresAuth: true, states: ['user', 'admin'] },
  { name: 'settings', url: '/settings', requiresAuth: true, states: ['user', 'admin'] },
  { name: 'admin-users', url: '/admin/users', requiresAuth: true, states: ['admin'] },
  { name: 'admin-roles', url: '/admin/roles', requiresAuth: true, states: ['admin'] },
  { name: 'admin-logs', url: '/admin/logs', requiresAuth: true, states: ['admin'] },
  { name: 'api-docs', url: '/api/docs', requiresAuth: false, states: ['guest', 'user', 'admin'] },
  { name: 'help', url: '/help', requiresAuth: false, states: ['guest', 'user', 'admin'] },
  { name: 'contact', url: '/contact', requiresAuth: false, states: ['guest', 'user', 'admin'] },
  { name: 'about', url: '/about', requiresAuth: false, states: ['guest', 'user', 'admin'] },
  { name: 'terms', url: '/terms', requiresAuth: false, states: ['guest', 'user', 'admin'] }
];

// User credentials for different states
const USER_CREDENTIALS = {
  user: { username: 'test228', password: 'test228' },
  admin: { username: 'test228', password: 'test228' } // Same user but may have admin rights
};

async function ensureBaselineDir() {
  try {
    await fs.mkdir(BASELINE_DIR, { recursive: true });
    console.log(`✓ Baseline directory created: ${BASELINE_DIR}`);
  } catch (error) {
    console.error(`Error creating baseline directory: ${error.message}`);
    throw error;
  }
}

async function loginToSite(page, userState = 'user') {
  if (userState === 'guest') {
    console.log('👤 Using guest state (no login)');
    return;
  }
  
  const credentials = USER_CREDENTIALS[userState] || USER_CREDENTIALS.user;
  console.log(`🔐 Logging into original site as ${userState}...`);
  
  try {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    
    // Fill login form
    await page.fill('input[name="username"], input[name="email"], #username, #email', credentials.username);
    await page.fill('input[name="password"], #password', credentials.password);
    
    // Submit form
    await page.click('button[type="submit"], input[type="submit"], .btn-login, .login-btn');
    
    // Wait for successful login (check for redirect or dashboard elements)
    await page.waitForLoadState('networkidle');
    
    // Verify login success by checking for logout button or dashboard elements
    const loggedIn = await page.locator('a[href*="logout"], .logout, .dashboard, .profile-menu').first().isVisible();
    
    if (loggedIn) {
      console.log(`✓ Successfully logged in as ${userState}`);
    } else {
      console.warn(`⚠ Login as ${userState} may have failed - continuing anyway`);
    }
    
  } catch (error) {
    console.error(`Login error for ${userState}: ${error.message}`);
    // Continue anyway - some pages might be accessible without login
  }
}

async function capturePage(page, pageInfo, userState) {
  const { name, url, requiresAuth } = pageInfo;
  const filename = userState ? `${name}-${userState}` : name;
  console.log(`📸 Capturing page: ${name} (${url}) as ${userState || 'guest'}`);
  
  try {
    // Start HAR recording for this page
    await page.routeFromHAR(`${BASELINE_DIR}/${filename}.har`, { 
      url: '*/**',
      update: true,
      notFound: 'continue'
    });
    
    // Navigate to the page
    await page.goto(`${BASE_URL}${url}`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for page to fully load
    await page.waitForTimeout(2000);
    
    // Handle any modals that might be open
    try {
      await page.locator('.modal, .popup, .dialog').first().waitFor({ timeout: 1000 });
      // If modal exists, capture it both open and closed
      await page.screenshot({ 
        path: `${BASELINE_DIR}/${filename}-modal.png`,
        fullPage: true 
      });
      
      // Close modal with Esc key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      // Try clicking close button if Esc didn't work
      await page.locator('.close, .modal-close, [aria-label="close"], .btn-close').first().click();
      await page.waitForTimeout(500);
    } catch (error) {
      // No modal found, continue
    }
    
    // Capture screenshot
    await page.screenshot({ 
      path: `${BASELINE_DIR}/${filename}.png`,
      fullPage: true 
    });
    
    // Capture HTML content
    const htmlContent = await page.content();
    await fs.writeFile(`${BASELINE_DIR}/${filename}.html`, htmlContent, 'utf8');
    
    // Capture CSS if this is the first page of the first state
    if (name === 'home' && userState === 'guest') {
      try {
        const stylesheets = await page.locator('link[rel="stylesheet"]').all();
        let allCSS = '';
        
        for (const stylesheet of stylesheets) {
          const href = await stylesheet.getAttribute('href');
          if (href) {
            try {
              const cssUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
              const response = await page.request.get(cssUrl);
              const css = await response.text();
              allCSS += `/* ${cssUrl} */\n${css}\n\n`;
            } catch (cssError) {
              console.warn(`Could not fetch CSS from ${href}: ${cssError.message}`);
            }
          }
        }
        
        // Also capture inline styles
        const inlineStyles = await page.locator('style').allTextContents();
        for (const [index, style] of inlineStyles.entries()) {
          allCSS += `/* Inline style ${index + 1} */\n${style}\n\n`;
        }
        
        await fs.writeFile(`${BASELINE_DIR}/styles.css`, allCSS, 'utf8');
        console.log('✓ CSS styles captured');
      } catch (cssError) {
        console.warn(`Could not capture CSS: ${cssError.message}`);
      }
    }
    
    console.log(`✓ Captured ${filename} successfully`);
    
  } catch (error) {
    console.error(`Error capturing ${filename}: ${error.message}`);
    
    // Still try to capture a screenshot even if there was an error
    try {
      await page.screenshot({ 
        path: `${BASELINE_DIR}/${filename}-error.png`,
        fullPage: true 
      });
    } catch (screenshotError) {
      console.error(`Could not capture error screenshot: ${screenshotError.message}`);
    }
  }
}

async function testModalInteractions(page, pageInfo, userState) {
  const { name, url } = pageInfo;
  const filename = userState ? `${name}-${userState}` : name;
  console.log(`🪟 Testing modal interactions for: ${filename}`);
  
  try {
    await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Look for buttons that might open modals
    const modalTriggers = await page.locator(
      'button:has-text("Add"), button:has-text("Edit"), button:has-text("Delete"), ' +
      'button:has-text("Create"), button:has-text("New"), .btn-modal, [data-toggle="modal"], ' +
      '[data-bs-toggle="modal"], .open-modal, .btn-primary, .btn-secondary'
    ).all();
    
    console.log(`Found ${modalTriggers.length} potential modal triggers`);
    
    for (const [index, trigger] of modalTriggers.entries()) {
      try {
        const isVisible = await trigger.isVisible();
        if (!isVisible) continue;
        
        console.log(`Testing modal trigger ${index + 1}...`);
        
        // Click trigger to open modal
        await trigger.click();
        await page.waitForTimeout(1500);
        
        // Check if modal is now visible
        const modal = page.locator('.modal, .popup, .dialog, .overlay').first();
        const modalVisible = await modal.isVisible();
        
        if (modalVisible) {
          console.log(`✓ Modal ${index + 1} opened successfully`);
          
          // Capture modal screenshot
          await page.screenshot({ 
            path: `${BASELINE_DIR}/${filename}-modal-${index + 1}-open.png`,
            fullPage: true 
          });
          
          // Test different ways to close modal
          let closed = false;
          
          // 1. Try Esc key
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
          
          if (!(await modal.isVisible())) {
            console.log(`✓ Modal ${index + 1} closed with Esc key`);
            closed = true;
          }
          
          // 2. Try clicking close button
          if (!closed) {
            const closeButton = page.locator('.close, .modal-close, [aria-label="close"], .btn-close, .modal-header .btn, [data-dismiss="modal"]').first();
            if (await closeButton.isVisible()) {
              await closeButton.click();
              await page.waitForTimeout(1000);
              
              if (!(await modal.isVisible())) {
                console.log(`✓ Modal ${index + 1} closed with close button`);
                closed = true;
              }
            }
          }
          
          // 3. Try clicking outside modal (backdrop)
          if (!closed) {
            await page.click('body', { position: { x: 50, y: 50 } });
            await page.waitForTimeout(1000);
            
            if (!(await modal.isVisible())) {
              console.log(`✓ Modal ${index + 1} closed with backdrop click`);
              closed = true;
            }
          }
          
          // Capture closed state
          await page.screenshot({ 
            path: `${BASELINE_DIR}/${filename}-modal-${index + 1}-closed.png`,
            fullPage: true 
          });
          
          if (!closed) {
            console.warn(`⚠ Modal ${index + 1} could not be closed - forcing page reload`);
            await page.reload({ waitUntil: 'networkidle' });
          }
          
        } else {
          console.log(`- Trigger ${index + 1} did not open a modal`);
        }
        
        // Small delay between tests
        await page.waitForTimeout(500);
        
      } catch (modalError) {
        console.warn(`Modal test ${index + 1} failed: ${modalError.message}`);
        // Try to recover by reloading the page
        try {
          await page.reload({ waitUntil: 'networkidle' });
        } catch (reloadError) {
          console.error(`Could not reload page: ${reloadError.message}`);
        }
      }
    }
    
    console.log(`✓ Modal testing completed for ${filename}`);
    
  } catch (error) {
    console.error(`Error testing modals for ${filename}: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting comprehensive baseline capture process for all user states...');
  
  // Ensure baseline directory exists
  await ensureBaselineDir();
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  
  const userStates = ['guest', 'user', 'admin'];
  let totalCaptured = 0;
  
  try {
    for (const userState of userStates) {
      console.log(`\n🔄 Processing ${userState.toUpperCase()} state...`);
      
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ignoreHTTPSErrors: true
      });
      
      const page = await context.newPage();
      
      // Login based on user state
      await loginToSite(page, userState);
      
      // Filter pages based on what's accessible to this user state
      const accessiblePages = PAGES_TO_CAPTURE.filter(pageInfo => 
        pageInfo.states.includes(userState)
      );
      
      console.log(`📋 Capturing ${accessiblePages.length} pages for ${userState} state`);
      
      // Capture each accessible page
      for (const pageInfo of accessiblePages) {
        await capturePage(page, pageInfo, userState);
        totalCaptured++;
        
        // Test modal interactions for pages that likely have them
        if (['dashboard', 'admin-users', 'admin-roles', 'profile', 'settings'].includes(pageInfo.name)) {
          await testModalInteractions(page, pageInfo, userState);
        }
        
        // Small delay between pages
        await page.waitForTimeout(1500);
      }
      
      // Close context for this user state
      await context.close();
      console.log(`✅ ${userState.toUpperCase()} state completed`);
    }
    
    console.log('\n🎉 Comprehensive baseline capture completed successfully!');
    console.log(`📊 Total captures: ${totalCaptured} pages across ${userStates.length} user states`);
    console.log(`📁 Files saved to: ${BASELINE_DIR}`);
    
    // List captured files with categorization
    const files = await fs.readdir(BASELINE_DIR);
    const screenshots = files.filter(f => f.endsWith('.png'));
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    const harFiles = files.filter(f => f.endsWith('.har'));
    
    console.log('\n📋 Capture Summary:');
    console.log(`   📸 Screenshots: ${screenshots.length}`);
    console.log(`   📄 HTML files: ${htmlFiles.length}`);
    console.log(`   🔍 HAR files: ${harFiles.length}`);
    console.log(`   📁 Total files: ${files.length}`);
    
    // Save capture metadata
    const metadata = {
      captureDate: new Date().toISOString(),
      userStates: userStates,
      totalPages: totalCaptured,
      files: {
        screenshots: screenshots.length,
        html: htmlFiles.length,
        har: harFiles.length,
        total: files.length
      },
      pages: PAGES_TO_CAPTURE.map(p => ({
        name: p.name,
        url: p.url,
        states: p.states
      }))
    };
    
    await fs.writeFile(`${BASELINE_DIR}/capture-metadata.json`, JSON.stringify(metadata, null, 2));
    console.log('💾 Capture metadata saved');
    
  } catch (error) {
    console.error('❌ Baseline capture failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, PAGES_TO_CAPTURE, BASELINE_DIR };