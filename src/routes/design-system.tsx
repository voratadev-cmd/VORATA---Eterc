import { createFileRoute } from "@tanstack/react-router";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import {
  AddCard,
  Avatar,
  Badge,
  type BadgeTone,
  Button,
  type ButtonSize,
  type ButtonVariant,
  Card,
  CardHeader,
  CardLink,
  CardSub,
  CardTitle,
  Checkbox,
  Col,
  DataTable,
  type DataTableColumn,
  DateCell,
  Divider,
  EmptyState,
  FieldRow,
  FilterChip,
  Grid,
  HeroCard,
  I,
  type IconName,
  IconButton,
  InfoCard,
  type InfoCardTone,
  Input,
  FarolCard,
  List,
  ListItem,
  Menu,
  MenuAnchor,
  MenuDivider,
  MenuItem,
  MenuSection,
  Modal,
  PageHeader,
  ProgressBar,
  type ProgressTone,
  ProgressRing,
  Segmented,
  Select,
  Skeleton,
  Tabs,
  Tag,
  Textarea,
  Toggle,
  TrendIndicator,
} from "@/components/ds";

export const Route = createFileRoute("/design-system")({
  component: DesignSystemPage,
});

// ── Helpers ──────────────────────────────────────────────────────────────

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: "var(--s-10)", scrollMarginTop: "80px" }}>
      <div style={{ marginBottom: "var(--s-4)" }}>
        <h2
          style={{
            fontSize: "var(--fs-20)",
            fontWeight: "var(--fw-bold)",
            color: "var(--text)",
            letterSpacing: "-.01em",
          }}
        >
          {title}
        </h2>
        {description ? (
          <p
            style={{
              color: "var(--text-3)",
              fontSize: "var(--fs-13)",
              marginTop: 4,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Row({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "center" | "start" | "end";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--s-3)",
        alignItems: align === "center" ? "center" : `flex-${align}`,
      }}
    >
      {children}
    </div>
  );
}

function Swatch({
  name,
  variable,
  textOn = "auto",
}: {
  name: string;
  variable: string;
  textOn?: "auto" | "light" | "dark";
}) {
  const color = textOn === "light" ? "#fff" : textOn === "dark" ? "var(--ink)" : "inherit";
  return (
    <div
      style={{
        background: `var(${variable})`,
        color,
        padding: "var(--s-3)",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border)",
        fontSize: "var(--fs-12)",
        minHeight: 72,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <strong style={{ fontWeight: "var(--fw-semibold)" }}>{name}</strong>
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          opacity: 0.85,
        }}
      >
        {variable}
      </code>
    </div>
  );
}

function ScaleRow({ label, size, unit = "px" }: { label: string; size: number; unit?: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 60px 1fr",
        alignItems: "center",
        gap: "var(--s-3)",
        padding: "6px 0",
      }}
    >
      <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-2)" }}>
        {label}
      </code>
      <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-3)", fontSize: 12 }}>
        {size}
        {unit}
      </span>
      <div
        style={{
          height: 12,
          background: "var(--brand)",
          borderRadius: "var(--r-pill)",
          width: `${size * 2}px`,
          maxWidth: "100%",
        }}
      />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

