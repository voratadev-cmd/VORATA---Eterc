import type { HTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Card.css";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card-header", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card-title", className)} {...props} />;
}

export function CardSub({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card-sub", className)} {...props} />;
}

export function CardLink({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn("card-link", className)} {...props} />;
}
