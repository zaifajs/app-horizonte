"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// V3 Slate Mono Select. Built on Base UI's Select primitive but skinned with
// hz-* tokens so the trigger and popup match the rest of the app instead of
// reading as a generic shadcn dropdown.
//
// Key changes vs the shadcn baseline:
//   - Trigger sits on hz-surface-2 with a 1px hair-line border. Chevron
//     rotates 180° when the popup is open (via data-popup-open).
//   - Focus ring is a soft 2px primary-50 wash (not the screaming 3px
//     full-lime ring that visually framed the popup).
//   - Popup uses hz-surface-2 + hz-line, no foreground/10 inner ring.
//   - Items use a left-side state dot (lime when selected, empty otherwise)
//     instead of a right-side check. Hover is a quiet surface-3 wash,
//     keyboard-focus picks up the primary-50 tint that matches the trigger.
//   - Group labels (optgroup) read as hz-mono uppercase ink-3 captions so
//     "System / Custom" splits are recognisable at a glance.

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        // Layout
        "flex w-full items-center justify-between gap-2 rounded-lg text-sm whitespace-nowrap",
        // Sizing
        "data-[size=default]:h-9 data-[size=default]:px-3 data-[size=sm]:h-8 data-[size=sm]:px-2.5 data-[size=sm]:text-xs data-[size=sm]:rounded-md",
        // Skin — hz-surface-2 on a hair-line border, lifts to surface-3 on hover
        "hz-select-trigger",
        // Selectability
        "outline-none select-none transition-colors",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Validation
        "aria-invalid:border-[var(--hz-danger)] aria-invalid:ring-2 aria-invalid:ring-[color-mix(in_oklab,var(--hz-danger)_25%,transparent)]",
        // Placeholder
        "data-placeholder:text-[var(--hz-ink-3)]",
        // Value clamp
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5",
        // SVG defaults inside the trigger
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon
            className="pointer-events-none size-4 text-[var(--hz-ink-3)] transition-transform duration-150 data-[popup-open]:rotate-180"
          />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-[120]"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "hz-select-content relative isolate z-[120] max-h-(--available-height) min-w-(--anchor-width) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto p-1.5",
            // Animation
            "data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "px-2 pt-2 pb-1 hz-mono text-[0.6875rem] uppercase tracking-[.14em] text-[var(--hz-ink-3)]",
        className,
      )}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "hz-select-item relative flex w-full cursor-default items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-hidden select-none",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {/* Left-side state dot — lime when selected, hollow ring otherwise.
          More scannable than the floating right-edge checkmark. */}
      <SelectPrimitive.ItemIndicator
        keepMounted
        render={
          <span
            className="hz-select-indicator inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors"
            aria-hidden="true"
          />
        }
      >
        <span className="hz-select-dot" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-[var(--hz-line)]", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center py-1 text-[var(--hz-ink-3)] [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center py-1 text-[var(--hz-ink-3)] [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
