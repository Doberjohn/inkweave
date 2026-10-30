-- What the remap migration needs beyond ../friends/scaffold.sql: public.votes, which
-- remap_card_ids and undo_card_id_remap lock and look up. The checks remap collections and
-- decks only, so a vote needs no column but its id.
create table public.votes (id uuid primary key);
