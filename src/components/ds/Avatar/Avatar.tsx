import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./Avatar.css";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  size?: AvatarSize;
  src?: string;
  alt?: string;
  initials?: string;
};

const sizeClass: Record<AvatarSize, string> = {
  sm: "avatar-sm",
  md: "",
  lg: "avatar-lg",
  xl: "avatar-xl",
};

export function Avatar({
  size = "md",
  src,
  alt,
  initials,
  className,
  children,
  ...props
}: AvatarProps) {
  return (
    <div className={cn("avatar", sizeClass[size], className)} {...props}>
      {src ? <img src={src} alt={alt ?? ""} /> : (initials ?? children)}
    </div>
  );
}
