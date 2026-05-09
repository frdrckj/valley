import type { CSSProperties, ReactNode } from "react";

interface KbdProps {
  children: ReactNode;
  dark?: boolean;
}

export function Kbd({ children, dark }: KbdProps) {
  const style: CSSProperties | undefined = dark
    ? {
        background: "rgba(29,32,33,0.20)",
        borderColor: "rgba(29,32,33,0.20)",
        color: "var(--gb-dark-bg-0)",
      }
    : undefined;
  return (
    <span className="kbd" style={style}>
      {children}
    </span>
  );
}
