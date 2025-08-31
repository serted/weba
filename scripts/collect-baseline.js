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

// Define all 14 pages to capture
const PAGES_TO_CAPTURE = [
  { name: 'home', url: '/', requiresAuth: false },
  { name: 'login', url: '/login', requiresAuth: false },
  { name: 'register', url: '/register', requiresAuth: false },
  { name: 'dashboard', url: '/dashboard', requiresAuth: true },
  { name: 'profile', url: '/profile', requiresAuth: true },
  { name: 'settings', url: '/settings', requiresAuth: true },
  { name: 'admin-users', url: '/admin/users', requiresAuth: true },
  { name: 'admin-roles', url: '/admin/roles', requiresAuth: true },
  { name: 'admin-logs', url: '/admin/logs', requiresAuth: true },
  { name: 'api-docs', url: '/api/docs', requiresAuth: false },
  { name: 'help', url: '/help', requiresAuth: false },
  { name: 'contact', url: '/contact', requiresAuth: false },
  { name: 'about', url: '/about', requiresAuth: false },
  { name: 'terms', url: '/terms', requiresAuth: false }
];

async function ensureBaselineDir() {
  try {
    await fs.mkdir(BASELINE_DIR, { recursive: true });
    console.log(`✓ Baseline directory created: ${BASELINE_DIR}`);
  } catch (error) {
    console.error(`Error creating baseline directory: ${error.message}`);
    throw error;
  }
}

async function loginToSite(page) {
  console.log('🔐 Logging into original site...');
  
  try {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    
    // Fill login form
    await page.fill('input[name="username"], input[name="email"], #username, #email', LOGIN_USERNAME);
    await page.fill('input[name="password"], #password', LOGIN_PASSWORD);
    
    // Submit form
    await page.click('button[type="submit"], input[type="submit"], .btn-login, .login-btn');
    
    // Wait for successful login (check for redirect or dashboard elements)
    await page.waitForLoadState('networkidle');
    
    // Verify login success by checking for logout button or dashboard elements
    const loggedIn = await page.locator('a[href*="logout"], .logout, .dashboard, .profile-menu').first().isVisible();
    
    if (loggedIn) {
      console.log('✓ Successfully logged in');
    } else {
      console.warn('⚠ Login may have failed - continuing anyway');
    }
    
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    // Continue anyway - some pages might be accessible without login
  }
}

async function capturePage(page, pageInfo) {
  const { name, url, requiresAuth } = pageInfo;
  console.log(`📸 Capturing page: ${name} (${url})`);
  
  try {
    // Start HAR recording for this page
    await page.routeFromHAR(`${BASELINE_DIR}/${name}.har`, { 
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
        path: `${BASELINE_DIR}/${name}-modal.png`,
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
      path: `${BASELINE_DIR}/${name}.png`,
      fullPage: true 
    });
    
    // Capture HTML content
    const htmlContent = await page.content();
    await fs.writeFile(`${BASELINE_DIR}/${name}.html`, htmlContent, 'utf8');
    
    // Capture CSS if this is the first page
    if (name === 'home') {
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
    
    console.log(`✓ Captured ${name} successfully`);
    
  } catch (error) {
    console.error(`Error capturing ${name}: ${error.message}`);
    
    // Still try to capture a screenshot even if there was an error
    try {
      await page.screenshot({ 
        path: `${BASELINE_DIR}/${name}-error.png`,
        fullPage: true 
      });
    } catch (screenshotError) {
      console.error(`Could not capture error screenshot: ${screenshotError.message}`);
    }
  }
}

async function testModalInteractions(page, pageInfo) {
  const { name, url } = pageInfo;
  console.log(`🪟 Testing modal interactions for: ${name}`);
  
  try {
    await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle' });
    
    // Look for buttons that might open modals
    const modalTriggers = await page.locator(
      'button:has-text("Add"), button:has-text("Edit"), button:has-text("Delete"), ' +
      'button:has-text("Create"), button:has-text("New"), .btn-modal, [data-toggle="modal"], ' +
      '[data-bs-toggle="modal"], .open-modal'
    ).all();
    
    for (const [index, trigger] of modalTriggers.entries()) {
      try {
        // Click trigger to open modal
        await trigger.click();
        await page.waitForTimeout(1000);
        
        // Check if modal is now visible
        const modal = page.locator('.modal, .popup, .dialog').first();
        if (await modal.isVisible()) {
          // Capture modal screenshot
          await page.screenshot({ 
            path: `${BASELINE_DIR}/${name}-modal-${index + 1}.png`,
            fullPage: true 
          });
          
          // Test different ways to close modal
          // 1. Esc key
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          
          if (await modal.isVisible()) {
            // 2. Click close button
            await page.locator('.close, .modal-close, [aria-label="close"], .btn-close').first().click();
            await page.waitForTimeout(500);
          }
          
          if (await modal.isVisible()) {
            // 3. Click outside modal
            await page.click('body', { position: { x: 10, y: 10 } });
            await page.waitForTimeout(500);
          }
          
          console.log(`✓ Modal ${index + 1} tested successfully`);
        }
      } catch (modalError) {
        console.warn(`Modal test ${index + 1} failed: ${modalError.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error testing modals for ${name}: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting baseline capture process...');
  
  // Ensure baseline directory exists
  await ensureBaselineDir();
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ignoreHTTPSErrors: true
    });
    
    const page = await context.newPage();
    
    // Login to the site first
    await loginToSite(page);
    
    // Capture each page
    for (const pageInfo of PAGES_TO_CAPTURE) {
      await capturePage(page, pageInfo);
      
      // Test modal interactions for pages that likely have them
      if (['dashboard', 'admin-users', 'admin-roles'].includes(pageInfo.name)) {
        await testModalInteractions(page, pageInfo);
      }
      
      // Small delay between pages
      await page.waitForTimeout(1000);
    }
    
    console.log('✅ Baseline capture completed successfully!');
    console.log(`📁 Files saved to: ${BASELINE_DIR}`);
    
    // List captured files
    const files = await fs.readdir(BASELINE_DIR);
    console.log('📋 Captured files:');
    files.forEach(file => console.log(`   - ${file}`));
    
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