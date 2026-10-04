"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/** A drawer: a panel that slides in from the right edge. Built on the same Base UI dialog. */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

/**
 * The part of the screen the on-screen keyboard leaves visible. Phones keep fixed panels full
 * height under the keyboard, so the drawer is fitted to this instead: its buttons stay in view.
 */
function useVisibleArea() {
  const [area, setArea] = React.useState<{ top: number; height: number }>()
  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () =>
      // Only while something covers the bottom (the keyboard); otherwise plain full height.
      setArea(vv.height < window.innerHeight - 1 ? { top: vv.offsetTop, height: vv.height } : undefined)
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])
  return area
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  style,
  ...props
}: SheetPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  const area = useVisibleArea()
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 isolate z-50 bg-background/70 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col gap-6 overflow-y-auto overscroll-contain border-l bg-popover p-6 pb-0 text-sm text-popover-foreground shadow-lg outline-none duration-200 sm:max-w-md data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right",
          className
        )}
        style={
          area
            ? (state) => ({
                ...(typeof style === "function" ? style(state) : style),
                top: area.top,
                bottom: "auto",
                height: area.height,
              })
            : style
        }
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      // Pinned to the drawer's bottom edge (right above the keyboard on phones); buttons split the width.
      className={cn(
        "sticky bottom-0 -mx-6 mt-auto grid auto-cols-fr grid-flow-col gap-2 bg-popover px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] *:h-11 *:text-sm",
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
