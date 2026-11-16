import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const p = await b.newPage()
p.on('console', m => console.log('console', m.type(), m.text()))
p.on('pageerror', e => console.log('pageerror', e.message))
await p.goto(process.argv[2]); await p.waitForTimeout(3000)
console.log((await p.content()).slice(-1500))
await b.close()
