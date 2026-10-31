# How we develop Koshel

The rules for branching, committing and shipping. They apply to people and to Claude.

## The one thing to remember

**`main` is the live app.** Every push to `main` makes Vercel publish the site and deploy the
Convex backend to production (`vercel.json`). Real people's financial data sits behind it, so
nothing lands on `main` without going through the steps below.

## The flow

1. **Start from a fresh `main`** and create a branch.
2. **Make the change**, committing as you go.
3. **Check it** (see "Before merging").
4. **Open a pull request** into `main`.
5. **Squash and merge.** All the branch's commits become one commit on `main`, and that goes live.
6. **Delete the branch** and check the live site.

## Branches

- Never commit directly to `main`.
- One branch, one change. If a second idea comes up, it gets its own branch.
- Keep branches short: merge within a few days, so they don't drift away from `main`.
- Name them `<type>/<short-description>`, for example `feat/passive-income-card` or
  `fix/ibkr-sync-date`. The types are the same as for commits, below.
- Branches named `claude/…` are created automatically by Claude Code sessions. They're fine as they are.

## Commits

The format is the one `main` already uses:

```
feat: bigger buttons and menus
```

| Type | Use it for |
|---|---|
| `feat` | Something new or visibly changed for the user |
| `fix` | Something that was broken now works |
| `refactor` | Code reorganised, app behaves the same |
| `chore` | Setup, dependencies, tooling, docs |

- Write lowercase, short, and about what changed for the user.
- Each commit should leave the app working.
- The pull request title follows the same format, because it becomes the commit on `main`.
- Claude commits, pushes and opens pull requests only when asked.

## Before merging

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes. It also checks types.
- [ ] The change was tried in the browser, including at phone width if the layout changed.
- [ ] New texts exist in both Ukrainian and English (`src/lib/i18n.ts`).
- [ ] Colors use theme tokens, numbers use `font-mono tabular-nums`.
- [ ] Public pages follow the SEO rules below.
- [ ] `CLAUDE.md` is updated if a concept, flow or data rule changed.

There are no automated tests yet, so the browser check is what catches real bugs.

## SEO

Every public page has to be readable by Google without running JavaScript. New pages and changes
to public pages follow these rules.

**Adding a public page**
- Add it to `PAGES` in `src/lib/site.ts`. That one entry gives it its HTML file, sitemap line,
  canonical URL and breadcrumb data, so don't add those by hand.
- Show it in `PublicPage` in `src/components/site.tsx`.
- Link to it from a page Google can already reach, such as the footer. A page nothing links to
  stays invisible.
- Public pages render at build time, so their content can't come from Convex or depend on being
  signed in.
- Pages behind sign-in stay out of `PAGES`.

**Every public page has**
- A unique title (under about 60 characters) and description (under about 160), both written for
  that page.
- Exactly one `h1`, with `h2` for its sections.
- Breadcrumbs (`<Breadcrumbs />`), except the home page, and `<SiteFooter />`.
- Plain `<a href>` links, because crawlers don't click buttons.
- Words that say what the page is about, as real text and not inside an image.

**Images**
- WebP, compressed, with a smaller version for phones when the image is large.
- Always `width` and `height`, so the page doesn't jump while it loads.
- Real `alt` text that describes the image. Use `alt=""` only for decoration.

**Structured data**
- Add it through the page's `data` in `src/lib/site.ts`.
- It must match what the page shows. Never mark up ratings, reviews or prices that aren't real.

**Articles**
- Add them to `src/content/articles.tsx`. The blog stays hidden until the first article without
  `draft` is published, and then its pages, footer link and sitemap lines appear on their own.
- Each one needs a real author, a date and original writing. Never publish placeholder text.
- Changing an article? Set `updated`.

**Before merging a public page**
- [ ] `npm run build` ends with the page counted in "Prerendered N pages".
- [ ] The page's text is in its file in `dist/`, and it's listed in `dist/sitemap.xml`.
- [ ] Its address has never changed. If it must move, add a redirect in `vercel.json`.

## Backend (Convex)

Read `convex/_generated/ai/guidelines.md` before changing anything in `convex/`.

- **There is one dev backend, shared by every branch.** `npx convex dev` pushes the current
  folder's code to it, so run it in one checkout at a time.
- **Vercel preview links don't deploy the backend.** Only production does, so test backend changes
  locally.
- **Don't run `npx convex deploy` by hand.** Merging to `main` does it.
- **Change data in safe steps.** Production already holds rows that a new schema has to accept:
  1. Add the new field as optional and merge.
  2. Fill in the existing rows with a migration.
  3. Make the field required or remove the old one in a later pull request.
- **Set new environment variables on production before merging** (`npx convex env set NAME value --prod`).
  Otherwise the new code goes live without them.
- **Every public function checks the signed-in user** (`signedIn` / `ownPortfolio` in `convex/data.ts`).
  Convex doesn't do this for you.
- **Never change `TOKEN_KEY` on a deployment that has saved tokens.** They become unreadable.

## Secrets and private data

- Never commit `.env.local`, tokens or keys. Git already ignores `.env*`; `.env.example` is the only
  one tracked, and it holds placeholders.
- Turn on **Fake numbers** before taking a screenshot for a pull request or anywhere public.
- Dev and production data stay separate. Don't copy production data to dev.

## Working in parallel (worktrees)

Claude Code sessions run in their own copy of the repo, under `.claude/worktrees/`.

- A new worktree has no `.env.local`. Copy the Convex lines from the main checkout.
- `node_modules` may need `npm install`.
- Port 5173 can be taken, so use `dev-5174` or `dev-auto` from `.claude/launch.json`.
- Google sign-in returns to the `SITE_URL` set on the deployment (`http://localhost:5173`), so on
  another port it can land on the wrong address.

## When something breaks in production

1. **Roll back the site** in Vercel: Deployments → the last good one → Instant Rollback.
2. **Undo the code** with a pull request that reverts the bad commit (`git revert`). Don't rewrite
   `main`'s history.
3. **Check the backend.** Vercel's rollback doesn't touch Convex, so bad functions stay live until
   the revert merges. Look at the logs with `npx convex dashboard`.
