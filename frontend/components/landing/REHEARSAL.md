# HeroDemo rehearsal

Landing-page hero built with the Stageshow kit (`components/stageshow/kit`, vendored from `.agents/skills/stageshow/kit`).

## Story

A visitor on a fictional customer site (help.northwind.co) asks the TalkToWebsite widget "Can I return something I already opened?". The question forms out of the composer, typing dots show, and the answer streams in. Then the "Returns policy" source chip drops in and the Returns passage on the page behind gets highlighted. The demo plays once when it scrolls into view (`play="once"`), and the payoff holds. The poster frame (shown under reduced motion) is that payoff.

## Gold copied

`examples/ai-chat` for the sent question, the reply and the sources arriving last. `examples/hero-demo` for the corner-bleed framing on a quiet well.

## What changed from the gold

- The chat sits in the product's real widget look: green header, round composer with a send button, gray and brand-green bubbles with no tails, and Lucide icons from the app.
- A second surface (the customer's site) carries the grounding payoff: the cited passage gets highlighted.
- Compact design (358 × 590): the site sits whole across the top and the widget covers its foot.

## Checked

- Playground `film.mjs --gate`: passes at the wide width and at 390.
- Real page at http://localhost:3000, at 1440 and 390: contact sheets read correctly with Instrument Sans. Light theme, dark theme (the well steps to #14302a) and reduced motion (the poster) all checked.
- `tsc --noEmit` is clean. ESLint is clean on the new files; the vendored kit is in ESLint's ignore list.

## Known film lines on the host page (not fixed, judged as host artifacts)

- `kit override`: the check skips only stylesheets served from a `/kit/` path. Next bundles the kit into `page.css`, so the kit's own phone rules get flagged. Its `@layer stageshow` is intact.
- `steps in its box` and `vanishes with no exit` show up only on the host, at first load. They are the Stage measuring its column and switching wide to compact, which happens while the hero's fade-up still holds it at opacity 0.
- The typing `jump` and `hard edge` lines come from the question being typed and scrolling inside the composer. That is the intended input behavior.

## Not checked

- Touch devices and Safari.
- Live frame pacing on a low-end device.