function DesignSystemPage() {
  const { theme, setTheme } = useTheme();
  const [toggleA, setToggleA] = useState(true);
  const [toggleB, setToggleB] = useState(false);
  const [checkedA, setCheckedA] = useState(true);
  const [checkedB, setCheckedB] = useState(false);
  const [segValue, setSegValue] = useState<"week" | "month" | "year">("month");
  const [tabValue, setTabValue] = useState<"todas" | "ativas" | "arquivadas">("todas");
  const [filterActive, setFilterActive] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [planoSel, setPlanoSel] = useState<"pessoal" | "familia" | "time">("pessoal");

  const buttonVariants: ButtonVariant[] = ["primary", "ink", "ghost", "outline", "danger", "vault"];
  const buttonSizes: ButtonSize[] = ["xs", "sm", "md", "lg"];
  const badgeTones: BadgeTone[] = [
    "neutral",
    "brand",
    "info",
    "success",
    "warning",
    "danger",
    "vault",
  ];
  const infoTones: InfoCardTone[] = ["info", "success", "warning", "danger", "vault"];
  const progressTones: ProgressTone[] = ["brand", "success", "warning", "danger", "info", "vault"];

  return (
    <div style={{ padding: "var(--s-8) var(--s-8)", maxWidth: 1280, margin: "0 auto" }}>
      <PageHeader
        title="Design System"
        subtitle="Tokens, primitivos e padrões — derivados do protótipo Life OS."
        actions={
          <>
            <Segmented
              value={theme}
              onChange={(v) => setTheme(v)}
              items={[
                { value: "light", label: "Claro", icon: I.sun({ size: 14 }) },
                { value: "dark", label: "Escuro", icon: I.moon({ size: 14 }) },
              ]}
              aria-label="Tema"
            />
          </>
        }
      />

      {/* ── Tokens ── */}
      <Section
        id="tokens"
        title="Tokens — cores"
        description="Fonte da verdade. Sempre referencie via var(--token), nunca hardcode."
      >
        <Grid>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>Brand</CardTitle>
              </CardHeader>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "var(--s-2)",
                }}
              >
                <Swatch name="brand" variable="--brand" textOn="light" />
                <Swatch name="brand-600" variable="--brand-600" textOn="light" />
                <Swatch name="brand-700" variable="--brand-700" textOn="light" />
                <Swatch name="brand-100" variable="--brand-100" />
                <Swatch name="brand-50" variable="--brand-50" />
                <Swatch name="ink" variable="--ink" textOn="light" />
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>Superfícies & Texto</CardTitle>
              </CardHeader>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "var(--s-2)",
                }}
              >
                <Swatch name="bg" variable="--bg" />
                <Swatch name="surface" variable="--surface" />
                <Swatch name="surface-2" variable="--surface-2" />
                <Swatch name="surface-3" variable="--surface-3" />
                <Swatch name="border" variable="--border" />
                <Swatch name="border-strong" variable="--border-strong" />
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <CardHeader>
                <CardTitle>Semânticas</CardTitle>
                <CardSub>Pares foreground + background para estados.</CardSub>
              </CardHeader>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "var(--s-2)",
                }}
              >
                <Swatch name="success" variable="--success" textOn="light" />
                <Swatch name="warning" variable="--warning" textOn="light" />
                <Swatch name="danger" variable="--danger" textOn="light" />
                <Swatch name="info" variable="--info" textOn="light" />
                <Swatch name="vault" variable="--vault" textOn="light" />
                <Swatch name="success-bg" variable="--success-bg" />
                <Swatch name="warning-bg" variable="--warning-bg" />
                <Swatch name="danger-bg" variable="--danger-bg" />
                <Swatch name="info-bg" variable="--info-bg" />
                <Swatch name="vault-bg" variable="--vault-bg" />
              </div>
            </Card>
          </Col>
        </Grid>
      </Section>

      <Section id="typography" title="Tipografia" description="Família Manrope, escala 12–40px.">
        <Card>
          {[
            { var: "--fs-12", size: 12, sample: "Texto pequeno · meta · 12px" },
            { var: "--fs-13", size: 13, sample: "Corpo secundário · 13px" },
            { var: "--fs-14", size: 14, sample: "Corpo (padrão) · 14px" },
            { var: "--fs-16", size: 16, sample: "Heading 5 · 16px" },
            { var: "--fs-18", size: 18, sample: "Heading 4 · 18px" },
            { var: "--fs-20", size: 20, sample: "Heading 3 · 20px" },
            { var: "--fs-24", size: 24, sample: "Heading 2 · 24px" },
            { var: "--fs-28", size: 28, sample: "Page title · 28px" },
            { var: "--fs-32", size: 32, sample: "Display · 32px" },
            { var: "--fs-40", size: 40, sample: "Display L · 40px" },
          ].map((t) => (
            <div
              key={t.var}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: "var(--s-4)",
                alignItems: "baseline",
                padding: "var(--s-3) 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <code
                style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-3)" }}
              >
                {t.var}
              </code>
              <span style={{ fontSize: `var(${t.var})`, fontWeight: "var(--fw-semibold)" }}>
                {t.sample}
              </span>
            </div>
          ))}
        </Card>
      </Section>

      <Section
        id="spacing"
        title="Spacing · Radius · Shadows"
        description="Escala base-4. Use sempre tokens, evite valores em pixel direto."
      >
        <Grid>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>Spacing (--s-*)</CardTitle>
              </CardHeader>
              {[
                { l: "--s-1", v: 4 },
                { l: "--s-2", v: 8 },
                { l: "--s-3", v: 12 },
                { l: "--s-4", v: 16 },
                { l: "--s-5", v: 20 },
                { l: "--s-6", v: 24 },
                { l: "--s-8", v: 32 },
                { l: "--s-10", v: 40 },
                { l: "--s-12", v: 48 },
                { l: "--s-16", v: 64 },
              ].map((s) => (
                <ScaleRow key={s.l} label={s.l} size={s.v} />
              ))}
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>Radius & Shadows</CardTitle>
              </CardHeader>
              <Row align="start">
                {[
                  { l: "r-sm", v: "var(--r-sm)" },
                  { l: "r-md", v: "var(--r-md)" },
                  { l: "r-lg", v: "var(--r-lg)" },
                  { l: "r-xl", v: "var(--r-xl)" },
                  { l: "r-pill", v: "var(--r-pill)" },
                ].map((r) => (
                  <div key={r.l} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: r.v,
                      }}
                    />
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--text-3)",
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      {r.l}
                    </code>
                  </div>
                ))}
              </Row>
              <Divider />
              <Row align="start">
                {[
                  { l: "sh-sm", v: "var(--sh-sm)" },
                  { l: "sh-md", v: "var(--sh-md)" },
                  { l: "sh-lg", v: "var(--sh-lg)" },
                  { l: "sh-pop", v: "var(--sh-pop)" },
                ].map((s) => (
                  <div key={s.l} style={{ textAlign: "center", paddingBottom: 18 }}>
                    <div
                      style={{
                        width: 80,
                        height: 56,
                        background: "var(--surface)",
                        borderRadius: "var(--r-md)",
                        boxShadow: s.v,
                      }}
                    />
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--text-3)",
                        display: "block",
                        marginTop: 8,
                      }}
                    >
                      {s.l}
                    </code>
                  </div>
                ))}
              </Row>
            </Card>
          </Col>
        </Grid>
      </Section>

      {/* ── Ícones ── */}
      <Section
        id="icons"
        title="Ícones"
        description="Lucide-style · 1.75 stroke · currentColor. Use com I.<nome>({ size })."
      >
        <Card>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
              gap: "var(--s-3)",
            }}
          >
            {(Object.keys(I) as IconName[]).map((name) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "var(--s-3)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  color: "var(--text-2)",
                }}
              >
                {I[name]({ size: 20 })}
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--text-3)",
                  }}
                >
                  {name}
                </code>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ── Botões ── */}
      <Section id="buttons" title="Button" description="6 variantes × 5 tamanhos.">
        <Card>
          <Row>
            {buttonVariants.map((v) => (
              <Button key={v} variant={v}>
                {v}
              </Button>
            ))}
          </Row>
          <Divider />
          <Row>
            {buttonSizes.map((s) => (
              <Button key={s} size={s}>
                size {s}
              </Button>
            ))}
            <Button size="md" variant="primary">
              {I.plus({ size: 14 })} Com ícone
            </Button>
            <Button size="md" variant="outline" disabled>
              Disabled
            </Button>
          </Row>
        </Card>
      </Section>

      {/* ── Inputs ── */}
      <Section id="inputs" title="Form fields" description="Input, Textarea, Select, FieldRow.">
        <Card>
          <FieldRow label="Nome" hint="Como deseja ser chamado.">
            <Input placeholder="Maria Silva" defaultValue="" />
          </FieldRow>
          <FieldRow label="Bio" hint="Texto livre, máximo 280 caracteres.">
            <Textarea placeholder="Conte um pouco..." />
          </FieldRow>
          <FieldRow label="Plano" hint="O plano define seus limites.">
            <Select
              value={planoSel}
              onChange={setPlanoSel}
              items={[
                { value: "pessoal", label: "Pessoal" },
                { value: "familia", label: "Família" },
                { value: "time", label: "Time" },
              ]}
              aria-label="Plano"
            />
          </FieldRow>
          <FieldRow label="Notificações" hint="Receber alertas por e-mail.">
            <Toggle checked={toggleA} onCheckedChange={setToggleA} />
          </FieldRow>
          <FieldRow label="Tema escuro" hint="Sincronizado com o sistema.">
            <Toggle checked={toggleB} onCheckedChange={setToggleB} />
          </FieldRow>
        </Card>
      </Section>

      {/* ── Toggle, Segmented, Checkbox ── */}
      <Section id="controls" title="Toggle · Segmented · Checkbox">
        <Grid>
          <Col span={4}>
            <Card>
              <CardHeader>
                <CardTitle>Toggle</CardTitle>
              </CardHeader>
              <Row>
                <Toggle checked={toggleA} onCheckedChange={setToggleA} />
                <Toggle checked={false} disabled />
                <Toggle checked={true} disabled />
              </Row>
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <CardHeader>
                <CardTitle>Segmented</CardTitle>
              </CardHeader>
              <Segmented
                value={segValue}
                onChange={(v) => setSegValue(v)}
                items={[
                  { value: "week", label: "Semana" },
                  { value: "month", label: "Mês" },
                  { value: "year", label: "Ano" },
                ]}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <CardHeader>
                <CardTitle>Checkbox</CardTitle>
              </CardHeader>
              <Row>
                <Checkbox size="sm" checked={checkedA} onCheckedChange={setCheckedA} />
                <Checkbox size="md" checked={checkedA} onCheckedChange={setCheckedA} />
                <Checkbox size="lg" checked={checkedA} onCheckedChange={setCheckedA} />
                <Checkbox checked={checkedB} onCheckedChange={setCheckedB} />
              </Row>
            </Card>
          </Col>
        </Grid>
      </Section>

      {/* ── Badge, Tag, Avatar, Divider ── */}
      <Section id="badges" title="Badge · Tag · Avatar · Divider">
        <Card>
          <CardHeader>
            <CardTitle>Badge — tons</CardTitle>
          </CardHeader>
          <Row>
            {badgeTones.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </Row>
          <Divider />
          <CardHeader>
            <CardTitle>Tag</CardTitle>
          </CardHeader>
          <Row>
            <Tag>Hoje</Tag>
            <Tag>Atrasada</Tag>
            <Tag>Finanças</Tag>
            <Tag>Trabalho</Tag>
          </Row>
          <Divider />
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
          </CardHeader>
          <Row>
            <Avatar size="sm" initials="MS" />
            <Avatar size="md" initials="MS" />
            <Avatar size="lg" initials="MS" />
            <Avatar size="xl" initials="MS" />
          </Row>
        </Card>
      </Section>

      {/* ── FarolCard ── */}
      <Section
        id="farol-card"
        title="FarolCard"
        description="Card de KPI 'numeric-first' com indicador de criticidade ou cor decorativa. Use prop `farol` para criticidade dinâmica (gera status dot + label) ou `accent` para cor fixa."
      >
        <Grid>
          <Col span={6}>
            <FarolCard
              label="FATURAMENTO"
              icon="wallet"
              value="−15,7%"
              info="Real R$ 44,1 mi · Contratado R$ 52,3 mi acum."
              hint="aderência no mês: 78%"
              farol="risco"
            />
          </Col>
          <Col span={6}>
            <FarolCard
              label="PRODUTIVIDADE"
              icon="trending"
              value="−24%"
              info="HH real R$ 142/Hh vs. contratado R$ 187/Hh"
              farol="critico"
            />
          </Col>
          <Col span={6}>
            <FarolCard
              label="CONTRATADO TOTAL"
              icon="wallet"
              value="R$ 70,7 mi"
              info="18 BMs · valor total contratado"
              accent="neutral"
            />
          </Col>
          <Col span={6}>
            <FarolCard
              label="CAPACIDADE PRODUTIVA"
              value="86%"
              info="equipe alocada × produtividade real"
              accent="success"
            />
          </Col>
        </Grid>
      </Section>

      {/* ── List ── */}
      <Section
        id="list"
        title="List · ListItem"
        description="Linhas com ícone, título, meta, valor e pill."
      >
        <Card>
          <List>
            <ListItem
              icon={I.wallet({ size: 18 })}
              iconTone="danger"
              title="Fatura Nubank — fechada"
              metaParts={["Cartões", "vence em 2 dias · 12/05"]}
              pill="Atenção"
              pillTone="danger"
              value="R$ 1.847,30"
              valueTone="neg"
            />
            <ListItem
              icon={I.film({ size: 18 })}
              iconTone="info"
              title="Netflix Premium"
              metaParts={["Assinaturas", "renova 13/05"]}
              value="R$ 55,90"
              valueTone="neg"
            />
            <ListItem
              icon={I.doc({ size: 18 })}
              iconTone="warning"
              title="CNH — vence em 23 dias"
              metaParts={["Documentos", "vence 02/06"]}
              pill="Renovar"
              pillTone="warning"
            />
            <ListItem
              icon={I.stethoscope({ size: 18 })}
              iconTone="info"
              title="Consulta dermatologista"
              metaParts={["Saúde", "16/05 · 10:30"]}
            />
          </List>
        </Card>
      </Section>

      {/* ── Menu ── */}
      <Section
        id="menu"
        title="Menu (dropdown)"
        description="Posicione com MenuAnchor (position: relative)."
      >
        <Card>
          <MenuAnchor>
            <Button onClick={() => setMenuOpen((v) => !v)}>
              {I.plus({ size: 14 })} Novo
              {I.chevDown({ size: 12 })}
            </Button>
            {menuOpen ? (
              <Menu align="left">
                <MenuSection>Criação rápida</MenuSection>
                <MenuItem
                  icon={I.wallet({ size: 16 })}
                  label="Nova transação"
                  kbd="⌘T"
                  onClick={() => setMenuOpen(false)}
                />
                <MenuItem
                  icon={I.check({ size: 16 })}
                  label="Nova tarefa"
                  kbd="⌘N"
                  onClick={() => setMenuOpen(false)}
                />
                <MenuItem
                  icon={I.note({ size: 16 })}
                  label="Nova nota"
                  kbd="⌘Q"
                  onClick={() => setMenuOpen(false)}
                />
                <MenuDivider />
                <MenuItem icon={I.lock({ size: 16 })} label="Nova senha" kbd="⌘S" vault />
              </Menu>
            ) : null}
          </MenuAnchor>
        </Card>
      </Section>

      {/* ── Tabs · FilterChip ── */}
      <Section id="filters" title="Tabs · FilterChip">
        <Card>
          <Tabs
            value={tabValue}
            onChange={(v) => setTabValue(v)}
            items={[
              { value: "todas", label: "Todas" },
              { value: "ativas", label: "Ativas" },
              { value: "arquivadas", label: "Arquivadas" },
            ]}
          />
          <Row>
            <FilterChip
              label="Categoria"
              value="3"
              active={filterActive}
              onClick={() => setFilterActive((v) => !v)}
              onClear={() => setFilterActive(false)}
            />
            <FilterChip label="Data: Maio" />
            <FilterChip label="+ Adicionar filtro" dashed />
          </Row>
        </Card>
      </Section>

      {/* ── Progress ── */}
      <Section id="progress" title="ProgressBar · ProgressRing">
        <Grid>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>ProgressBar</CardTitle>
                <CardSub>6 tons × 3 tamanhos</CardSub>
              </CardHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
                {progressTones.map((tone) => (
                  <div key={tone}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-3)",
                        marginBottom: 4,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {tone}
                    </div>
                    <ProgressBar value={60} tone={tone} />
                  </div>
                ))}
                <Divider />
                <ProgressBar size="sm" value={40} />
                <ProgressBar size="md" value={60} />
                <ProgressBar size="lg" value={80} tone="success" />
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>ProgressRing</CardTitle>
              </CardHeader>
              <Row>
                <ProgressRing value={25} size={64} stroke={6} />
                <ProgressRing value={62} size={96} stroke={8} color="var(--success)" label="meta" />
                <ProgressRing
                  value={88}
                  size={120}
                  stroke={10}
                  color="var(--brand)"
                  centerText="88%"
                  label="concluído"
                />
              </Row>
            </Card>
          </Col>
        </Grid>
      </Section>

      {/* ── InfoCard ── */}
      <Section id="info" title="InfoCard" description="Alertas/banners contextuais.">
        <Card>
          {infoTones.map((tone) => (
            <InfoCard
              key={tone}
              tone={tone}
              icon={
                tone === "success"
                  ? I.check({ size: 18 })
                  : tone === "warning"
                    ? I.bell({ size: 18 })
                    : tone === "danger"
                      ? I.trash({ size: 18 })
                      : tone === "vault"
                        ? I.lock({ size: 18 })
                        : I.eye({ size: 18 })
              }
              title={`Info ${tone}`}
              text="Mensagem secundária explicando o contexto."
            />
          ))}
        </Card>
      </Section>

      {/* ── EmptyState · Skeleton ── */}
      <Section id="states" title="EmptyState · Skeleton">
        <Grid>
          <Col span={6}>
            <Card>
              <EmptyState
                icon={I.cart({ size: 42 })}
                title="Nada por aqui"
                text="Quando você adicionar itens, eles vão aparecer aqui."
                action={<Button>Adicionar item</Button>}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>Skeleton</CardTitle>
              </CardHeader>
              <Skeleton variant="line-lg" style={{ width: 200 }} />
              <Skeleton variant="line" style={{ width: 280 }} />
              <Skeleton variant="line-sm" style={{ width: 120 }} />
              <Divider />
              <Row>
                <Skeleton variant="circle" style={{ width: 36, height: 36 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton variant="line" style={{ width: "60%" }} />
                  <Skeleton variant="line-sm" style={{ width: "30%" }} />
                </div>
              </Row>
            </Card>
          </Col>
        </Grid>
      </Section>

      {/* ── TrendIndicator · DateCell ── */}
      <Section id="misc" title="TrendIndicator · DateCell">
        <Grid>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>TrendIndicator</CardTitle>
              </CardHeader>
              <Row>
                <TrendIndicator direction="up">+12,4%</TrendIndicator>
                <TrendIndicator direction="down">−3,8%</TrendIndicator>
                <TrendIndicator direction="flat">0,0%</TrendIndicator>
              </Row>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <CardHeader>
                <CardTitle>DateCell</CardTitle>
              </CardHeader>
              <Row>
                <DateCell day="10" month="MAI" />
                <DateCell day="12" month="MAI" />
                <DateCell day="14" month="MAI" />
                <DateCell day="15" month="MAI" size="lg" />
              </Row>
            </Card>
          </Col>
        </Grid>
      </Section>

      {/* ── HeroCard ── */}
      <Section id="hero" title="HeroCard" description="Card de destaque, gradiente ink → navy.">
        <HeroCard
          label="Hoje · 15 de Maio"
          title="Bom dia, Maria"
          subtitle="Você tem 3 tarefas pendentes e 2 compromissos."
          actions={
            <Button
              variant="outline"
              size="sm"
              style={{
                background: "rgba(255,255,255,.1)",
                color: "#fff",
                borderColor: "rgba(255,255,255,.25)",
              }}
            >
              {I.eye({ size: 14 })} Ver agenda
            </Button>
          }
        />
      </Section>

      {/* ── Modal ── */}
      <Section id="modal" title="Modal">
        <Card>
          <Row>
            <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-3)" }}>
              backdrop click + Escape fecham
            </code>
          </Row>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Confirmar ação"
            subtitle="Esta operação não pode ser desfeita."
            actions={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={() => setModalOpen(false)}>
                  Excluir
                </Button>
              </>
            }
          >
            <p style={{ color: "var(--text-2)", margin: 0 }}>
              Tem certeza que deseja remover este item? Esta ação é permanente e os dados não
              poderão ser recuperados.
            </p>
          </Modal>
        </Card>
      </Section>

      {/* ── DataTable ── */}
      <Section
        id="datatable"
        title="DataTable"
        description="Tabela com header em grid + linhas hover. Use width por coluna para fixar tamanhos."
      >
        <DataTableDemo />
      </Section>

      {/* ── IconButton ── */}
      <Section
        id="icon-button"
        title="IconButton"
        description="Botão neutro icon-only. 3 variants × 3 tamanhos."
      >
        <Card>
          <Row>
            <IconButton variant="ghost" size="sm" aria-label="Filtrar">
              {I.filter({ size: 14 })}
            </IconButton>
            <IconButton variant="ghost" size="md" aria-label="Mais opções">
              {I.moreV({ size: 16 })}
            </IconButton>
            <IconButton variant="ghost" size="lg" aria-label="Notificações">
              {I.bell({ size: 18 })}
            </IconButton>
            <IconButton variant="outline" size="md" aria-label="Editar">
              {I.edit({ size: 16 })}
            </IconButton>
            <IconButton variant="outline" size="lg" aria-label="Compartilhar">
              {I.share({ size: 18 })}
            </IconButton>
            <IconButton variant="solid" size="md" aria-label="Adicionar">
              {I.plus({ size: 16 })}
            </IconButton>
            <IconButton variant="solid" size="lg" aria-label="Buscar">
              {I.search({ size: 18 })}
            </IconButton>
            <IconButton variant="ghost" size="md" aria-label="Excluir" disabled>
              {I.trash({ size: 16 })}
            </IconButton>
          </Row>
        </Card>
      </Section>

      {/* ── AddCard ── */}
      <Section
        id="add-card"
        title="AddCard"
        description="Card de '+ adicionar' com borda tracejada. Variantes: padrão (vertical) e compact (horizontal)."
      >
        <Grid>
          <Col span={4}>
            <AddCard label="Adicionar conta" onClick={() => undefined} />
          </Col>
          <Col span={4}>
            <AddCard label="Criar meta" icon={I.flag({ size: 22 })} onClick={() => undefined} />
          </Col>
          <Col span={4}>
            <AddCard
              compact
              label="Adicionar à lista"
              icon={I.cart({ size: 16 })}
              onClick={() => undefined}
            />
          </Col>
        </Grid>
      </Section>

      {/* ── Grid demo ── */}
      <Section
        id="grid"
        title="Grid · Col"
        description="Sistema de 12 colunas, reflow ≤1100px e ≤720px."
      >
        <Grid>
          {([3, 3, 3, 3, 6, 6, 8, 4, 12] as const).map((s, i) => (
            <Col key={i} span={s}>
              <GridDemoBox span={s} />
            </Col>
          ))}
        </Grid>
      </Section>
    </div>
  );
}

