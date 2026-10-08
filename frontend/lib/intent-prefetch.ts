import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
type Router = Pick<AppRouterInstance, 'prefetch'>;
const targets = new Map<string, number>();

export function prefetchOnce(router: Router, href: string) {
  const now = Date.now();
  if ((targets.get(href) ?? 0) > now) return;
  const expires = now + 60_000;
  targets.delete(href);
  targets.set(href, expires);
  if (targets.size > 256) targets.delete(targets.keys().next().value!);
  const clear = () => { if (targets.get(href) === expires) targets.delete(href); };
  try { router.prefetch(href, { kind: PrefetchKind.FULL, onInvalidate: clear }); }
  catch { clear(); }
}
