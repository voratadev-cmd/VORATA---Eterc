-- Premissas DECLARADAS por obra (config durável — não regravada pelo normalizador).
-- Caso de uso: caminho crítico do Windows Analysis (C.13) declarado pelo idealizador quando a
-- planilha não traz célula própria. Shape: {"caminho_critico": "...", "fonte": "..."}.
alter table public.obras add column if not exists premissas jsonb;
