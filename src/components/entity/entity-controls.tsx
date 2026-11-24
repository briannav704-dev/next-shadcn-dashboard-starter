'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { deleteEntityAction, updateEntityAction } from '@/features/entities/server/actions';
import { cn } from '@/lib/utils';

import { EntityFormDialog, type FieldSpec } from './entity-form-dialog';

type Values = Record<string, unknown>;

/** "Add" button that opens a create form. Dialog state resets each time it opens. */
export function AddButton({
  entity,
  label,
  title,
  fields,
  initial,
  fixed,
  variant = 'default',
  mode = 'create',
  className
}: {
  entity: string;
  label: string;
  title: string;
  fields: FieldSpec[];
  initial?: Values;
  fixed?: Values;
  variant?: 'default' | 'outline' | 'ghost';
  mode?: 'create' | 'upsert';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size='lg'
        className={cn('rounded-full px-4', variant === 'default' && 'shadow-sm', className)}
        aria-label={label ? undefined : title}
        onClick={() => setOpen(true)}
      >
        <Icons.add />
        {label}
      </Button>
      {open && (
        <EntityFormDialog
          entity={entity}
          title={title}
          fields={fields}
          initial={initial}
          fixed={fixed}
          mode={mode}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

/** Edit / delete menu for one record. */
export function RowActions({
  entity,
  id,
  label,
  fields,
  values,
  extra
}: {
  entity: string;
  id: string;
  /** Human name of the record, used in titles and the delete confirmation. */
  label: string;
  fields?: FieldSpec[];
  values?: Values;
  extra?: { label: string; icon?: keyof typeof Icons; patch: Values }[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteEntityAction({ entity, id });
      if (result.ok) toast.success('Deleted');
      else toast.error(result.error);
      setConfirming(false);
    });
  }

  function patch(values: Values) {
    startTransition(async () => {
      const result = await updateEntityAction({ entity, id, values });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              className='text-muted-foreground hover:text-foreground shrink-0'
              aria-label={`Options for ${label}`}
              disabled={pending}
            />
          }
        >
          {pending ? <Icons.spinner className='animate-spin' /> : <Icons.dots />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-40'>
          {extra?.map((item) => {
            const Icon = item.icon ? Icons[item.icon] : null;
            return (
              <DropdownMenuItem key={item.label} onClick={() => patch(item.patch)}>
                {Icon && <Icon />}
                {item.label}
              </DropdownMenuItem>
            );
          })}
          {fields && (
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Icons.edit />
              Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant='destructive' onClick={() => setConfirming(true)}>
            <Icons.trash />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && fields && (
        <EntityFormDialog
          entity={entity}
          title={`Edit ${label}`}
          fields={fields}
          initial={values}
          recordId={id}
          open={editing}
          onOpenChange={setEditing}
        />
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can’t be undone. The deletion is recorded in your activity log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={remove} disabled={pending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** A round check that flips one boolean field, with instant feedback. */
export function EntityCheck({
  entity,
  id,
  field,
  checked,
  label
}: {
  entity: string;
  id: string;
  field: string;
  checked: boolean;
  label: string;
}) {
  // Reverts to the server value automatically if the save fails.
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [, startTransition] = useTransition();

  return (
    <button
      type='button'
      aria-pressed={optimistic}
      aria-label={`${optimistic ? 'Uncheck' : 'Check'} ${label}`}
      onClick={() => {
        const next = !optimistic;
        startTransition(async () => {
          setOptimistic(next);
          const result = await updateEntityAction({ entity, id, values: { [field]: next } });
          if (!result.ok) toast.error(result.error);
        });
      }}
      className={cn(
        'focus-visible:ring-ring/60 grid size-6 shrink-0 place-items-center rounded-full border outline-none transition-colors focus-visible:ring-2',
        optimistic
          ? 'border-rose bg-rose text-primary-foreground'
          : 'border-input hover:border-rose/60'
      )}
    >
      {optimistic && <Icons.check className='size-3.5' />}
    </button>
  );
}
