// Página de LOGIN — rota pública, fora do app shell (sibling de /design-system).
// Split-screen: painel de marca (esq.) + formulário (dir.). Auth real via Supabase
// (useAuth().signIn). Se já logado, redireciona pro destino (?redirect=) ou "/".

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { Button, FormField, I, Input, PasswordInput } from "@/components/ds";
import { useAuth } from "@/contexts/UserContext";
import "./login.css";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Adm Contratual IA" }] }),
});

function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const emailId = useId();
  const pwdId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Já autenticado (sessão restaurada) → sai do login pro destino. Só aceita
  // destino INTERNO (path começando com "/", e não "//") — evita open-redirect.
  useEffect(() => {
    if (status === "authenticated") {
      const dest =
        redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- destino dinâmico (path interno)
      navigate({ to: dest as any, replace: true });
    }
  }, [status, redirect, navigate]);

  // Foco no e-mail ao abrir (se não estiver logado).
  useEffect(() => {
    if (status === "unauthenticated") emailRef.current?.focus();
  }, [status]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await signIn(email, password);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível entrar.");
        setSubmitting(false);
      }
      // sucesso → o efeito de status="authenticated" redireciona (mantém submitting até desmontar)
    } catch {
      // qualquer exceção inesperada (ex.: Supabase sem env) — destrava o botão.
      setError("Não foi possível entrar. Tente de novo.");
      setSubmitting(false);
    }
  }

  return (
    <main className="lg">
      {/* Painel de marca */}
      <aside className="lg-brand" aria-hidden="true">
        <div className="lg-brand-glow" />
        <div className="lg-brand-grid" />
        <div className="lg-brand-inner">
          <div className="lg-logo">
            <span className="lg-logo-mark">{I.shield({ size: 22 })}</span>
            <span className="lg-logo-text">
              Adm Contratual <span className="lg-logo-ia">IA</span>
            </span>
          </div>
          <h1 className="lg-brand-title">
            Administração contratual de obras, <span className="lg-accent">24/7</span>.
          </h1>
          <p className="lg-brand-sub">
            Diagnóstico contínuo, quantificação de desequilíbrio econômico-financeiro e geração de
            RMA, claims e pareceres — operados por agentes de IA especializados.
          </p>
          <ul className="lg-brand-feats">
            <li>
              <span className="lg-feat-ic">{I.check({ size: 14 })}</span> RMA mensal automatizado
            </li>
            <li>
              <span className="lg-feat-ic">{I.check({ size: 14 })}</span> Painel de Desequilíbrio
              (M3)
            </li>
            <li>
              <span className="lg-feat-ic">{I.check({ size: 14 })}</span> Gerador de Claim e
              pareceres
            </li>
          </ul>
        </div>
        <div className="lg-brand-foot">© {new Date().getFullYear()} · Vorata</div>
      </aside>

      {/* Formulário */}
      <section className="lg-pane">
        <form className="lg-form" onSubmit={onSubmit} noValidate>
          <header className="lg-form-head">
            <h2 className="lg-form-title">Entrar</h2>
            <p className="lg-form-sub">Acesse sua conta para continuar.</p>
          </header>

          {error ? (
            <div className="lg-alert" role="alert">
              <span className="lg-alert-ic" aria-hidden>
                {I.close({ size: 14 })}
              </span>
              {error}
            </div>
          ) : null}

          <FormField label="E-mail" htmlFor={emailId}>
            <Input
              ref={emailRef}
              id={emailId}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="voce@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </FormField>

          <FormField label="Senha" htmlFor={pwdId}>
            <PasswordInput
              id={pwdId}
              autoComplete="current-password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </FormField>

          <div className="lg-row">
            <button type="button" className="lg-forgot" tabIndex={0}>
              Esqueci minha senha
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="lg-submit"
            disabled={submitting}
          >
            {submitting ? "Entrando…" : "Entrar"}
          </Button>

          <p className="lg-foot">
            Acesso restrito. Não tem conta? Peça um convite ao administrador da sua empresa.
          </p>
        </form>
      </section>
    </main>
  );
}
