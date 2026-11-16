import { chromium } from 'playwright-core'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', reducedMotion: 'reduce' })
await p.addInitScript(() => localStorage.setItem('theme', 'dark'))
await p.goto('http://localhost:3000/'); await p.waitForTimeout(6000)
console.log(await p.evaluate(() => [document.documentElement.className, getComputedStyle(document.querySelector('.th .ss-stage')).backgroundColor])); await p.screenshot({ path: 'shots/site-dark.png' }); await b.close()
