import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./AppShell.css";

export type AppShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  isMobile?: boolean;
  className?: string;
};

export function AppShell({ sidebar, topbar, children, isMobile, className }: AppShellProps) {
  return (
    <div className={cn("app", isMobile && "is-mobile", className)}>
      {sidebar}
      <div className="main">
        {topbar}
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
