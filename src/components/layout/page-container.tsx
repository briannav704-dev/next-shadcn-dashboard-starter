import type * as React from 'react';

import { Heading } from '../ui/heading';

export default function PageContainer({
  children,
  pageTitle,
  pageDescription,
  eyebrow,
  pageHeaderAction
}: {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  eyebrow?: string;
  pageHeaderAction?: React.ReactNode;
}) {
  return (
    <div className='mx-auto flex w-full max-w-[90rem] min-w-0 flex-1 flex-col px-4 py-5 md:px-8 md:py-8'>
      {(pageTitle || pageHeaderAction) && (
        <div className='mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 md:mb-8'>
          <Heading title={pageTitle ?? ''} description={pageDescription} eyebrow={eyebrow} />
          {pageHeaderAction && <div className='flex flex-wrap gap-2'>{pageHeaderAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
