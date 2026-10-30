import {describe, expect, it} from 'vitest';
import {withoutAccountParams} from '../vercelBeforeSend';

const SITE = 'https://inkweave.ink';

describe('withoutAccountParams', () => {
  it("drops a friend's handle and keeps the binder's other params", () => {
    const event = {type: 'pageview' as const, url: `${SITE}/browse?binder=all&friend=ruby_hero_042&q=elsa`};

    expect(withoutAccountParams(event).url).toBe(`${SITE}/browse?binder=all&q=elsa`);
  });

  it("drops a sign-in's one-time code", () => {
    const event = {type: 'pageview' as const, url: `${SITE}/auth/callback?code=4f2a9c`};

    expect(withoutAccountParams(event).url).toBe(`${SITE}/auth/callback`);
  });

  // Vercel reads its utm_ fields from the address's query.
  it('keeps a utm_ param beside a dropped one', () => {
    const event = {type: 'pageview' as const, url: `${SITE}/browse?friend=ruby_hero_042&utm_source=discord`};

    expect(withoutAccountParams(event).url).toBe(`${SITE}/browse?utm_source=discord`);
  });

  // Rewriting the query would re-encode it: %20 would go as +.
  it('sends an address with neither param as it came', () => {
    const event = {type: 'pageview' as const, url: `${SITE}/browse?q=a%20b`};

    expect(withoutAccountParams(event)).toBe(event);
  });

  it("keeps a Speed Insights vital's type and route", () => {
    const vital = {type: 'vital' as const, url: `${SITE}/browse?friend=ruby_hero_042`, route: '/browse'};

    expect(withoutAccountParams(vital)).toEqual({type: 'vital', url: `${SITE}/browse`, route: '/browse'});
  });
});