// ── DataTable demo ─────────────────────────────────────────────────────

type DemoTx = {
  id: string;
  date: string;
  title: string;
  category: string;
  account: string;
  amount: string;
  amountTone: "pos" | "neg";
};

const DEMO_TX: DemoTx[] = [
  {
    id: "1",
    date: "10/05",
    title: "Mercado Pão de Açúcar",
    category: "Alimentação",
    account: "Nubank",
    amount: "−R$ 287,40",
    amountTone: "neg",
  },
  {
    id: "2",
    date: "08/05",
    title: "Salário",
    category: "Receita",
    account: "Itaú",
    amount: "+R$ 8.400,00",
    amountTone: "pos",
  },
  {
    id: "3",
    date: "07/05",
    title: "Netflix",
    category: "Assinaturas",
    account: "Nubank",
    amount: "−R$ 55,90",
    amountTone: "neg",
  },
];

function DataTableDemo() {
  const cols: DataTableColumn<DemoTx>[] = [
    { key: "date", label: "Data", width: "80px" },
    { key: "title", label: "Descrição", width: "1fr" },
    { key: "category", label: "Categoria", width: "160px" },
    { key: "account", label: "Conta", width: "120px" },
    {
      key: "amount",
      label: "Valor",
      width: "140px",
      align: "right",
      render: (row) => (
        <span style={{ color: row.amountTone === "neg" ? "var(--danger)" : "var(--success)" }}>
          {row.amount}
        </span>
      ),
    },
  ];
  return (
    <DataTable columns={cols} rows={DEMO_TX} getRowId={(r) => r.id} onRowClick={() => undefined} />
  );
}

function GridDemoBox({ span }: { span: number }) {
  const style: CSSProperties = {
    background: "var(--brand-50)",
    color: "var(--brand-700)",
    border: "1px dashed var(--brand)",
    borderRadius: "var(--r-md)",
    padding: "var(--s-4)",
    textAlign: "center",
    fontWeight: "var(--fw-semibold)",
    fontSize: "var(--fs-13)",
  };
  return <div style={style}>col-{span}</div>;
}
