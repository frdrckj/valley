import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

interface BtnProps {
  variant?: Variant;
  solid?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  leading?: IconName;
  trailing?: IconName;
  disabled?: boolean;
}

export function Btn({
  variant = "secondary",
  solid,
  children,
  onClick,
  style,
  leading,
  trailing,
  disabled,
}: BtnProps) {
  const cls = `btn btn-${variant}${solid ? " is-solid" : ""}${disabled ? " is-disabled" : ""}`;
  return (
    <button className={cls} style={style} onClick={onClick} disabled={disabled} type="button">
      {leading && <Icon name={leading} size={13} />}
      {children}
      {trailing && <Icon name={trailing} size={13} />}
    </button>
  );
}
