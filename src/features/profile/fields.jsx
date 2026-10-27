"use client";

import { useLayoutEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Compact form controls for the edit dialogs: 36px tall instead of the default 40,
// labels above, an optional hint below

export function Field({ id, label, hint, className, children }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextField({ id, label, hint, className, value, onChange, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} className={className}>
      <Input
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
        {...props}
      />
    </Field>
  );
}

export function MonthField({ id, label, value, onChange, disabled }) {
  return (
    <Field id={id} label={label}>
      <Input
        id={id}
        type="month"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9"
      />
    </Field>
  );
}

export function SelectField({ id, label, value, onChange, options, placeholder = "Select", className }) {
  return (
    <Field id={id} label={label} className={className}>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// Grows with its content so long bullets stay readable
function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <Textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-9 resize-none overflow-hidden py-2 text-sm leading-relaxed"
      {...props}
    />
  );
}

// One field per bullet, with add and remove. Enter in a bullet starts the next one.
export function BulletsField({ id, value, onChange }) {
  const setAt = (index, text) => onChange(value.map((b, i) => (i === index ? text : b)));
  const removeAt = (index) => onChange(value.length > 1 ? value.filter((_, i) => i !== index) : [""]);
  const addAfter = (index) => onChange([...value.slice(0, index + 1), "", ...value.slice(index + 1)]);

  return (
    <Field
      id={`${id}-0`}
      label="Bullet points"
      hint="Start with what you did, then the result. Enter adds the next bullet."
    >
      <ol className="space-y-2">
        {value.map((bullet, index) => (
          <li key={index} className="flex items-start gap-2">
            <span aria-hidden className="mt-3.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <AutoTextarea
              id={`${id}-${index}`}
              aria-label={`Bullet ${index + 1}`}
              value={bullet}
              onChange={(text) => setAt(index, text)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addAfter(index);
                }
              }}
              placeholder={index === 0 ? "Built the billing service that cut failed payments by 30%" : ""}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeAt(index)}
              aria-label={`Remove bullet ${index + 1}`}
              className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => addAfter(value.length - 1)}
        className="h-8 px-2 text-brand hover:text-brand"
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add bullet
      </Button>
    </Field>
  );
}
