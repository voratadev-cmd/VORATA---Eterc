-- C.14 Mapa · o workbook v46 redefiniu os "segmentos" (10 faixas de Duplicação, fonte cronograma) em
-- 16 FRENTES FÍSICAS tipadas (Trecho / OAE / Dispositivo / Talude / Geodreno · fonte PQ). O CHECK de
-- `tipo` só permitia 'duplicacao'/'sinistro'; expande para os tipos do v46. Mantém os antigos para
-- retrocompat (outras obras / Sorriso). Idempotente.
alter table public.obra_mapa_segmentos drop constraint if exists obra_mapa_segmentos_tipo_check;
alter table public.obra_mapa_segmentos add constraint obra_mapa_segmentos_tipo_check
  check (tipo = any (array['duplicacao', 'sinistro', 'trecho', 'oae', 'dispositivo', 'talude', 'geodreno']));
