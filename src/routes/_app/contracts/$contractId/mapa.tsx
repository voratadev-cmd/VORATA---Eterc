// C.14 — Mapa da Obra. Estado de liberação das 16 FRENTES FÍSICAS ao longo da rodovia
// (km 144,6 → 190,3): 5 trechos de pista + 11 pontuais (OAEs/dispositivos/talude/geodreno), do dado
// REAL normalizado (obra_mapa_segmentos · Σ 381,6 mi) + 2 transversais sem km (obra_secoes · 229,8 mi
// → PV 611,4 mi). Premissa contratual: tudo liberado por padrão; o impedimento é a EXCEÇÃO, registrada
// por faixa de km + janela de meses. O mapa calcula o % impedido mês a mês (liberação progressiva).
// O simulador de impedimentos é client-side (input do usuário) — a BR-101 hoje não tem impedimento
// registrado, então o estado inicial mostra tudo liberado (honesto). Tokens-only; texto sobre o
// asfalto escuro usa --on-accent; farol via cor de valor / Badge — nunca tarja de borda.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, Info, LockOpen, Route as RouteIcon, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, EmptyState, I, Input, Select, Skeleton } from "@/components/ds";
import { type MapaObraView, useMapaObra } from "@/lib/hooks/useMapaObra";
import type { FrenteMapa, FrenteTipo } from "@/lib/supabase/mapaSegmentos";
import "./mapa.css";

export const Route = createFileRoute("/_app/contracts/$contractId/mapa")({
  component: MapaRoute,
  head: () => ({ meta: [{ title: "Mapa da Obra — RDM IA" }] }),
});

// ── Formatadores ─────────────────────────────────────────────────────────────
const fmtMi = (n: number) =>
  `R$ ${(n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
const fmtBRL = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const fmtKm = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const fmtPct = (a: number, b: number) =>
  b > 0
    ? `${((a / b) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : "0,0%";

const TIPO_LABEL: Record<FrenteTipo, string> = {
  trecho: "Pista",
  oae: "OAE",
  dispositivo: "Dispositivo",
  talude: "Talude",
  geodreno: "Geodreno",
};
// "Trecho 01" → "T01" · "Duplicação 177–183,7" → "177–183,7" (rótulo curto na pista)
const shortPista = (nome: string) => nome.replace("Duplicação ", "").replace("Trecho ", "T");
// "OAE Rio Macaé" → "Macaé" · "Dispositivo KM 152" → "KM 152" (rótulo curto do pontual)
const shortPont = (nome: string) =>
  nome
    .replace(/^OAE\s+(Rio\s+)?/i, "")
    .replace(/^Alargamento OAE\s+/i, "Alarg. ")
    .replace(/^Dispositivo\s+/i, "")
    .replace(/^Recuperação de\s+/i, "")
    .replace(/^Pré-Furo\s+/i, "")
    .trim();

// ── Simulador de impedimentos (client-side) ──────────────────────────────────
type Imped = {
  frente: string;
  ki: number;
  kf: number;
  causa: string;
  desde: number; // índice do mês
  lib: number | null; // índice do mês · null = ainda impedido
};

/** fração já liberada de um impedimento no mês (liberação linear entre `desde` e `lib`). */
function fracLiberada(im: Imped, mes: number): number {
  if (mes < im.desde) return 1;
  if (im.lib === null) return 0;
  if (mes >= im.lib) return 1;
  return (mes - im.desde) / (im.lib - im.desde);
}
function impAtivo(im: Imped, mes: number): boolean {
  return mes >= im.desde && (im.lib === null || mes < im.lib);
}
/** valor impedido de um impedimento num mês = fração espacial × valor da frente × (1 − liberado). */
function valImpMes(im: Imped, mes: number, byNome: (n: string) => FrenteMapa | undefined): number {
  if (!impAtivo(im, mes)) return 0;
  const fr = byNome(im.frente);
  if (!fr) return 0;
  const ext = fr.kmFim - fr.kmInicio || 0.1;
  const fracEsp = fr.ehPista && im.kf > im.ki ? Math.min(1, (im.kf - im.ki) / ext) : 1;
  return fracEsp * fr.valorRs * (1 - fracLiberada(im, mes));
}

function MapaRoute() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError } = useMapaObra(contractId);

  if (isLoading) {
    return (
      <div className="mp-page">
        <Skeleton style={{ height: 28, width: 340, marginBottom: 12 }} />
        <Skeleton style={{ height: 64, marginBottom: 16 }} />
        <Skeleton style={{ height: 320 }} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mp-page">
        <EmptyState
          icon={I.map({ size: 40 })}
          title="Mapa da obra ainda não disponível"
          text="O mapa das frentes (C.14) ainda não foi normalizado para esta obra. Assim que o workbook for processado, o estado de liberação por km aparece aqui."
          framed
        />
      </div>
    );
  }
  return <MapaView view={data} />;
}

