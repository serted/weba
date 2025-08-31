
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🎨 Запуск визуальной регрессии...');

// Функция для создания скриншота через headless browser
async function takeScreenshot(url, outputPath) {
    return new Promise((resolve, reject) => {
        const phantomjs = spawn('node', ['-e', `
            const puppeteer = require('puppeteer');
            (async () => {
                try {
                    const browser = await puppeteer.launch({headless: true});
                    const page = await browser.newPage();
                    await page.setViewport({width: 1200, height: 800});
                    await page.goto('${url}', {waitUntil: 'networkidle2'});
                    await page.screenshot({path: '${outputPath}', fullPage: true});
                    await browser.close();
                    console.log('Screenshot saved: ${outputPath}');
                } catch(e) {
                    console.error('Screenshot failed:', e.message);
                    process.exit(1);
                }
            })();
        `]);

        phantomjs.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Screenshot failed with code ${code}`));
            }
        });
    });
}

// Функция сравнения изображений
function compareImages(img1Path, img2Path) {
    if (!fs.existsSync(img1Path) || !fs.existsSync(img2Path)) {
        console.log('⚠️ Baseline изображения не найдены, создаем новые...');
        return 100; // Считаем как 100% совпадение для первого запуска
    }

    try {
        const PNG = require('pngjs').PNG;
        const pixelmatch = require('pixelmatch');
        
        const img1 = PNG.sync.read(fs.readFileSync(img1Path));
        const img2 = PNG.sync.read(fs.readFileSync(img2Path));
        const diff = new PNG({width: img1.width, height: img1.height});
        
        const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {threshold: 0.1});
        const totalPixels = img1.width * img1.height;
        const similarity = ((totalPixels - numDiffPixels) / totalPixels) * 100;
        
        // Сохраняем diff изображение
        fs.writeFileSync(img1Path.replace('.png', '-diff.png'), PNG.sync.write(diff));
        
        return similarity;
    } catch (e) {
        console.error('❌ Ошибка сравнения изображений:', e.message);
        return 0;
    }
}

// Основная функция
async function runVisualRegression() {
    const baseUrl = 'http://localhost:5000';
    const pages = [
        '/',
        '/login',
        '/register',
        '/admin',
        '/category_code_sport.html',
        '/category2_code_game.html'
    ];

    let allTestsPassed = true;
    const results = [];

    // Запускаем сервер
    console.log('🚀 Запуск сервера...');
    const server = spawn('php', ['-S', '0.0.0.0:5000', '-t', 'public'], {
        stdio: 'pipe'
    });
    
    // Ждем запуска сервера
    await new Promise(resolve => setTimeout(resolve, 3000));

    for (const page of pages) {
        const pageName = page.replace(/\//g, '_').replace('.html', '') || 'index';
        const currentPath = `reports/screenshots/${pageName}-current.png`;
        const baselinePath = `reports/screenshots/${pageName}-baseline.png`;
        
        console.log(`📸 Скриншот страницы: ${page}`);
        
        try {
            // Делаем скриншот текущего состояния
            await takeScreenshot(`${baseUrl}${page}`, currentPath);
            
            // Сравниваем с baseline
            let similarity = 100;
            if (fs.existsSync(baselinePath)) {
                similarity = compareImages(baselinePath, currentPath);
            } else {
                // Первый запуск - копируем как baseline
                fs.copyFileSync(currentPath, baselinePath);
                console.log(`📋 Создан baseline для ${pageName}`);
            }
            
            const passed = similarity >= 98;
            results.push({
                page,
                similarity: similarity.toFixed(2),
                passed
            });
            
            if (!passed) {
                allTestsPassed = false;
                console.log(`❌ ${page}: ${similarity.toFixed(2)}% совпадение (требуется ≥98%)`);
            } else {
                console.log(`✅ ${page}: ${similarity.toFixed(2)}% совпадение`);
            }
            
        } catch (e) {
            console.error(`❌ Ошибка скриншота ${page}:`, e.message);
            allTestsPassed = false;
            results.push({
                page,
                similarity: '0.00',
                passed: false,
                error: e.message
            });
        }
    }

    // Останавливаем сервер
    server.kill();

    // Сохраняем отчет
    const report = {
        timestamp: new Date().toISOString(),
        overall_passed: allTestsPassed,
        results
    };
    
    fs.writeFileSync('reports/visual-regression-report.json', JSON.stringify(report, null, 2));
    
    if (allTestsPassed) {
        fs.writeFileSync('reports/visual-success.flag', 'SUCCESS');
        console.log('✅ Все визуальные тесты прошли успешно!');
    } else {
        console.log('❌ Некоторые визуальные тесты не прошли проверку');
    }
    
    return allTestsPassed;
}

// Запуск
runVisualRegression().catch(console.error);
