import { articles, AUTHOR } from '@/content/articles'
import { FAQ } from '@/content/faq'

/* Every public page: its address, what Google is told about it, and its place in the breadcrumbs.
   `scripts/prerender.mjs` turns this list into ready-made HTML, the sitemap and structured data. */

export const SITE_URL = 'https://www.koshel.me'
const NAME = 'Koshel'

export type Crumb = { name: string; path: string }

export type Page = {
  path: string
  title: string
  description: string
  /** From the home page down to this page. Empty on the home page. */
  crumbs: Crumb[]
  /** Extra structured data for Google. */
  data?: object[]
  /** "YYYY-MM-DD", for the sitemap. */
  updated?: string
}

const HOME: Crumb = { name: 'Home', path: '/' }
const url = (path: string) => (path === '/' ? `${SITE_URL}/` : SITE_URL + path)

export const hasBlog = articles.length > 0

export const PAGES: Page[] = [
  {
    path: '/',
    title: 'Koshel · Track your net worth and passive income',
    description:
      'Koshel is a personal finance tracker: add cash, crypto and stocks, connect Monobank cards and Interactive Brokers, and see your net worth over time.',
    crumbs: [],
    data: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: url('/') },
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: NAME,
        url: url('/'),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
      },
    ],
  },
  {
    path: '/faq',
    title: 'FAQ · Koshel',
    description: 'How Koshel works: what you can track, how passive income is calculated, connecting Monobank and Interactive Brokers, and how your data is protected.',
    crumbs: [HOME, { name: 'FAQ', path: '/faq' }],
    data: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  },
  {
    path: '/privacy',
    title: 'Privacy policy · Koshel',
    description: 'What data Koshel collects, how it is used and protected, how long it is kept, and how to delete it.',
    crumbs: [HOME, { name: 'Privacy policy', path: '/privacy' }],
  },
  {
    path: '/terms',
    title: 'Terms of service · Koshel',
    description: 'The terms for using Koshel, the personal finance tracker.',
    crumbs: [HOME, { name: 'Terms of service', path: '/terms' }],
  },
  ...(hasBlog
    ? [
        {
          path: '/blog',
          title: 'Blog · Koshel',
          description: 'Articles about tracking your net worth and growing your passive income.',
          crumbs: [HOME, { name: 'Blog', path: '/blog' }],
        },
      ]
    : []),
  ...articles.map((a) => {
    const author = a.author ?? AUTHOR
    return {
      path: `/blog/${a.slug}`,
      title: `${a.title} · Koshel`,
      description: a.description,
      crumbs: [HOME, { name: 'Blog', path: '/blog' }, { name: a.title, path: `/blog/${a.slug}` }],
      updated: a.updated ?? a.published,
      data: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.title,
          description: a.description,
          datePublished: a.published,
          dateModified: a.updated ?? a.published,
          author: { '@type': 'Person', name: author.name, ...(author.url && { url: author.url }) },
          publisher: { '@type': 'Organization', name: NAME, url: url('/') },
          mainEntityOfPage: url(`/blog/${a.slug}`),
        },
      ],
    }
  }),
]

export const pageAt = (path: string) => PAGES.find((p) => p.path === path)

/** What goes in the page's <head>, apart from the title and description. */
export function structuredData(page: Page) {
  const crumbs = page.crumbs.length
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: page.crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: url(c.path) })),
        },
      ]
    : []
  return [...(page.data ?? []), ...crumbs]
}

export const canonicalOf = (page: Page) => url(page.path)