function MapaView({ view }: { view: MapaObraView }) {
  const { frentes, transversais, somaFisica, somaTransversal, meses, bmCorrenteIdx } = view;
  const [mes, setMes] = useState<number>(bmCorrenteIdx);
  const [impedimentos, setImpedimentos] = useState<Imped[]>([]);

  const byNome = useMemo(() => {
    const m = new Map(frentes.map((f) => [f.nome, f]));
    return (n: string) => m.get(n);
  }, [frentes]);

  const pistas = useMemo(() => frentes.filter((f) => f.ehPista), [frentes]);
  const pontuais = useMemo(() => frentes.filter((f) => !f.ehPista), [frentes]);

  // ── derivados do mês selecionado ──
  const valImpFrente = (nome: string) =>
    impedimentos
      .filter((im) => im.frente === nome)
      .reduce((a, im) => a + valImpMes(im, mes, byNome), 0);
  const pctImpFrente = (f: FrenteMapa) =>
    f.valorRs > 0 ? Math.min(100, (valImpFrente(f.nome) / f.valorRs) * 100) : 0;
  const totalImp = impedimentos.reduce((a, im) => a + valImpMes(im, mes, byNome), 0);
  const nFrentesImp = new Set(
    impedimentos
      .filter((im) => impAtivo(im, mes) && valImpMes(im, mes, byNome) > 0)
      .map((im) => im.frente),
  ).size;
  const liberado = somaFisica - totalImp;

  return (
    <div className="mp-page">
      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <header className="mp-head">
        <div>
          <h1 className="mp-title">Mapa da Obra</h1>
          <p className="mp-sub">
            Estado de liberação das <b>16 frentes físicas</b> ao longo da rodovia · km{" "}
            {fmtKm(view.kmMin)} a {fmtKm(view.kmMax)}. Registre impedimentos por faixa de km e
            janela de meses — o mapa calcula o <b>% impedido mês a mês</b>.
          </p>
        </div>
        <Badge tone={nFrentesImp > 0 ? "danger" : "success"}>
          {nFrentesImp > 0
            ? `${nFrentesImp} frente${nFrentesImp > 1 ? "s" : ""} impedida${nFrentesImp > 1 ? "s" : ""}`
            : "Tudo liberado"}
        </Badge>
      </header>

      <div className="mp-howto">
        <Info size={16} className="mp-howto-ic" />
        <span>
          <b>Como funciona:</b> por padrão tudo liberado. Registre um impedimento com a{" "}
          <b>faixa de km</b> (quanto da frente travou), o <b>mês de início</b> e o{" "}
          <b>mês de liberação</b> (vazio = ainda impedido). O sistema calcula o valor impedido de
          cada mês, com liberação progressiva. Mova o slider para ver o estado real de cada mês.
        </span>
      </div>

      {/* ── KPIs do mês ─────────────────────────────────────────────── */}
      <div className="mp-sec">Situação em {meses[mes]}</div>
      <div className="mp-kpis">
        <Kpc
          icon={<LockOpen size={17} />}
          label="Liberado"
          value={fmtMi(liberado)}
          valueTone="success"
          sub={`${fmtPct(liberado, somaFisica)} da obra física`}
        />
        <Kpc
          icon={<Ban size={17} />}
          label="Impedido"
          value={fmtMi(totalImp)}
          valueTone={totalImp > 0 ? "danger" : "neutral"}
          sub={`${fmtPct(totalImp, somaFisica)} · em ${meses[mes]}`}
        />
        <Kpc
          icon={<TriangleAlert size={17} />}
          label="Frentes impedidas"
          value={String(nFrentesImp)}
          valueTone="neutral"
          sub={`de ${frentes.length} frentes físicas`}
        />
        <Kpc
          icon={<RouteIcon size={17} />}
          label="Obra física total"
          value={fmtMi(somaFisica)}
          valueTone="neutral"
          sub={`+ ${fmtMi(somaTransversal)} transversais`}
        />
      </div>

      {/* ── Slider de mês ───────────────────────────────────────────── */}
      <Card className="mp-card mp-sliderwrap">
        <div className="mp-sliderhd">
          <div className="mp-slidermes">
            {meses[mes]}{" "}
            <span>
              · mês {mes + 1} de {meses.length}
            </span>
          </div>
          <div className="mp-sliderlib">
            Liberado: <b>{fmtMi(liberado)}</b> de {fmtMi(somaFisica)}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={meses.length - 1}
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="mp-slider"
          aria-label="Mês do mapa"
        />
      </Card>

      {/* ── Retigráfico ─────────────────────────────────────────────── */}
      <Card className="mp-card">
        <div className="mp-panhd">
          <div className="mp-pt">Rodovia · 16 frentes da PQ</div>
          <div className="mp-lgnd">
            <span>
              <svg className="mp-lgic" viewBox="0 0 24 20">
                <Bridge cx={12} cy={12} />
              </svg>{" "}
              OAE
            </span>
            <span>
              <svg className="mp-lgic" viewBox="0 0 22 20">
                <Loop cx={11} cy={11} />
              </svg>{" "}
              dispositivo
            </span>
            <span>
              <svg className="mp-lgic" viewBox="0 0 22 20">
                <Talude cx={11} cy={11} />
              </svg>{" "}
              talude
            </span>
            <span>
              <svg className="mp-lgic" viewBox="0 0 20 20">
                <Droplet cx={10} cy={10} />
              </svg>{" "}
              geodreno
            </span>
            <span>
              <i className="mp-sw-imp" /> impedido no mês
            </span>
          </div>
        </div>
        <Retigrafico
          view={view}
          pistas={pistas}
          pontuais={pontuais}
          impedimentos={impedimentos}
          mes={mes}
          byNome={byNome}
          pctImpFrente={pctImpFrente}
        />
      </Card>

      {/* ── Registrar impedimento ───────────────────────────────────── */}
      <Card className="mp-card">
        <div className="mp-pt">＋ Registrar impedimento de liberação</div>
        <ImpedForm
          frentes={frentes}
          meses={meses}
          mes={mes}
          onAdd={(im) => setImpedimentos((p) => [...p, im])}
        />
      </Card>

      {/* ── Impedimentos registrados ────────────────────────────────── */}
      <Card className="mp-card">
        <div className="mp-pt">Impedimentos registrados</div>
        <ImpedTable
          impedimentos={impedimentos}
          meses={meses}
          mes={mes}
          byNome={byNome}
          onDel={(i) => setImpedimentos((p) => p.filter((_, j) => j !== i))}
        />
      </Card>

      {/* ── Frentes físicas ─────────────────────────────────────────── */}
      <Card className="mp-card">
        <div className="mp-pt">Frentes físicas — estado em {meses[mes]}</div>
        <div className="mp-tscroll">
          <table className="mp-t">
            <thead>
              <tr>
                <th>Frente</th>
                <th>Tipo</th>
                <th>km</th>
                <th className="r">Valor (R$)</th>
                <th className="r">% impedido</th>
                <th className="r">Impedido (R$)</th>
              </tr>
            </thead>
            <tbody>
              {frentes.map((f) => {
                const pImp = pctImpFrente(f);
                const vImp = valImpFrente(f.nome);
                return (
                  <tr key={f.codigo}>
                    <td className="mp-strong">{f.nome}</td>
                    <td>{TIPO_LABEL[f.tipo]}</td>
                    <td>
                      {f.ehPista ? `${fmtKm(f.kmInicio)}–${fmtKm(f.kmFim)}` : fmtKm(f.kmInicio)}
                    </td>
                    <td className="r">{fmtBRL(f.valorRs)}</td>
                    <td className="r">
                      {pImp > 0 ? (
                        <span className="mp-pctcell">
                          <span className="mp-pctbar">
                            <i style={{ width: `${Math.min(100, pImp)}%` }} />
                          </span>
                          {pImp.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="mp-nil">—</span>
                      )}
                    </td>
                    <td className="r">
                      {vImp > 0 ? fmtBRL(vImp) : <span className="mp-nil">—</span>}
                    </td>
                  </tr>
                );
              })}
              <tr className="mp-tot">
                <td colSpan={3}>TOTAL ({frentes.length} frentes = obra física)</td>
                <td className="r">{fmtBRL(somaFisica)}</td>
                <td className="r">{totalImp > 0 ? fmtPct(totalImp, somaFisica) : "—"}</td>
                <td className="r">{totalImp > 0 ? fmtBRL(totalImp) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Itens transversais ──────────────────────────────────────── */}
      <Card className="mp-card">
        <div className="mp-pt">
          Itens transversais{" "}
          <span className="mp-pt-hint">(sem km · não impedíveis por trecho)</span>
        </div>
        <div className="mp-tscroll">
          <table className="mp-t mp-t-narrow">
            <thead>
              <tr>
                <th>Item</th>
                <th>Natureza</th>
                <th>Tratado em</th>
                <th className="r">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {transversais.map((t) => (
                <tr key={t.nome} className="mp-transv">
                  <td className="mp-strong">{t.nome}</td>
                  <td>{t.natureza}</td>
                  <td>{t.tratadoEm}</td>
                  <td className="r">{fmtBRL(t.valorRs)}</td>
                </tr>
              ))}
              <tr className="mp-tot">
                <td colSpan={3}>SUBTOTAL TRANSVERSAL</td>
                <td className="r">{fmtBRL(somaTransversal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mp-note">
          <b>Como o valor é calculado:</b> o impedido de uma frente num mês = (km impedidos ÷
          extensão da frente) × valor da frente × (1 − % já liberado). A liberação é progressiva e
          linear entre "desde" e "liberado em". As {frentes.length} frentes físicas (
          {fmtMi(somaFisica)}) +{" "}
          {transversais
            .map((t) => `${t.nome.split(" ").slice(0, 2).join(" ")} ${fmtMi(t.valorRs)}`)
            .join(" + ")}{" "}
          = PV {fmtMi(view.pv)}. Este total alimenta a curva "Liberado" da C.8 e o Panorama (C.10).
        </p>
      </Card>

      {/* ── Leitura IA (card escuro · div p/ não conflitar com .card branco) ── */}
      <div className="mp-ia">
        <div className="mp-ia-h">
          <span className="mp-ia-badge">IA</span>
          <span className="mp-pt">Leitura do mapa — {meses[mes]}</span>
        </div>
        {nFrentesImp === 0 ? (
          <p>
            Obra <b>toda liberada</b> neste mês — nenhuma frente impedida. As {frentes.length}{" "}
            frentes físicas (<b>{fmtMi(somaFisica)}</b>) estão disponíveis. A premissa contratual é
            tudo liberado por padrão: o impedimento é a exceção que exige registro com data.
            Registre impedimentos no formulário para o mapa refletir o mês a mês. Transversais
            (Admin Local e Materiais FD, <b>{fmtMi(somaTransversal)}</b>): tratados em C.4 e
            C.3/C.6.
          </p>
        ) : (
          <p>
            <b>
              {nFrentesImp} frente{nFrentesImp > 1 ? "s" : ""} com impedimento
            </b>{" "}
            neste mês, somando <b>{fmtBRL(totalImp)}</b> ({fmtPct(totalImp, somaFisica)} da obra
            física). Esse é o valor que estava liberado-não-disponível em {meses[mes]} e alimenta a
            responsabilidade da Contratante na <b>C.8</b> e no <b>Panorama (C.10)</b>. Mova o slider
            para ver o impedido evoluir — a liberação progressiva reduz o valor ao longo da janela.
          </p>
        )}
      </div>
    </div>
  );
}

// ── KPI card (padrão canônico: chip de ícone · sem tarja de borda) ───────────
function Kpc({
  icon,
  label,
  value,
  valueTone,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueTone: "success" | "danger" | "neutral";
  sub: string;
}) {
  return (
    <div className="mp-kpc">
      <div className="mp-kpc-hd">
        <span className="mp-kpc-chip">{icon}</span>
        <span className="mp-kpc-l">{label}</span>
      </div>
      <div className={`mp-kpc-v mp-kpc-v-${valueTone}`}>{value}</div>
      <div className="mp-kpc-s">{sub}</div>
    </div>
  );
}

// ── Formulário de impedimento ────────────────────────────────────────────────
function ImpedForm({
  frentes,
  meses,
  mes,
  onAdd,
}: {
  frentes: FrenteMapa[];
  meses: string[];
  mes: number;
  onAdd: (im: Imped) => void;
}) {
  const [frente, setFrente] = useState("");
  const [ki, setKi] = useState("");
  const [kf, setKf] = useState("");
  const [causa, setCausa] = useState("");
  const [desde, setDesde] = useState<number>(mes);
  const [lib, setLib] = useState<number>(-1); // -1 = sem previsão
  const [err, setErr] = useState<string | null>(null);

  const frenteItems = [
    { value: "", label: "— selecione a frente —" },
    ...frentes.map((f) => ({
      value: f.nome,
      label: f.nome,
      hint: f.ehPista ? `${fmtKm(f.kmInicio)}–${fmtKm(f.kmFim)}` : `km ${fmtKm(f.kmInicio)}`,
    })),
  ];
  const mesItems = meses.map((m, i) => ({ value: i, label: m }));
  const libItems = [{ value: -1, label: "— sem previsão —" }, ...mesItems];

  const add = () => {
    if (!frente) {
      setErr("Selecione a frente afetada.");
      return;
    }
    const libVal = lib === -1 ? null : lib;
    if (libVal !== null && libVal <= desde) {
      setErr('"Liberado em" deve ser depois de "Impedido desde".');
      return;
    }
    const kiN = parseFloat(ki);
    const kfN = parseFloat(kf);
    onAdd({
      frente,
      ki: Number.isNaN(kiN) ? 0 : kiN,
      kf: Number.isNaN(kfN) ? 0 : kfN,
      causa: causa.trim(),
      desde,
      lib: libVal,
    });
    setKi("");
    setKf("");
    setCausa("");
    setErr(null);
  };

  return (
    <div className="mp-form">
      <div className="mp-formgrid">
        <label className="mp-fld mp-fld-2">
          <span>Frente afetada</span>
          <Select
            value={frente}
            onChange={setFrente}
            items={frenteItems}
            aria-label="Frente afetada"
          />
        </label>
        <label className="mp-fld">
          <span>km início</span>
          <Input
            type="number"
            step="0.1"
            placeholder="ex: 150"
            value={ki}
            onChange={(e) => setKi(e.target.value)}
          />
          <em>vazio = frente inteira</em>
        </label>
        <label className="mp-fld">
          <span>km fim</span>
          <Input
            type="number"
            step="0.1"
            placeholder="ex: 153"
            value={kf}
            onChange={(e) => setKf(e.target.value)}
          />
        </label>
        <label className="mp-fld mp-fld-2">
          <span>Causa</span>
          <Input
            type="text"
            placeholder="ex: Falta de desapropriação"
            value={causa}
            onChange={(e) => setCausa(e.target.value)}
          />
        </label>
        <label className="mp-fld">
          <span>Impedido desde</span>
          <Select value={desde} onChange={setDesde} items={mesItems} aria-label="Impedido desde" />
        </label>
        <label className="mp-fld">
          <span>Liberado em</span>
          <Select value={lib} onChange={setLib} items={libItems} aria-label="Liberado em" />
          <em>vazio = ainda impedido</em>
        </label>
      </div>
      <div className="mp-formfoot">
        <Button variant="primary" size="md" onClick={add}>
          Adicionar impedimento
        </Button>
        {err && <span className="mp-formerr">{err}</span>}
      </div>
    </div>
  );
}

// ── Tabela de impedimentos registrados ───────────────────────────────────────
function ImpedTable({
  impedimentos,
  meses,
  mes,
  byNome,
  onDel,
}: {
  impedimentos: Imped[];
  meses: string[];
  mes: number;
  byNome: (n: string) => FrenteMapa | undefined;
  onDel: (i: number) => void;
}) {
  if (impedimentos.length === 0) {
    return (
      <div className="mp-empty">
        Nenhum impedimento registrado — obra toda liberada. Use o formulário acima para simular um
        impedimento de liberação.
      </div>
    );
  }
  return (
    <div className="mp-tscroll">
      <table className="mp-t">
        <thead>
          <tr>
            <th>Frente</th>
            <th>Faixa km</th>
            <th>Causa</th>
            <th>Janela (desde → liberado)</th>
            <th className="r">% no mês</th>
            <th className="r">Impedido no mês (R$)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {impedimentos.map((im, i) => {
            const faixa =
              im.kf > im.ki
                ? `${fmtKm(im.ki)}–${fmtKm(im.kf)} (${(im.kf - im.ki).toFixed(1)} km)`
                : "frente inteira";
            const libTxt = im.lib === null ? "sem previsão" : meses[im.lib];
            const pctMes = impAtivo(im, mes) ? (1 - fracLiberada(im, mes)) * 100 : 0;
            const vMes = valImpMes(im, mes, byNome);
            return (
              <tr key={i}>
                <td className="mp-strong">{im.frente}</td>
                <td>{faixa}</td>
                <td>{im.causa || "—"}</td>
                <td>
                  {meses[im.desde]} → {libTxt}
                </td>
                <td className="r">{pctMes.toFixed(0)}%</td>
                <td className="r">{vMes > 0 ? fmtBRL(vMes) : <span className="mp-nil">—</span>}</td>
                <td className="r">
                  <button type="button" className="mp-del" onClick={() => onDel(i)}>
                    excluir
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Retigráfico (SVG) ────────────────────────────────────────────────────────
const ML = 46;
const SVG_W = 1116; // largura útil da via
const ROAD_Y = 50;
const ROAD_H = 44;
const ROAD_BOT = ROAD_Y + ROAD_H;
// centro vertical do marcador por nível de pontual (até 3 níveis escalonados)
const PONT_LVL_Y = [140, 180, 220];

function Retigrafico({
  view,
  pistas,
  pontuais,
  impedimentos,
  mes,
  byNome,
  pctImpFrente,
}: {
  view: MapaObraView;
  pistas: FrenteMapa[];
  pontuais: FrenteMapa[];
  impedimentos: Imped[];
  mes: number;
  byNome: (n: string) => FrenteMapa | undefined;
  pctImpFrente: (f: FrenteMapa) => number;
}) {
  const px = useMemo(() => {
    const span = Math.max(0.001, view.kmMax - view.kmMin);
    return (km: number) => ML + ((km - view.kmMin) / span) * SVG_W;
  }, [view.kmMin, view.kmMax]);

  const ticks: number[] = [];
  for (let km = Math.ceil(view.kmMin / 5) * 5; km <= view.kmMax; km += 5) ticks.push(km);

  // Layout dos pontuais: escalona em até 3 níveis verticais p/ que rótulos próximos não colidam
  // (cluster da esquerda tem 3 itens em km 144,6–144,8). Greedy por km: cada pontual cai no nível
  // mais alto onde não fica a < MIN_GAP do anterior daquele nível.
  const pontLayout = useMemo(() => {
    const MIN_GAP = 58; // unidades do viewBox (~2,4 km)
    const sorted = [...pontuais].sort((a, b) => a.kmInicio - b.kmInicio);
    const lastX: number[] = [];
    return sorted.map((p) => {
      const x = px(p.kmInicio);
      let lvl = 0;
      while (lvl < PONT_LVL_Y.length - 1 && lastX[lvl] != null && x - lastX[lvl] < MIN_GAP) lvl++;
      lastX[lvl] = x;
      return { p, x, cy: PONT_LVL_Y[lvl] };
    });
  }, [pontuais, px]);

  // overlays de impedimento sobre a pista (km impedidos no mês)
  const overlays = impedimentos
    .filter((im) => impAtivo(im, mes) && valImpMes(im, mes, byNome) > 0)
    .map((im) => {
      const fr = byNome(im.frente);
      if (!fr || !fr.ehPista) return null;
      const ki = im.kf > im.ki ? im.ki : fr.kmInicio;
      const kf = im.kf > im.ki ? im.kf : fr.kmFim;
      const x0 = px(Math.max(view.kmMin, ki));
      const x1 = px(Math.min(view.kmMax, kf));
      return x1 > x0 ? { x0, w: x1 - x0, key: `${im.frente}-${im.desde}` } : null;
    })
    .filter(Boolean) as Array<{ x0: number; w: number; key: string }>;

  return (
    <div className="mp-retigwrap">
      <svg className="mp-retig" viewBox="0 0 1200 248" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern
            id="mp-hatch"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="7" height="7" className="mp-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="7" className="mp-hatch-line" />
          </pattern>
        </defs>

        {/* via (asfalto) */}
        <rect
          x={px(view.kmMin)}
          y={ROAD_Y}
          width={px(view.kmMax) - px(view.kmMin)}
          height={ROAD_H}
          className="mp-road"
        />

        {/* trechos: divisores + rótulo + valor */}
        {pistas.map((t, i) => {
          const x0 = px(t.kmInicio);
          const w = px(t.kmFim) - x0;
          return (
            <g key={t.codigo}>
              {i > 0 && <line x1={x0} y1={ROAD_Y} x2={x0} y2={ROAD_BOT} className="mp-segdiv" />}
              {w > 26 && (
                <>
                  <text x={x0 + w / 2} y={ROAD_Y + 18} textAnchor="middle" className="mp-seglbl">
                    {shortPista(t.nome)}
                  </text>
                  <text x={x0 + w / 2} y={ROAD_Y + 32} textAnchor="middle" className="mp-segval">
                    {fmtMi(t.valorRs)}
                  </text>
                </>
              )}
              <title>{`${t.nome} · km ${fmtKm(t.kmInicio)}–${fmtKm(t.kmFim)} · ${fmtBRL(t.valorRs)}`}</title>
            </g>
          );
        })}

        {/* faixa central tracejada */}
        <line
          x1={px(view.kmMin)}
          y1={ROAD_Y + ROAD_H / 2}
          x2={px(view.kmMax)}
          y2={ROAD_Y + ROAD_H / 2}
          className="mp-median"
        />

        {/* overlays de impedimento */}
        {overlays.map((o) => (
          <rect
            key={o.key}
            x={o.x0}
            y={ROAD_Y}
            width={o.w}
            height={ROAD_H}
            fill="url(#mp-hatch)"
            className="mp-hatch-rect"
          />
        ))}

        {/* régua de km */}
        {ticks.map((km) => (
          <g key={km}>
            <line x1={px(km)} y1={ROAD_BOT + 2} x2={px(km)} y2={ROAD_BOT + 8} className="mp-tick" />
            <text x={px(km)} y={ROAD_BOT + 20} textAnchor="middle" className="mp-tick-lbl">
              {km}
            </text>
          </g>
        ))}

        {/* pontuais (escalonados em até 3 níveis p/ legibilidade do cluster esquerdo) */}
        {pontLayout.map(({ p, x, cy }) => {
          const imp = pctImpFrente(p) > 0;
          return (
            <g key={p.codigo} className={imp ? "mp-pont mp-pont-imp" : "mp-pont"}>
              <line x1={x} y1={ROAD_BOT + 22} x2={x} y2={cy - 10} className="mp-pstem" />
              <PontIcon tipo={p.tipo} cx={x} cy={cy} />
              <text x={x} y={cy + 16} textAnchor="middle" className="mp-pontlbl">
                {shortPont(p.nome)}
              </text>
              <title>{`${p.nome} · km ${fmtKm(p.kmInicio)} · ${fmtBRL(p.valorRs)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PontIcon({ tipo, cx, cy }: { tipo: FrenteTipo; cx: number; cy: number }) {
  if (tipo === "oae") return <Bridge cx={cx} cy={cy} />;
  if (tipo === "dispositivo") return <Loop cx={cx} cy={cy} />;
  if (tipo === "geodreno") return <Droplet cx={cx} cy={cy} />;
  return <Talude cx={cx} cy={cy} />;
}

// ── Ícones SVG (cores via classe → tokens; dimensionados pelo viewBox do <svg> pai) ──────────────
function Bridge({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="mp-i-bridge" fill="none" strokeLinecap="round">
      <path d={`M${cx - 11} ${cy} h22`} />
      <path d={`M${cx - 9} ${cy} a4.5 5 0 0 0 9 0 a4.5 5 0 0 0 9 0`} strokeWidth={1.4} />
      <line x1={cx - 9} y1={cy} x2={cx - 9} y2={cy - 5} />
      <line x1={cx} y1={cy} x2={cx} y2={cy - 5} />
      <line x1={cx + 9} y1={cy} x2={cx + 9} y2={cy - 5} />
    </g>
  );
}
function Loop({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="mp-i-loop" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${cx + 7} ${cy} a7 7 0 1 1 -3 -5`} />
      <path d={`M${cx + 4} ${cy - 7} l0 4 l4 0`} />
    </g>
  );
}
function Droplet({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="mp-i-drop">
      <path
        d={`M${cx} ${cy - 8} C${cx + 6} ${cy - 1} ${cx + 5} ${cy + 7} ${cx} ${cy + 7} C${cx - 5} ${cy + 7} ${cx - 6} ${cy - 1} ${cx} ${cy - 8} Z`}
      />
    </g>
  );
}
function Talude({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="mp-i-talude">
      <path
        d={`M${cx - 9} ${cy + 7} L${cx + 9} ${cy + 7} L${cx} ${cy - 8} Z`}
        className="mp-i-talude-body"
      />
      <path d={`M${cx} ${cy - 2} v4 M${cx} ${cy + 5} v0.5`} className="mp-i-talude-mark" />
    </g>
  );
}
