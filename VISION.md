# Koshel vision

Source: [Defining product metrics](https://www.karpliak.me/posts/defining-product-metrics).

## Goal

Koshel is a personal finance web app that helps people reach **financial freedom**: a steady passive income
that covers all their needs, so working becomes a choice.

## The path to it

1. **Understand your current financial state.** See all your money in one place and know your real net worth.
   *This is what Koshel does today: the foundation and the first step.*
2. **Define your Golden number**: the capital that would cover your life with passive income.
3. **Learn how to invest.**
4. **Learn to save money.**
5. **Create new revenue streams.**

## Who it's for

**People who are actively working toward financial independence and keep their money in 2+ places**: a bank
plus a broker, crypto, savings or cash in another currency.

They feel the "I don't know my real numbers" pain the most, and they care about the later milestones too (Golden
number, investing). In Ukraine these are often IT people with Monobank, Interactive Brokers and crypto.

Not for now: people who only want to budget day-to-day spending from a single card.

This is a working hypothesis, to be confirmed or narrowed down through interviews.

## Today's focus: milestone 1

- **Problem:** money is spread across banks, brokers, wallets and cash. People don't know their real numbers.
- **Desired behaviour:** add your main accounts and assets so Koshel can show your net worth.
- **How:** guided onboarding, connected sources (Monobank, Interactive Brokers) and manual sources for the rest.

## How we measure it

| Step | Metric | Definition |
|---|---|---|
| Acquisition | Traffic sources, landing-page sign-ups | Where people come from and how many sign up |
| **Activation** (primary) | Activation rate | % of sign-ups who add **at least 2 sources or assets within 7 days** |
| Retention | Week-2 return | % of activated users who come back to look at their net worth **8–14 days after activating** |

The thresholds (2 sources, 7 days, days 8–14) are a best guess and should be adjusted once real users arrive.
Ideas for raising activation: guided onboarding, and a dashboard prefilled with sample data.

## Next

- Build what activation needs, then start measuring it.
- Later, add metrics for the Golden number milestone (banner clicks, completion rate). Open questions: what
  counts as "completed", and whether to show it in the UI.

## Competitors

Ukrainian market, as of November 2026. Details come from the products' own sites and news coverage, not hands-on
testing.

| Product | What it is | Overlap with Koshel |
|---|---|---|
| [finerd.ai](https://forbes.ua/news/fractal-zapustila-zastosunok-finerdai-dlia-obliku-osobistix-finansiv-18092026-42179) (Fractal) | AI personal-finance app, launched September 2026. Connects banks (Monobank, PrivatBank, plus EU/US/Canada), brokers and crypto wallets; cash, property and cars by hand. Free basic tier, paid Pro | **Closest.** Same "everything in one place" idea, with funding behind it and more bank connections |
| [Strum](https://www.strum.capital/) | Investment and capital tracker: portfolio, dividends, OVDP, broker sync, goals, rebalancing, an MCP server for AI | Strong on investors and goals (close to milestones 2–3). Investing first, not bank cards |

**Where Koshel can stand out:** net worth across bank, broker and crypto with live prices, and history going
back to past purchases (not just today's snapshot). It's also built around one long-term goal, financial
freedom, rather than budgeting.

**Watch:** finerd.ai, which overlaps the most, and Strum's goal and AI features, which overlap milestones 2–3.
Plans and Ideas also has an MCP idea.
