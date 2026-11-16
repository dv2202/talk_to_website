import { chromium } from 'playwright-core'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage(); await p.goto('http://localhost:3000/'); await p.waitForTimeout(4000)
const r = await p.evaluate(() => { const out=[]; for (const s of document.styleSheets){ let rules; try{rules=s.cssRules}catch{continue}
  for (const x of rules){ const t=x.cssText; if (t.includes('ss-phone__island')) out.push((s.href||'inline').slice(-60)+' :: '+(x.constructor.name)+' :: '+t.slice(0,160)) } } return out.slice(0,6) })
console.log(r.join('\n')); await b.close()
