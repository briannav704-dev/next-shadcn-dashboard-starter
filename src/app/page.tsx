import { redirect } from 'next/navigation';

import { requireOwnerPage } from '@/server/session';

export default async function Home() {
  await requireOwnerPage();
  redirect('/life');
}
