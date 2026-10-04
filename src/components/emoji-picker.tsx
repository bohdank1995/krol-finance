import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useT } from '@/lib/i18n'

const EMOJIS = [
  '💰', '💵', '💳', '🏦', '🏠', '🚗', '✈️', '🛒', '🍔', '☕',
  '🎁', '🎮', '📈', '📉', '💎', '🪙', '🚀', '🌙', '🔥', '⭐',
  '🐷', '🔒', '🌴', '🎓', '💼', '🧾', '🏖️', '🛡️', '🌍', '❤️',
]

/** A small emoji grid; picking one appends it to the text through `onPick`. */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const t = useT()
  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="icon" aria-label={t.addEmoji} className="size-12" />}
      >
        <Smile />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-auto grid-cols-10 gap-0.5 p-1.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-accent"
          >
            {e}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
