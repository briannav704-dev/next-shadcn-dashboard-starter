import { Cormorant_Garamond, Jost } from 'next/font/google';

import { cn } from '@/lib/utils';

const fontJost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  display: 'swap'
});

const fontCormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap'
});

export const fontVariables = cn(fontJost.variable, fontCormorant.variable);
