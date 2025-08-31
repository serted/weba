
const puppeteer = require('puppeteer');
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const SCREENSHOTS_DIR = './reports/screenshots';
const BASELINE_DIR = './cypress/fixtures/baseline';

// Создаем директории если их нет
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
}

async function takeScreenshots() {
    console.log('🚀 Запуск визуального тестирования...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const pages = [
        { name: 'homepage', url: '/' },
        { name: 'login', url: '/login' },
        { name: 'register', url: '/register' },
        { name: 'admin', url: '/admin' }
    ];
    
    let totalDiff = 0;
    let pagesChecked = 0;
    
    for (const pageInfo of pages) {
        try {
            console.log(`📸 Создание скриншота: ${pageInfo.name}`);
            
            await page.goto(`${BASE_URL}${pageInfo.url}`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            // Ждем загрузки контента
            await page.waitForTimeout(2000);
            
            const screenshotPath = path.join(SCREENSHOTS_DIR, `${pageInfo.name}.png`);
            await page.screenshot({ 
                path: screenshotPath,
                fullPage: true 
            });
            
            // Сравниваем с baseline если он существует
            const baselinePath = path.join(BASELINE_DIR, `${pageInfo.name}.png`);
            
            if (fs.existsSync(baselinePath)) {
                const diff = await compareImages(baselinePath, screenshotPath);
                console.log(`📊 Различие для ${pageInfo.name}: ${diff.percentage.toFixed(2)}%`);
                totalDiff += diff.percentage;
                pagesChecked++;
                
                if (diff.percentage > 2) {
                    console.log(`⚠️  Визуальное различие превышает порог для ${pageInfo.name}`);
                }
            } else {
                console.log(`📁 Создан baseline для ${pageInfo.name}`);
                fs.copyFileSync(screenshotPath, baselinePath);
            }
            
        } catch (error) {
            console.error(`❌ Ошибка при обработке ${pageInfo.name}:`, error.message);
        }
    }
    
    await browser.close();
    
    const averageDiff = pagesChecked > 0 ? totalDiff / pagesChecked : 0;
    console.log(`📊 Средний процент различий: ${averageDiff.toFixed(2)}%`);
    
    // Сохраняем отчет
    const report = {
        timestamp: new Date().toISOString(),
        averageDifference: averageDiff,
        threshold: 2,
        passed: averageDiff <= 2,
        pages: pages.length,
        pagesChecked: pagesChecked
    };
    
    fs.writeFileSync(
        path.join(SCREENSHOTS_DIR, 'visual-report.json'), 
        JSON.stringify(report, null, 2)
    );
    
    return averageDiff <= 2;
}

async function compareImages(baselinePath, currentPath) {
    const PNG = require('pngjs').PNG;
    
    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const current = PNG.sync.read(fs.readFileSync(currentPath));
    
    const { width, height } = baseline;
    const diff = new PNG({ width, height });
    
    const numDiffPixels = pixelmatch(
        baseline.data, 
        current.data, 
        diff.data, 
        width, 
        height,
        { threshold: 0.1 }
    );
    
    const totalPixels = width * height;
    const percentage = (numDiffPixels / totalPixels) * 100;
    
    // Сохраняем diff изображение
    const diffPath = currentPath.replace('.png', '-diff.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    
    return {
        numDiffPixels,
        totalPixels,
        percentage
    };
}

takeScreenshots()
    .then(passed => {
        console.log(passed ? '✅ Визуальные тесты прошли' : '❌ Визуальные тесты провалились');
        process.exit(passed ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    });
