-- C.9 Chuvas · dias de chuva previstos >5mm por mês (métrica-base de impacto · DIAS CHUVA PREV >5mm)
alter table public.obra_chuvas_meses add column if not exists dias_prev_5mm numeric;
