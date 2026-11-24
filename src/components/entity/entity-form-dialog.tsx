'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  createEntityAction,
  updateEntityAction,
  upsertEntityAction
} from '@/features/entities/server/actions';
import { cn } from '@/lib/utils';

export type FieldSpec = {
  name: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'money'
    | 'date'
    | 'datetime'
    | 'select'
    | 'checkbox'
    | 'lines';
  options?: readonly { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Lets a money field go negative (e.g. a savings withdrawal). */
  allowNegative?: boolean;
  /** For `lines`: how many single-line inputs to show. */
  count?: number;
  /** Render at half width from `sm` up. */
  half?: boolean;
  min?: number;
  max?: number;
  /** For `select`: send the chosen value as a number. */
  numeric?: boolean;
};

type Values = Record<string, unknown>;

// iOS zooms into inputs under 16px; keep them at 16px on phones.
const inputClass =
  'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 placeholder:text-muted-foreground/70 w-full rounded-xl border px-3 py-2 text-base outline-none transition-colors focus-visible:ring-3 md:text-sm aria-invalid:border-destructive';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** ISO instant → value for <input type=datetime-local>, in the device's timezone. */
function toLocalInput(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toFormState(
  fields: FieldSpec[],
  values: Values
): Record<string, string | boolean | string[]> {
  const out: Record<string, string | boolean | string[]> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'checkbox') out[f.name] = Boolean(v);
    else if (f.type === 'lines') {
      const list = Array.isArray(v) ? (v as string[]) : [];
      out[f.name] = Array.from({ length: f.count ?? 3 }, (_, i) => list[i] ?? '');
    } else if (f.type === 'money') out[f.name] = typeof v === 'number' ? (v / 100).toFixed(2) : '';
    else if (f.type === 'datetime') out[f.name] = toLocalInput(v);
    else out[f.name] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

/** Converts form strings into the typed payload the entity schema expects. */
function toPayload(
  fields: FieldSpec[],
  state: Record<string, string | boolean | string[]>
): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = state[f.name];
    switch (f.type) {
      case 'checkbox':
        out[f.name] = Boolean(v);
        break;
      case 'lines':
        out[f.name] = (v as string[]).map((s) => s.trim()).filter(Boolean);
        break;
      case 'number':
        out[f.name] = v === '' ? null : Number(v);
        break;
      case 'select':
        out[f.name] = v === '' ? null : f.numeric ? Number(v) : v;
        break;
      case 'money':
        out[f.name] = v === '' ? null : Math.round(Number(String(v).replace(/[$,\s]/g, '')) * 100);
        break;
      case 'datetime':
        out[f.name] = v ? new Date(String(v)).toISOString() : null;
        break;
      default:
        out[f.name] = v === '' ? null : v;
    }
  }
  return out;
}

export function EntityFormDialog({
  entity,
  title,
  description,
  fields,
  initial = {},
  fixed = {},
  recordId,
  mode = recordId ? 'update' : 'create',
  open,
  onOpenChange,
  submitLabel
}: {
  entity: string;
  title: string;
  description?: string;
  fields: FieldSpec[];
  initial?: Values;
  /** Values sent with every submit but not shown (e.g. the parent trip). */
  fixed?: Values;
  recordId?: string;
  mode?: 'create' | 'update' | 'upsert';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitLabel?: string;
}) {
  const [state, setState] = useState(() => toFormState(fields, initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(name: string, value: string | boolean | string[]) {
    setState((s) => ({ ...s, [name]: value }));
  }

  function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const values = { ...toPayload(fields, state), ...fixed };
    startTransition(async () => {
      const result =
        mode === 'update' && recordId
          ? await updateEntityAction({ entity, id: recordId, values })
          : mode === 'upsert'
            ? await upsertEntityAction({ entity, values })
            : await createEntityAction({ entity, values });
      if (result.ok) {
        toast.success('Saved');
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='font-display text-2xl font-medium'>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          id={`form-${entity}`}
          onSubmit={submit}
          className='grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2'
        >
          {fields.map((f) => {
            const fieldId = `${entity}-${f.name}`;
            const value = state[f.name];
            return (
              <div key={f.name} className={cn('flex flex-col gap-1.5', !f.half && 'sm:col-span-2')}>
                {f.type === 'checkbox' ? (
                  <label htmlFor={fieldId} className='flex items-center gap-2.5 text-sm'>
                    <input
                      id={fieldId}
                      type='checkbox'
                      checked={Boolean(value)}
                      onChange={(e) => set(f.name, e.target.checked)}
                      className='accent-[var(--rose)] size-4'
                    />
                    {f.label}
                  </label>
                ) : (
                  <label htmlFor={fieldId} className='text-sm font-medium'>
                    {f.label}
                    {f.required && <span className='text-rose'> *</span>}
                  </label>
                )}
                {f.type === 'textarea' && (
                  <textarea
                    id={fieldId}
                    rows={4}
                    value={String(value)}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.name, e.target.value)}
                    className={cn(inputClass, 'min-h-24 resize-y')}
                  />
                )}
                {f.type === 'select' && (
                  <select
                    id={fieldId}
                    value={String(value)}
                    required={f.required}
                    onChange={(e) => set(f.name, e.target.value)}
                    className={cn(inputClass, 'h-11 appearance-none')}
                  >
                    {!f.required && <option value=''>None</option>}
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
                {f.type === 'lines' &&
                  (value as string[]).map((line, i) => (
                    <input
                      key={i}
                      aria-label={`${f.label} ${i + 1}`}
                      value={line}
                      placeholder={f.placeholder ? `${f.placeholder} ${i + 1}` : undefined}
                      onChange={(e) => {
                        const next = [...(value as string[])];
                        next[i] = e.target.value;
                        set(f.name, next);
                      }}
                      className={cn(inputClass, 'h-11')}
                    />
                  ))}
                {['text', 'number', 'money', 'date', 'datetime'].includes(f.type) && (
                  <div className='relative'>
                    {f.type === 'money' && (
                      <span className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm'>
                        $
                      </span>
                    )}
                    <input
                      id={fieldId}
                      type={
                        f.type === 'datetime'
                          ? 'datetime-local'
                          : f.type === 'money'
                            ? 'text'
                            : f.type
                      }
                      inputMode={
                        f.type === 'money' ? 'decimal' : f.type === 'number' ? 'numeric' : undefined
                      }
                      value={String(value)}
                      required={f.required}
                      placeholder={f.placeholder}
                      min={f.min}
                      max={f.max}
                      pattern={
                        f.type === 'money'
                          ? f.allowNegative
                            ? '-?[0-9,]*\\.?[0-9]{0,2}'
                            : '[0-9,]*\\.?[0-9]{0,2}'
                          : undefined
                      }
                      onChange={(e) => set(f.name, e.target.value)}
                      className={cn(inputClass, 'h-11', f.type === 'money' && 'pl-7')}
                    />
                  </div>
                )}
                {f.help && <p className='text-muted-foreground text-xs'>{f.help}</p>}
              </div>
            );
          })}
        </form>
        {error && (
          <p
            role='alert'
            className='bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm'
          >
            {error}
          </p>
        )}
        <DialogFooter className='gap-2'>
          <Button
            variant='ghost'
            size='lg'
            className='rounded-full'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            form={`form-${entity}`}
            size='lg'
            className='rounded-full px-6'
            disabled={pending}
          >
            {pending && <Icons.spinner className='animate-spin' />}
            {submitLabel ?? 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
