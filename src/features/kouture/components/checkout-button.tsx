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
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

import { checkoutAppointmentAction } from '../server/actions';

const inputClass =
  'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-xl border pl-7 pr-3 text-base outline-none focus-visible:ring-3 md:text-sm';

function toCents(value: string) {
  const n = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/** Completes a visit: deposit (taken by card through Nailzy), cash balance and tip. */
export function CheckoutButton({
  appointmentId,
  clientName,
  priceCents,
  depositCents,
  depositRecorded
}: {
  appointmentId: string;
  clientName: string;
  priceCents: number;
  depositCents: number;
  depositRecorded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [depositPaid, setDepositPaid] = useState(true);
  const due = Math.max(0, priceCents - (depositPaid || depositRecorded ? depositCents : 0));
  const [balance, setBalance] = useState((due / 100).toFixed(2));
  const [method, setMethod] = useState<'cash' | 'stripe' | 'other'>('cash');
  const [tip, setTip] = useState('');
  const [pending, startTransition] = useTransition();

  function toggleDeposit(paid: boolean) {
    setDepositPaid(paid);
    setBalance((Math.max(0, priceCents - (paid ? depositCents : 0)) / 100).toFixed(2));
  }

  function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await checkoutAppointmentAction({
        appointmentId,
        depositPaid: depositRecorded ? false : depositPaid,
        balanceCents: toCents(balance),
        balanceMethod: method,
        tipCents: toCents(tip)
      });
      if (result.ok) {
        toast.success(`${clientName} checked out`);
        setOpen(false);
      } else toast.error(result.error);
    });
  }

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        className='border-rose/40 text-rose hover:bg-blush rounded-full'
        onClick={() => setOpen(true)}
      >
        Check out
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='rounded-2xl sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='font-display text-2xl font-medium'>
              Check out {clientName}
            </DialogTitle>
            <DialogDescription>
              {priceCents > 0
                ? `Service total ${formatCents(priceCents)}.`
                : 'No price on this booking yet; enter what they paid.'}
            </DialogDescription>
          </DialogHeader>
          <form id={`checkout-${appointmentId}`} onSubmit={submit} className='grid gap-4'>
            {depositCents > 0 && (
              <label className='flex items-center gap-2.5 text-sm'>
                <input
                  type='checkbox'
                  className='size-4 accent-[var(--rose)]'
                  checked={depositRecorded || depositPaid}
                  disabled={depositRecorded}
                  onChange={(e) => toggleDeposit(e.target.checked)}
                />
                {formatCents(depositCents)} deposit paid by card at booking
                {depositRecorded && <span className='text-muted-foreground'>(recorded)</span>}
              </label>
            )}
            <div className='grid grid-cols-2 gap-3'>
              <label className='flex flex-col gap-1.5 text-sm font-medium'>
                Balance paid
                <span className='relative'>
                  <span className='text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm'>
                    $
                  </span>
                  <input
                    inputMode='decimal'
                    pattern='[0-9,]*\.?[0-9]{0,2}'
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className={inputClass}
                  />
                </span>
              </label>
              <label className='flex flex-col gap-1.5 text-sm font-medium'>
                Paid by
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                  className={cn(inputClass, 'appearance-none pl-3')}
                >
                  <option value='cash'>Cash</option>
                  <option value='stripe'>Card (Stripe)</option>
                  <option value='other'>Other</option>
                </select>
              </label>
              <label className='col-span-2 flex flex-col gap-1.5 text-sm font-medium'>
                Tip (cash)
                <span className='relative'>
                  <span className='text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm'>
                    $
                  </span>
                  <input
                    inputMode='decimal'
                    pattern='[0-9,]*\.?[0-9]{0,2}'
                    placeholder='0.00'
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    className={inputClass}
                  />
                </span>
              </label>
            </div>
          </form>
          <DialogFooter className='gap-2'>
            <Button
              variant='ghost'
              size='lg'
              className='rounded-full'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              form={`checkout-${appointmentId}`}
              size='lg'
              className='rounded-full px-6'
              disabled={pending}
            >
              {pending && <Icons.spinner className='animate-spin' />}
              Complete visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
