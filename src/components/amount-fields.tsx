import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assetsFor, type AssetSymbol, type EntryType } from '@/lib/assets'

type Props = {
  amount: string
  onAmountChange: (v: string) => void
  /** Limits the asset list to what this entry type can use. */
  type: EntryType
  asset: AssetSymbol
  onAssetChange: (v: AssetSymbol) => void
  autoFocus?: boolean
}

/** The signed amount + asset picker used in the entry drawer. */
export function AmountFields({ amount, onAmountChange, type, asset, onAssetChange, autoFocus }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus={autoFocus}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        aria-label="Amount"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        className="h-12 flex-1 font-mono text-xl tabular-nums md:text-xl"
      />
      <Select value={asset} onValueChange={(v) => v && onAssetChange(v as AssetSymbol)}>
        <SelectTrigger aria-label="Asset" className="h-12! w-28 font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {assetsFor(type).map((a) => (
            <SelectItem key={a.symbol} value={a.symbol}>
              <span className="w-12 font-mono">{a.symbol}</span>
              <span className="text-faint-foreground">{a.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      type="date"
      aria-label="Date"
      value={value}
      max={new Date().toLocaleDateString('en-CA')}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-44 font-mono tabular-nums scheme-dark"
    />
  )
}
