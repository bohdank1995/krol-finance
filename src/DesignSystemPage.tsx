import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './design-system-page.css'

/* The Design System browser — the same page Claude Design shows for this
 * project. It is chrome around the design system, not part of it, so it uses
 * its own neutral palette rather than DS tokens: a card must be able to recolor
 * every --primary in the system without repainting the page it sits on.
 *
 * Cards are the real .html previews from public/ds, rendered in iframes exactly
 * as Claude Design renders them — same markup, same token runtime, same Phosphor
 * and Tailwind CDN scripts. Nothing here re-implements a component. */

type Card = {
  path: string
  group: string
  viewport: string
  subtitle: string
  name: string
}
type Manifest = { namespace: string; cards: Card[]; components: { name: string }[] }

const DS_BASE = '/ds'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* Cards are authored at a fixed viewport. Rather than reflow them at the
 * container width — which would show a layout the design was never drawn at —
 * render at the authored size and scale the whole frame down to fit. */
function CardFrame({ card }: { card: Card }) {
  const [w, h] = card.viewport.split('x').map(Number)
  const hostRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const fit = () => setScale(Math.min(1, host.clientWidth / w))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(host)
    return () => ro.disconnect()
  }, [w])

  return (
    <div className="dsp-frame" ref={hostRef} style={{ height: h * scale }}>
      <iframe
        src={`${DS_BASE}/${card.path}`}
        title={card.name}
        width={w}
        height={h}
        loading="lazy"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}

/* Minimal renderer for the readme: headings, bullets, paragraphs, inline code
 * and bold. The readme is ours, so the subset it uses is known and fixed. */
function inline(md: string) {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function Readme({ text }: { text: string }) {
  const blocks: string[] = []
  let list: string[] = []
  let para: string[] = []

  const flushPara = () => {
    if (para.length) blocks.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  const flushList = () => {
    if (list.length) blocks.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`)
    list = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (/^#\s/.test(line)) {
      flushPara(); flushList()
      blocks.push(`<h1>${inline(line.slice(2))}</h1>`)
    } else if (/^##\s/.test(line)) {
      flushPara(); flushList()
      blocks.push(`<h2>${inline(line.slice(3))}</h2>`)
    } else if (/^-\s/.test(line)) {
      flushPara()
      list.push(line.slice(2))
    } else if (/^\s+\S/.test(raw) && list.length) {
      list[list.length - 1] += ' ' + line.trim()
    } else if (!line) {
      flushPara(); flushList()
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara(); flushList()

  return <div className="dsp-readme" dangerouslySetInnerHTML={{ __html: blocks.join('\n') }} />
}

export default function DesignSystemPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [readme, setReadme] = useState('')
  const [readmeOpen, setReadmeOpen] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch(`${DS_BASE}/_ds_manifest.json`).then((r) => r.json()).then(setManifest)
    fetch(`${DS_BASE}/readme.md`).then((r) => r.text()).then(setReadme)
  }, [])

  if (!manifest) return <div className="dsp-loading">Loading design system…</div>

  const groups: string[] = []
  for (const c of manifest.cards) if (!groups.includes(c.group)) groups.push(c.group)

  return (
    <div className="dsp">
      <nav className="dsp-nav">
        <a className="dsp-nav-top" href="#readme">
          <span className="dsp-nav-ico">▤</span> Readme
        </a>
        {groups.map((g) => (
          <div className="dsp-nav-group" key={g}>
            <button
              className="dsp-nav-head"
              onClick={() => setCollapsed((c) => ({ ...c, [g]: !c[g] }))}
              aria-expanded={!collapsed[g]}
            >
              <span className={`dsp-caret${collapsed[g] ? ' closed' : ''}`}>⌄</span> {g}
            </button>
            {!collapsed[g] &&
              manifest.cards
                .filter((c) => c.group === g)
                .map((c) => (
                  <a className="dsp-nav-item" key={c.path} href={`#${slug(c.path)}`}>
                    {c.name}
                  </a>
                ))}
          </div>
        ))}
      </nav>

      <main className="dsp-main">
        <header className="dsp-header">
          <div className="dsp-logo" aria-hidden="true">
            <span>Collaborato</span>
          </div>
          <h1>LMS Collaborato Design System</h1>
        </header>

        <section className="dsp-section" id="readme">
          <button className="dsp-section-head" onClick={() => setReadmeOpen((v) => !v)} aria-expanded={readmeOpen}>
            <span className={`dsp-caret${readmeOpen ? '' : ' closed'}`}>⌄</span> Readme
          </button>
          {readmeOpen && <Readme text={readme} />}
        </section>

        {groups.map((g) => (
          <section className="dsp-section" key={g}>
            <h2 className="dsp-group-title">{g}</h2>
            {manifest.cards
              .filter((c) => c.group === g)
              .map((c) => (
                <article className="dsp-card" key={c.path} id={slug(c.path)}>
                  <div className="dsp-card-head">
                    <h3>{c.name}</h3>
                    <p>{c.subtitle}</p>
                  </div>
                  <CardFrame card={c} />
                </article>
              ))}
          </section>
        ))}
      </main>
    </div>
  )
}
