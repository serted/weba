#!/usr/bin/env node

/**
 * HTML & CSS Diff Testing Script
 * 
 * This script compares HTML structures and CSS styles between the original site
 * and our local implementation to ensure structural compatibility.
 */

const { chromium } = require('playwright');
const { diffLines, diffWords } = require('diff');
const fs = require('fs').promises;
const path = require('path');

const ORIGINAL_BASE_URL = 'https://pc.dfbiu.com';
const LOCAL_BASE_URL = 'http://localhost:5000';
const BASELINE_DIR = path.join(__dirname, '..', 'baseline');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Import pages from baseline script
const { PAGES_TO_CAPTURE } = require('./collect-baseline.js');

async function ensureDirectories() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  console.log('✓ Reports directory ensured');
}

async function extractPageContent(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get raw HTML
    const rawHtml = await page.content();
    
    // Get cleaned HTML structure (remove dynamic content)
    const cleanedHtml = await page.evaluate(() => {
      // Clone the document to avoid modifying the original
      const doc = document.cloneNode(true);
      
      // Remove script tags
      const scripts = doc.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      
      // Remove style tags (we'll handle CSS separately)
      const styles = doc.querySelectorAll('style');
      styles.forEach(style => style.remove());
      
      // Remove comments
      const walker = document.createTreeWalker(
        doc,
        NodeFilter.SHOW_COMMENT,
        null,
        false
      );
      const comments = [];
      let node;
      while (node = walker.nextNode()) {
        comments.push(node);
      }
      comments.forEach(comment => comment.remove());
      
      // Remove dynamic content that might change
      const dynamicSelectors = [
        '[data-timestamp]',
        '.timestamp',
        '.current-time',
        '.csrf-token',
        'input[name="_token"]',
        'meta[name="csrf-token"]'
      ];
      
      dynamicSelectors.forEach(selector => {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.tagName === 'INPUT' || el.tagName === 'META') {
            el.setAttribute('content', 'DYNAMIC_CONTENT_REMOVED');
            el.setAttribute('value', 'DYNAMIC_CONTENT_REMOVED');
          } else {
            el.textContent = 'DYNAMIC_CONTENT_REMOVED';
          }
        });
      });
      
      return doc.documentElement.outerHTML;
    });
    
    // Get inline CSS
    const inlineCSS = await page.evaluate(() => {
      const styleElements = Array.from(document.querySelectorAll('style'));
      return styleElements.map(style => style.textContent).join('\n');
    });
    
    // Get computed styles for key elements
    const computedStyles = await page.evaluate(() => {
      const keySelectors = [
        'body', 'header', 'nav', 'main', 'footer', '.container',
        '.btn', '.form-control', '.modal', '.alert', '.card'
      ];
      
      const styles = {};
      keySelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const element = elements[0];
          const computedStyle = window.getComputedStyle(element);
          styles[selector] = {
            display: computedStyle.display,
            position: computedStyle.position,
            width: computedStyle.width,
            height: computedStyle.height,
            margin: computedStyle.margin,
            padding: computedStyle.padding,
            backgroundColor: computedStyle.backgroundColor,
            color: computedStyle.color,
            fontSize: computedStyle.fontSize,
            fontFamily: computedStyle.fontFamily
          };
        }
      });
      
      return styles;
    });
    
    return {
      rawHtml,
      cleanedHtml,
      inlineCSS,
      computedStyles,
      url,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error extracting content from ${url}: ${error.message}`);
    return {
      rawHtml: '',
      cleanedHtml: '',
      inlineCSS: '',
      computedStyles: {},
      url,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

async function compareHtmlStructures(originalHtml, localHtml) {
  // Normalize whitespace and line endings
  const normalizeHtml = (html) => {
    return html
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  };
  
  const normalizedOriginal = normalizeHtml(originalHtml);
  const normalizedLocal = normalizeHtml(localHtml);
  
  // Calculate similarity
  const diff = diffWords(normalizedOriginal, normalizedLocal);
  let totalChars = 0;
  let changedChars = 0;
  
  diff.forEach(part => {
    totalChars += part.value.length;
    if (part.added || part.removed) {
      changedChars += part.value.length;
    }
  });
  
  const similarity = totalChars > 0 ? ((totalChars - changedChars) / totalChars) * 100 : 0;
  
  // Find structural differences
  const structuralDiffs = [];
  const lines = diffLines(normalizedOriginal, normalizedLocal);
  
  lines.forEach((line, index) => {
    if (line.added || line.removed) {
      structuralDiffs.push({
        type: line.added ? 'added' : 'removed',
        content: line.value.substring(0, 200),
        lineIndex: index
      });
    }
  });
  
  return {
    similarity: similarity.toFixed(2),
    structuralDiffs: structuralDiffs.slice(0, 10), // Limit to first 10 differences
    totalChanges: changedChars,
    totalSize: totalChars
  };
}

async function compareCssStyles(originalStyles, localStyles) {
  const differences = {};
  const allSelectors = new Set([
    ...Object.keys(originalStyles),
    ...Object.keys(localStyles)
  ]);
  
  allSelectors.forEach(selector => {
    const original = originalStyles[selector] || {};
    const local = localStyles[selector] || {};
    
    const selectorDiffs = {};
    const allProperties = new Set([
      ...Object.keys(original),
      ...Object.keys(local)
    ]);
    
    allProperties.forEach(property => {
      const originalValue = original[property];
      const localValue = local[property];
      
      if (originalValue !== localValue) {
        selectorDiffs[property] = {
          original: originalValue,
          local: localValue
        };
      }
    });
    
    if (Object.keys(selectorDiffs).length > 0) {
      differences[selector] = selectorDiffs;
    }
  });
  
  return differences;
}

async function generateHtmlDiffReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_pages: results.length,
      pages_with_differences: results.filter(r => parseFloat(r.htmlComparison.similarity) < 95).length,
      average_html_similarity: (results.reduce((sum, r) => sum + parseFloat(r.htmlComparison.similarity), 0) / results.length).toFixed(2),
      pages_with_css_differences: results.filter(r => Object.keys(r.cssComparison).length > 0).length
    },
    results
  };
  
  // Write JSON report
  const jsonReportPath = path.join(REPORTS_DIR, 'html-diff-report.json');
  await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
  
  // Write human-readable report
  const textReportPath = path.join(REPORTS_DIR, 'html-diff-report.txt');
  let textReport = '';
  textReport += '=== HTML & CSS Diff Report ===\n';
  textReport += `Generated: ${report.timestamp}\n\n`;
  textReport += 'SUMMARY:\n';
  textReport += `- Total pages tested: ${report.summary.total_pages}\n`;
  textReport += `- Average HTML similarity: ${report.summary.average_html_similarity}%\n`;
  textReport += `- Pages with HTML differences (>5%): ${report.summary.pages_with_differences}\n`;
  textReport += `- Pages with CSS differences: ${report.summary.pages_with_css_differences}\n\n`;
  
  textReport += 'DETAILED RESULTS:\n';
  results.forEach(result => {
    textReport += `\n${result.page}:\n`;
    textReport += `  HTML Similarity: ${result.htmlComparison.similarity}%\n`;
    textReport += `  Structural Changes: ${result.htmlComparison.structuralDiffs.length}\n`;
    textReport += `  CSS Differences: ${Object.keys(result.cssComparison).length} selectors\n`;
    
    if (result.htmlComparison.structuralDiffs.length > 0) {
      textReport += `  Top HTML Differences:\n`;
      result.htmlComparison.structuralDiffs.slice(0, 3).forEach(diff => {
        textReport += `    - ${diff.type}: ${diff.content.substring(0, 100)}...\n`;
      });
    }
    
    if (Object.keys(result.cssComparison).length > 0) {
      textReport += `  Top CSS Differences:\n`;
      Object.keys(result.cssComparison).slice(0, 3).forEach(selector => {
        textReport += `    - ${selector}: ${Object.keys(result.cssComparison[selector]).join(', ')}\n`;
      });
    }
  });
  
  await fs.writeFile(textReportPath, textReport);
  
  console.log(`📄 HTML diff reports generated:`);
  console.log(`   JSON: ${jsonReportPath}`);
  console.log(`   Text: ${textReportPath}`);
  
  return report;
}

async function main() {
  console.log('📝 Starting HTML & CSS diff testing...');
  
  await ensureDirectories();
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const results = [];
    
    for (const pageInfo of PAGES_TO_CAPTURE) {
      const { name, url } = pageInfo;
      console.log(`🔍 Analyzing: ${name}`);
      
      const page = await context.newPage();
      
      // Extract content from both sites
      console.log(`  Extracting from local site...`);
      const localContent = await extractPageContent(page, `${LOCAL_BASE_URL}${url}`);
      
      console.log(`  Extracting from original site...`);
      const originalContent = await extractPageContent(page, `${ORIGINAL_BASE_URL}${url}`);
      
      // Compare HTML structures
      const htmlComparison = await compareHtmlStructures(
        originalContent.cleanedHtml,
        localContent.cleanedHtml
      );
      
      // Compare CSS styles
      const cssComparison = await compareCssStyles(
        originalContent.computedStyles,
        localContent.computedStyles
      );
      
      results.push({
        page: name,
        url,
        htmlComparison,
        cssComparison,
        originalUrl: `${ORIGINAL_BASE_URL}${url}`,
        localUrl: `${LOCAL_BASE_URL}${url}`
      });
      
      console.log(`  ✓ HTML similarity: ${htmlComparison.similarity}%`);
      console.log(`  ✓ CSS differences: ${Object.keys(cssComparison).length} selectors`);
      
      await page.close();
    }
    
    // Generate comprehensive report
    const report = await generateHtmlDiffReport(results);
    
    // Print summary
    console.log('\n📊 HTML & CSS DIFF SUMMARY:');
    console.log(`✅ Average HTML similarity: ${report.summary.average_html_similarity}%`);
    console.log(`⚠️  Pages with HTML differences: ${report.summary.pages_with_differences}`);
    console.log(`⚠️  Pages with CSS differences: ${report.summary.pages_with_css_differences}`);
    
    // Exit with error code if there are significant differences
    const hasSignificantDifferences = report.summary.pages_with_differences > 0 || 
                                      parseFloat(report.summary.average_html_similarity) < 90;
    
    if (hasSignificantDifferences) {
      console.log('\n⚠️  HTML/CSS diff test completed with differences - review required');
      // Don't exit with error for HTML differences, just report them
    } else {
      console.log('\n✅ HTML/CSS diff test passed - structures are very similar');
    }
    
  } catch (error) {
    console.error('❌ HTML/CSS diff testing failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, compareHtmlStructures, compareCssStyles };