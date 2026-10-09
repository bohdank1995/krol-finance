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
import { evaluate, isExpression } from '@/lib/calc'
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
/** Characters an expression keeps: digits, point, operators, brackets. */
const isCalc = (c: string) => isDigit(c) || '+-−*/×÷()'.includes(c)

/**
 * Amount input that groups thousands as you type ("1,000,000.5") while `amount` stays plain
 * ("1000000.5"). A typed comma counts as the decimal point, since many phone keyboards only offer ",".
 * Once an operator is typed the text is a calculation ("15+190") and is kept as typed, without grouping.
 */
function useGroupedAmount(amount: string, onAmountChange: (v: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number>(undefined)
  const shown = isExpression(amount) ? amount : groupAmount(amount)

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

    // A calculation keeps its operators; the grouping commas of the number it started from go away.
    if (isExpression(text)) {
      const kept = [...text.slice(0, at)].filter(isCalc).length
      caret.current = kept
      onAmountChange([...text].filter(isCalc).join(''))
      return
    }

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
  // A calculation shows its result faintly on the right; Tab, "=" or a tap on it puts it in the field.
  const result = isExpression(amount) ? evaluate(amount) : undefined
  const answer = result !== undefined && Number(result) > 0 ? result : undefined
  const apply = () => answer && onAmountChange(answer)
  return (
    // Wraps on narrow screens or large text: the asset picker drops below, full width.
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-[999_1_8rem]">
        <Input
          autoFocus={autoFocus}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          aria-label={t.amount}
          aria-describedby={answer ? 'amount-result' : undefined}
          {...field}
          onKeyDown={(e) => {
            if (answer && ((e.key === 'Tab' && !e.shiftKey) || e.key === '=')) {
              e.preventDefault()
              apply()
            }
          }}
          // Room on the right for the result, so long calculations don't run under it.
          style={answer ? { paddingRight: `calc(${groupAmount(answer).length + 2}ch + 1.5rem)` } : undefined}
          className="h-12 font-mono text-xl tabular-nums md:text-xl"
        />
        {answer && (
          <button
            key={answer}
            id="amount-result"
            type="button"
            tabIndex={-1}
            title={t.useResult}
            onClick={apply}
            className="absolute inset-y-0 right-0 flex animate-in items-center px-3 font-mono text-xl text-faint-foreground tabular-nums duration-300 fade-in hover:text-muted-foreground"
          >
            = {groupAmount(answer)}
          </button>
        )}
      </div>
      <Select value={asset} onValueChange={(v) => v && onAssetChange(v as AssetSymbol)}>
        <SelectTrigger aria-label={t.asset} className="w-28 grow font-mono">
          <SelectValue />
        </SelectTrigger>
        {/* Opens below the picker, wide enough for the full names; long ones cut off with "…". */}
        <SelectContent alignItemWithTrigger={false} align="end" className="w-80">
          {assetsFor(type).map((a) => (
            <SelectItem key={a.symbol} value={a.symbol}>
              <span className="w-14 shrink-0 font-mono">{a.symbol}</span>
              <span className="min-w-0 truncate text-faint-foreground">{t.assetNames[a.symbol] ?? a.name}</span>
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
      className="h-12 w-44 font-mono tabular-nums scheme-dark"
    />
  )
}
