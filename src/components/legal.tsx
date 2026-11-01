import type { ReactNode } from 'react'
import { Breadcrumbs, SiteFooter } from '@/components/site'

/* Privacy policy and terms, at /privacy and /terms. Public (no sign-in) and English only, like the
   sign-in page: Google's consent screen links here. Update UPDATED whenever the text changes. */

const UPDATED = 'November 2, 2026'
const CONTACT = 'hello@koshel.me'

const Mail = () => (
  <a href={`mailto:${CONTACT}`} className="text-foreground underline underline-offset-4">
    {CONTACT}
  </a>
)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Privacy() {
  return (
    <>
      <Section title="Who we are">
        <p>
          Koshel (koshel.me) is a personal finance tracker run by Bohdan Karpliak. For anything about this
          policy or your data, write to <Mail />.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <span className="text-foreground">Your Google account basics</span>: name, email address and profile
            photo, when you sign in with Google. We never see your Google password.
          </li>
          <li>
            <span className="text-foreground">What you enter</span>: portfolio names, entries (asset, amount, date,
            note) and settings such as percentages, card order and language.
          </li>
          <li>
            <span className="text-foreground">Monobank, if you connect it</span>: your personal API token, your card
            list (type, last digits of the card number, IBAN, currency, balance) and card transactions (amount,
            time, description).
          </li>
          <li>
            <span className="text-foreground">Interactive Brokers, if you connect it</span>: your Flex Web Service
            token and Query ID, and the reports they give access to: positions, trades and dividends.
          </li>
          <li>
            <span className="text-foreground">In your browser only</span>: display currency and the “fake numbers”
            switch, kept in your browser’s local storage.
          </li>
        </ul>
        <p>
          We don’t use advertising or tracking cookies. We do count anonymous usage with PostHog: which pages are
          visited, where visitors came from, when someone starts and finishes signing in, and when a new account is
          created.
          It isn’t linked to your account and never includes your name, email, amounts, assets or portfolio names.
          PostHog uses your IP address and browser details to tell visits apart, and we don’t record your screen.
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          Only to run Koshel for you: show your balances, graphs and history, and keep connected Monobank and
          Interactive Brokers portfolios up to date (about once a day, and in real time for Monobank). We don’t
          sell your data, share it for advertising, or use it to train AI models.
        </p>
        <p>
          Koshel’s use of information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-foreground underline underline-offset-4"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </Section>

      <Section title="Services we rely on">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Convex: stores your data and runs Koshel’s server.</li>
          <li>Vercel: hosts the website.</li>
          <li>Google: sign-in.</li>
          <li>PostHog: anonymous usage statistics.</li>
          <li>Monobank and Interactive Brokers: read with the tokens you give, only if you connect them.</li>
          <li>
            Binance and Yahoo Finance: public prices. Your browser connects to Binance directly; Yahoo Finance only
            receives stock tickers, never anything about you.
          </li>
        </ul>
        <p>These providers may process data outside your country, including in the United States.</p>
      </Section>

      <Section title="How we protect it">
        <p>
          Everything travels over HTTPS. Every request is checked so you can only ever see and change your own
          data. Monobank and Interactive Brokers tokens stay on the server and are never sent back to the browser;
          both only allow reading, not moving money.
        </p>
      </Section>

      <Section title="How long we keep it, and deleting it">
        <p>
          We keep your data while you have an account. Deleting a portfolio in the app deletes its entries. To
          delete your whole account and everything in it, including stored tokens, or to get a copy of your data,
          write to <Mail /> and we’ll do it within 30 days. Copies in backups disappear as backups expire.
        </p>
        <p>
          You can also revoke the tokens at any time: Monobank at api.monobank.ua, Interactive Brokers in Client
          Portal → Flex Web Service, and Google sign-in in your Google account’s security settings.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can ask to see, correct, export or delete your data, or object to how we use it, by writing to{' '}
          <Mail />.
        </p>
      </Section>

      <Section title="Children">
        <p>Koshel isn’t meant for anyone under 16.</p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, we’ll update the date at the top, and tell you in the app or by email if the
          change matters.
        </p>
      </Section>
    </>
  )
}

function Terms() {
  return (
    <>
      <Section title="Using Koshel">
        <p>
          Koshel (koshel.me) is a personal finance tracker run by Bohdan Karpliak. By signing in you agree to these
          terms and to the{' '}
          <a href="/privacy" className="text-foreground underline underline-offset-4">
            privacy policy
          </a>
          . If you don’t agree, please don’t use Koshel.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You sign in with Google and are responsible for what happens in your account. Only connect Monobank or
          Interactive Brokers accounts that are yours, with tokens you’re allowed to use.
        </p>
      </Section>

      <Section title="Not financial advice">
        <p>
          Koshel shows numbers; it doesn’t give financial, investment or tax advice. Prices and exchange rates come
          from third parties and can be late or wrong, and synced data can be incomplete. Check important figures
          with your bank or broker before relying on them.
        </p>
      </Section>

      <Section title="Fair use">
        <p>
          Don’t try to access other people’s data, disrupt or overload the service, or use Koshel for anything
          illegal. We may suspend accounts that do.
        </p>
      </Section>

      <Section title="The service">
        <p>
          Koshel is provided “as is”. We work to keep it running and your data safe, but can’t promise it will
          always be available or error-free, and features may change. Monobank and Interactive Brokers syncing
          depends on their services.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          As far as the law allows, we aren’t liable for indirect losses or for decisions made based on what Koshel
          shows.
        </p>
      </Section>

      <Section title="Ending">
        <p>
          You can stop using Koshel at any time and ask us to delete your account by writing to <Mail />. We may end
          the service with reasonable notice.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If these terms change, we’ll update the date at the top. Continuing to use Koshel after that means you
          accept the new terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions: <Mail />.
        </p>
      </Section>
    </>
  )
}

export function Legal({ path }: { path: string }) {
  const privacy = path === '/privacy'
  const title = privacy ? 'Privacy policy' : 'Terms of service'
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-16 text-sm leading-relaxed text-muted-foreground">
      <header className="flex flex-col gap-2">
        <Breadcrumbs path={path} />
        <h1 className="text-2xl font-medium text-foreground">{title}</h1>
        <p className="text-muted-foreground">Last updated {UPDATED}</p>
      </header>
      {privacy ? <Privacy /> : <Terms />}
      <SiteFooter />
    </main>
  )
}
