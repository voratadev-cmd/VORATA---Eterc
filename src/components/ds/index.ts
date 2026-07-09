// Barrel export — design system components.
// Importe daqui: `import { Button, Card, FarolCard } from "@/components/ds"`.

export * from "./icons";

// Tier 1 — primitivos núcleo
export * from "./Button/Button";
export * from "./IconButton/IconButton";
export * from "./Card/Card";
export * from "./Input/Input";
export * from "./PasswordInput/PasswordInput";
export * from "./Select/Select";
export * from "./Toggle/Toggle";
export * from "./Segmented/Segmented";
export * from "./Badge/Badge";
export * from "./Tag/Tag";
export * from "./Avatar/Avatar";
export * from "./Divider/Divider";

// Tier 2 — primitivos compostos
export * from "./FarolCard/FarolCard";
export * from "./List/List";
export * from "./Menu/Menu";
export * from "./EmptyState/EmptyState";
export * from "./ErroCard/ErroCard";
export * from "./Skeleton/Skeleton";
export * from "./InfoCard/InfoCard";
export * from "./ProgressBar/ProgressBar";
export * from "./ProgressRing/ProgressRing";
export * from "./Tabs/Tabs";
export * from "./FilterChip/FilterChip";
export * from "./Checkbox/Checkbox";
export * from "./FieldRow/FieldRow";
export * from "./FormField/FormField";
export * from "./PageHeader/PageHeader";
export * from "./Analise/Analise";
export * from "./Analise/analiseContext";
export * from "./PeriodoPicker/PeriodoPicker";
export * from "./MonthYearPicker/MonthYearPicker";
export * from "./DatePicker/DatePicker";
export * from "./TrendIndicator/TrendIndicator";
export * from "./DateCell/DateCell";
export * from "./HeroCard/HeroCard";
export * from "./Modal/Modal";
export * from "./DataTable/DataTable";
export * from "./AddCard/AddCard";
export * from "./FileDropzone/FileDropzone";
export * from "./FileSlotCard/FileSlotCard";
export * from "./UploadSummary/UploadSummary";
export * from "./Stepper/Stepper";

// Tier 3 — layout + visualização simples
export * from "./Grid/Grid";
export * from "./Sparkline/Sparkline";
export * from "./ChartKit/ChartKit";

// Shell — composto, depende do TanStack Router e do ThemeProvider
export * from "./AppShell/AppShell";
export * from "./Sidebar/Sidebar";
export * from "./Topbar/Topbar";
