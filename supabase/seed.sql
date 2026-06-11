-- Seed amostral para desenvolvimento local.
-- Inserir só 4 seleções pra ter algo na tela. As 48 oficiais entram via script de import.

insert into public.countries (code, name, flag_emoji, group_letter) values
  ('BRA', 'Brasil',     '🇧🇷', 'A'),
  ('ARG', 'Argentina',  '🇦🇷', 'B'),
  ('FRA', 'França',     '🇫🇷', 'C'),
  ('ESP', 'Espanha',    '🇪🇸', 'D');

-- TODO: importar as 26 convocações oficiais por país via scripts/import-squads.ts
