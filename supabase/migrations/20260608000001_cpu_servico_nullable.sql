-- Migration · Normalização — CPU.servico NULLABLE (fix do drop de 7 CPUs reais)
-- A fonte tem 7 CPUs Principais VÁLIDAS sem nome de Serviço (custo direto/MOD/EQP preenchidos). O
-- resolver passou a preservá-las (eram dado real perdido), então `servico` deixa de ser obrigatório.
-- Idempotente: drop not null é no-op se já estiver nullable.
alter table public.obra_cpu_coeficientes alter column servico drop not null;
