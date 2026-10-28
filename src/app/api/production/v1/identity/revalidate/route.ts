import { createIdentityHandler } from '@/lib/production-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = createIdentityHandler('revalidate', async () =>
  (await import('@/lib/production-identity-store')).identityStore);
