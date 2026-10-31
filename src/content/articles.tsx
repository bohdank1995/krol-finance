import type { ReactNode } from 'react'

/* The blog. To publish, add an article here without `draft`: its page, the /blog list, the footer
   link, the sitemap and Google's Article data all follow. Drafts only show in `npm run dev`. */

export type Author = { name: string; bio?: string; url?: string }

/** The default byline. `bio` shows under each article. */
export const AUTHOR: Author = { name: 'Bohdan Karpliak' }

export type Article = {
  /** The address: /blog/<slug>. */
  slug: string
  title: string
  /** One or two sentences for Google and the /blog list. */
  description: string
  /** "YYYY-MM-DD". */
  published: string
  updated?: string
  author?: Author
  /** Shown only in development, never published. */
  draft?: boolean
  body: ReactNode
}

const ALL: Article[] = [
  {
    slug: 'sample-article',
    title: 'Sample article',
    description: 'A placeholder that shows how an article looks. Copy it to write a real one.',
    published: '2026-11-01',
    draft: true,
    body: (
      <>
        <p>This is the article text. Paragraphs, headings and lists are styled automatically.</p>
        <h2>A section heading</h2>
        <p>Use h2 for sections: the page already has its one h1, the title.</p>
        <ul>
          <li>A point</li>
          <li>Another point</li>
        </ul>
      </>
    ),
  },
]

export const articles = ALL.filter((a) => import.meta.env.DEV || !a.draft).sort((a, b) => (a.published < b.published ? 1 : -1))
