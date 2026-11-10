"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  icon,
  className,
  disabled,
  ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          className={cn(
            "h-9 w-[180px] justify-between gap-2 px-3 text-xs font-medium shadow-xs",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {icon}
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9 text-xs" />
          <CommandList className="max-h-64">
            <CommandEmpty className="py-4 text-xs">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
