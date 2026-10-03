import { LogOut } from 'lucide-react'
import { AddMenu } from '@/components/add-menu'
import { CryptoWidget } from '@/components/crypto-widget'
import { EntriesTable } from '@/components/entries-table'
import { SignIn } from '@/components/sign-in'
import { Button } from '@/components/ui/button'
import { signOut, useSession } from '@/lib/auth'
import { useEntries } from '@/lib/entries'
import { useLivePrices } from '@/lib/prices'

function App() {
  const session = useSession()
  if (session === undefined) return null
  if (!session) return <SignIn />
  return <Signed />
}

function Signed() {
  const entries = useEntries()
  const { prices, status } = useLivePrices(entries.map((e) => e.asset))

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-4 py-8 sm:px-8 sm:py-14">
      <header className="flex items-center justify-end gap-2">
        <AddMenu />
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => signOut()}>
          <LogOut />
        </Button>
      </header>
      <main className="mt-14 grid gap-16 sm:mt-20">
        <CryptoWidget entries={entries} prices={prices} status={status} />
        <EntriesTable entries={entries} />
      </main>
    </div>
  )
}

export default App
