/* The questions on /faq. Keep answers true to what the app does: they're shown to Google word for word. */

export const FAQ: { question: string; answer: string }[] = [
  {
    question: 'What is Koshel?',
    answer:
      'Koshel is a personal finance tracker. It brings your cash, crypto and stocks into one place and shows your net worth and passive income over time.',
  },
  {
    question: 'What can I track?',
    answer:
      'Money in USD, EUR, UAH and PLN, crypto, Monobank cards, and stocks held at Interactive Brokers. A portfolio can mix different types of assets.',
  },
  {
    question: 'How does Koshel calculate passive income?',
    answer:
      'It counts what your holdings earned on their own: price changes, plus dividends and interest from Interactive Brokers. Deposits and withdrawals are left out.',
  },
  {
    question: 'How do I connect Monobank?',
    answer:
      'Paste your personal Monobank API token and pick a card. Koshel imports the last 31 days and keeps the card up to date from then on.',
  },
  {
    question: 'How do I connect Interactive Brokers?',
    answer:
      'Create a Flex Query in your Interactive Brokers account, paste the Flex Web Service token and Query ID into Koshel, then pick the stocks to follow or select all of them.',
  },
  {
    question: 'Can Koshel move my money?',
    answer: 'No. Koshel only reads balances, transactions and positions. It has no way to make payments or place trades.',
  },
  {
    question: 'How is my data protected?',
    answer:
      'Sign-in is through Google, and each account can only reach its own data. Monobank and Interactive Brokers tokens are stored encrypted. There are no ads or tracking cookies. Koshel counts anonymous usage with PostHog, which never includes your name, email or financial data.',
  },
  {
    question: 'Which languages and currencies does Koshel support?',
    answer: 'The app is available in Ukrainian and English, and shows your totals in USD, EUR or UAH.',
  },
  {
    question: 'Can I share a screenshot without showing my real numbers?',
    answer: 'Yes. Turn on Fake numbers in the user menu: every amount is scaled by a random factor and the app becomes read-only.',
  },
  {
    question: 'How do I delete my account?',
    answer: 'Open the user menu and choose Delete account. This permanently removes your account and everything stored with it.',
  },
]
