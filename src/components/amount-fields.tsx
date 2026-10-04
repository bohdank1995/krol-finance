import { useLayoutEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assetsFor, type AssetSymbol, type EntryType } from '@/lib/assets'
import { cleanAmount, groupAmount } from '@/lib/format'
import { useT } from '@/lib/i18n'

type Props = {
  amount: string
  onAmountChange: (v: string) => void
  /** Limits the asset list to what this entry type can use. */
  type: EntryType
  asset: AssetSymbol
  onAssetChange: (v: AssetSymbol) => void
  autoFocus?: boolean
}

const isDigit = (c: string) => (c >= '0' && c <= '9') || c === '.'

/**
 * Amount input that groups thousands as you type ("1,000,000.5") while `amount` stays plain
 * ("1000000.5"). A typed comma counts as the decimal point, since many phone keyboards only offer ",".
 */
function useGroupedAmount(amount: string, onAmountChange: (v: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number>(undefined)
  const shown = groupAmount(amount)

  // Regrouping rewrites the text; put the caret back after the same digit it followed.
  useLayoutEffect(() => {
    if (caret.current === undefined || !ref.current) return
    ref.current.setSelectionRange(caret.current, caret.current)
    caret.current = undefined
  })

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { inputType, data } = e.nativeEvent as InputEvent
    let text = e.target.value
    let at = e.target.selectionStart ?? text.length
    const removedComma = text.length === shown.length - 1 && shown[at] === ','
    // Deleting just a comma would come straight back: delete the digit beside it instead.
    if (inputType === 'deleteContentBackward' && removedComma) text = text.slice(0, --at) + text.slice(at + 1)
    if (inputType === 'deleteContentForward' && removedComma) text = text.slice(0, at) + text.slice(at + 1)
    if (inputType === 'insertText' && data === ',') text = `${text.slice(0, at - 1)}.${text.slice(at)}`
    // Pasted "12,5" (no point, comma not followed by 3 digits) is a decimal comma too.
    if (inputType === 'insertFromPaste' && !text.includes('.') && /^[^,]*,(\d{0,2}|\d{4,})$/.test(text.replace(/\s/g, '')))
      text = text.replace(',', '.')

    const clean = cleanAmount(text)
    const digitsBefore = [...text.slice(0, at)].filter(isDigit).length
    const next = groupAmount(clean)
    let pos = 0
    for (let n = 0; pos < next.length && n < digitsBefore; pos++) if (isDigit(next[pos])) n++
    caret.current = pos
    onAmountChange(clean)
  }

  return { ref, value: shown, onChange }
}

/** The signed amount + asset picker used in the entry drawer. */
export function AmountFields({ amount, onAmountChange, type, asset, onAssetChange, autoFocus }: Props) {
  const t = useT()
  const field = useGroupedAmount(amount, onAmountChange)
  return (
    // Wraps on narrow screens or large text: the asset picker drops below, full width.
    <div className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus={autoFocus}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        aria-label={t.amount}
        {...field}
        className="h-12 flex-[999_1_8rem] font-mono text-xl tabular-nums md:text-xl"
      />
      <Select value={asset} onValueChange={(v) => v && onAssetChange(v as AssetSymbol)}>
        <SelectTrigger aria-label={t.asset} className="h-12! w-28 grow font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {assetsFor(type).map((a) => (
            <SelectItem key={a.symbol} value={a.symbol}>
              <span className="w-12 font-mono">{a.symbol}</span>
              <span className="text-faint-foreground">{t.assetNames[a.symbol] ?? a.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <Input
      type="date"
      aria-label={t.date}
      value={value}
      max={new Date().toLocaleDateString('en-CA')}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-44 font-mono tabular-nums scheme-dark"
    />
  )
}
