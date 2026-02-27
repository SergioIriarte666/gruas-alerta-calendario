import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface Suggestion {
  value: string;
  count: number;
}

interface AutocompleteInputProps {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  minChars?: number;
}

export const AutocompleteInput = ({
  value,
  onValueChange,
  suggestions,
  placeholder = '',
  disabled = false,
  className = '',
  id,
  minChars = 2,
}: AutocompleteInputProps) => {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.length >= minChars
    ? suggestions.filter(s => s.value.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : suggestions.slice(0, 5);

  const showDropdown = open && filtered.length > 0 && !disabled;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onValueChange(val);
    setOpen(false);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[focusedIndex].value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setFocusedIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
          {filtered.map((item, index) => (
            <button
              key={item.value}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex justify-between items-center",
                index === focusedIndex && "bg-accent text-accent-foreground"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item.value);
              }}
            >
              <span className="truncate">{item.value}</span>
              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                {item.count}x
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
