-- Harden decks.updated_at against client forgery on INSERT (CodeRabbit #480).
--
-- The decks_set_updated_at trigger fired BEFORE UPDATE only, so on INSERT the
-- column fell back to its `default now()` — which an authenticated client can
-- override by POSTing an explicit updated_at (e.g. a far-future timestamp).
-- decks_public_updated_idx orders the Phase-4 public feed by `updated_at desc`,
-- so a forged value could pin a deck at the top of the feed. Widen the existing
-- stamper to BEFORE INSERT OR UPDATE so updated_at is server-owned on every path.
--
-- created_at is deliberately left client-settable: deckRepository.deckToInsert
-- carries the local draft's created_at so an aged anonymous draft keeps its real
-- age when it migrates to the cloud (PLAN Phase 1). It is unindexed and low-impact,
-- so it stays under the app's control rather than being reset to migration time.

drop trigger if exists decks_set_updated_at on public.decks;

create trigger decks_set_updated_at
  before insert or update on public.decks
  for each row execute function public.set_updated_at();
