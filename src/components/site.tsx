import { useEffect } from 'react'
import { Legal } from '@/components/legal'
import { Landing } from '@/components/sign-in'
import { articles, AUTHOR } from '@/content/articles'
import { FAQ } from '@/content/faq'
import { hasBlog, pageAt } from '@/lib/site'

/* The public pages around the app: FAQ, blog, "not found", and the footer and breadcrumbs they share.
   English only, like the home page. Plain links: every page is its own ready-made HTML file. */

export function Breadcrumbs({ path }: { path: string }) {
  const crumbs = pageAt(path)?.crumbs ?? []
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap gap-x-2 text-faint-foreground">
        {crumbs.map((c, i) => (
          <li key={c.path} className="flex gap-x-2">
            {i > 0 && <span aria-hidden>/</span>}
            {i < crumbs.length - 1 ? (
              <a href={c.path} className="hover:text-foreground">
                {c.name}
              </a>
            ) : (
              <span aria-current="page">{c.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function SiteFooter() {
  const links = [
    { href: '/faq', label: 'FAQ' },
    ...(hasBlog ? [{ href: '/blog', label: 'Blog' }] : []),
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
    { href: 'mailto:hello@koshel.me', label: 'hello@koshel.me' },
  ]
  return (
    <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-faint-foreground">
      {links.map((l) => (
        <a key={l.href} href={l.href} className="hover:text-foreground">
          {l.label}
        </a>
      ))}
    </footer>
  )
}

const shell = 'mx-auto flex min-h-svh max-w-2xl flex-col gap-10 px-4 py-16 text-sm leading-relaxed text-muted-foreground'

function Faq() {
  return (
    <main className={shell}>
      <header className="flex flex-col gap-2">
        <Breadcrumbs path="/faq" />
        <h1 className="text-2xl font-medium text-foreground">Frequently asked questions</h1>
      </header>
      {FAQ.map((f) => (
        <section key={f.question} className="flex flex-col gap-2">
          <h2 className="text-base font-medium text-foreground">{f.question}</h2>
          <p>{f.answer}</p>
        </section>
      ))}
      <SiteFooter />
    </main>
  )
}

function Blog() {
  return (
    <main className={shell}>
      <header className="flex flex-col gap-2">
        <Breadcrumbs path="/blog" />
        <h1 className="text-2xl font-medium text-foreground">Blog</h1>
      </header>
      {articles.map((a) => (
        <article key={a.slug} className="flex flex-col gap-1">
          <h2 className="text-base font-medium text-foreground">
            <a href={`/blog/${a.slug}`} className="hover:underline">
              {a.title}
            </a>
          </h2>
          <p>{a.description}</p>
          <time dateTime={a.published} className="font-mono text-faint-foreground tabular-nums">
            {a.published}
          </time>
        </article>
      ))}
      <SiteFooter />
    </main>
  )
}

function ArticlePage({ slug }: { slug: string }) {
  const article = articles.find((a) => a.slug === slug)
  if (!article) return <NotFound />
  const author = article.author ?? AUTHOR
  return (
    <main className={shell}>
      <article className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <Breadcrumbs path={`/blog/${slug}`} />
          <h1 className="text-2xl font-medium text-foreground">{article.title}</h1>
          <p className="text-faint-foreground">
            {author.url ? (
              <a href={author.url} rel="author" className="hover:text-foreground">
                {author.name}
              </a>
            ) : (
              author.name
            )}
            {' · '}
            <time dateTime={article.published} className="font-mono tabular-nums">
              {article.published}
            </time>
          </p>
        </header>
        <div className="flex flex-col gap-4 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
          {article.body}
        </div>
        {author.bio && <p className="border-t border-border pt-6 text-faint-foreground">{author.bio}</p>}
      </article>
      <SiteFooter />
    </main>
  )
}

export function NotFound() {
  return (
    <main className={`${shell} items-center justify-center text-center`}>
      <h1 className="text-2xl font-medium text-foreground">Page not found</h1>
      <a href="/" className="underline underline-offset-4 hover:text-foreground">
        Back to Koshel
      </a>
    </main>
  )
}

/** A public page by its address. The home page shows here without sign-in, ready-made for Google. */
export function PublicPage({ path }: { path: string }) {
  const page = pageAt(path)
  useEffect(() => {
    if (page) document.title = page.title
  }, [page])
  if (path === '/') return <Landing />
  if (path === '/faq') return <Faq />
  if (path === '/privacy' || path === '/terms') return <Legal path={path} />
  if (path === '/blog') return <Blog />
  if (page && path.startsWith('/blog/')) return <ArticlePage slug={path.slice('/blog/'.length)} />
  return <NotFound />
}
