import { BookOpen, Bot, Send, X } from 'lucide-react'
import { Bar, Bubble, Collapse, Field, Stage, Stream, Text, Thread, Window, type Act } from '../../kit'
import './hero.css'

// TalkToWebsite's hero: a visitor on a customer's help site asks the widget a
// question; the answer streams in from the site's own docs, the source chip
// lands under it and the passage it came from lights up on the page behind.
//
// Beats: the question is typed into the widget's composer; it sends and forms
// a bubble; the reply's dots; the answer streams; the source arrives and the
// matching section on the page highlights. Plays once; the payoff holds.
//
// Real strings: the address, the page title, the section heading, the
// greeting, the question, the answer, the source.

const GREETING = 'Hi! How can I help you today?'
const Q = 'Can I return something I already opened?'
const A = 'Yes. Opened items can be returned within 30 days of delivery. Start it from Orders and we email you a prepaid label.'
const WORDS = A.split(' ').length

type S = {
  draft: string
  sent: boolean
  reply: 'none' | 'typing' | 'answer'
  words: number
  source: boolean
}

const initial: S = { draft: '', sent: false, reply: 'none', words: 0, source: false }
const poster: S = { draft: '', sent: true, reply: 'answer', words: WORDS, source: true }

async function script(a: Act<S>) {
  await a.wait(900)
  a.mark('type')
  await a.type('draft', Q, { interval: 42 })
  await a.wait(350)
  a.mark('send')
  a.put({ sent: true, draft: '' })
  await a.wait(500)
  a.put({ reply: 'typing' })
  await a.wait(1300)
  a.mark('stream')
  a.put({ reply: 'answer' })
  for (let i = 1; i <= WORDS; i++) {
    a.put({ words: i })
    await a.wait(55)
  }
  await a.wait(350)
  a.mark('source')
  a.put({ source: true })
  await a.wait(3000)
}

function Avatar() {
  return (
    <span className="th-av">
      <Bot size={14} strokeWidth={2} />
    </span>
  )
}

export default function TtwHero() {
  return (
    <Stage
      width={620}
      height={440}
      compact={{ below: 560, width: 358, height: 590 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      className="th"
    >
      {(s) => (
        <>
          <Window url="help.northwind.co" className="th-site">
            <div className="th-page">
              <div className="th-nav">
                <Bar w={72} h={8} tone={4} />
                <Bar w={38} h={6} tone={2} />
                <Bar w={44} h={6} tone={2} />
                <Bar w={30} h={6} tone={2} />
              </div>
              <div className="th-title">Shipping &amp; returns</div>
              <div className="th-lines th-intro">
                <Bar w="92%" h={6} tone={2} />
                <Bar w="80%" h={6} tone={2} />
              </div>
              <div className="th-section" data-on={s.source || undefined}>
                <div className="th-heading">Returns</div>
                <div className="th-lines">
                  <Bar w="94%" h={6} tone={2} />
                  <Bar w="86%" h={6} tone={2} />
                  <Bar w="58%" h={6} tone={2} />
                </div>
              </div>
              <div className="th-lines th-after">
                <Bar w="88%" h={6} tone={2} />
                <Bar w="72%" h={6} tone={2} />
                <Bar w="82%" h={6} tone={2} />
              </div>
            </div>
          </Window>

          <div className="th-widget">
            <div className="th-head">
              <span className="th-logo">
                <Bot size={18} strokeWidth={2} />
              </span>
              <div className="th-who">
                <div className="th-name">Northwind Help</div>
                <div className="th-status">
                  <span className="th-dot" />
                  Online
                </div>
              </div>
              <span className="th-close">
                <X size={14} strokeWidth={2.5} />
              </span>
            </div>

            <div className="th-body">
              <Thread className="th-thread">
                <Bubble from="them" tail={false} avatar={<Avatar />}>
                  {GREETING}
                </Bubble>
                {/* An earlier exchange, as filler: the eye lands on the new one */}
                <Bubble from="me" tail={false}>
                  <span className="th-past" style={{ width: 120 }} />
                </Bubble>
                <Bubble from="them" tail={false} avatar={<Avatar />}>
                  <span className="th-past" style={{ width: 160 }} />
                </Bubble>
                {s.sent && (
                  <Bubble from="me" tail={false} source="composer">
                    {Q}
                  </Bubble>
                )}
                {s.reply !== 'none' && (
                  <Bubble from="them" tail={false} avatar={<Avatar />} typing={s.reply === 'typing'}>
                    <Stream text={A} count={s.words} />
                  </Bubble>
                )}
                <Collapse open={s.source} reveal="drop">
                  <div className="th-sources">
                    <span className="th-source">
                      <BookOpen size={12} strokeWidth={2.25} />
                      Returns policy
                    </span>
                  </div>
                </Collapse>
              </Thread>
            </div>

            <div className="th-foot">
              <Field
                className="th-composer"
                value={s.draft}
                placeholder="Ask a question…"
                focused={!s.sent}
                box={{ 'data-target': 'composer' }}
                trailing={
                  <span className="th-send" data-on={s.draft ? true : undefined}>
                    <Send size={13} strokeWidth={2.25} />
                  </span>
                }
              />
            </div>
          </div>
        </>
      )}
    </Stage>
  )
}
