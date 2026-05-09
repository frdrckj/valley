type Tone = "green" | "yellow" | "red" | "purple" | "muted";

interface DotProps {
  tone?: Tone;
  glow?: boolean;
}

export function Dot({ tone = "muted", glow = true }: DotProps) {
  return (
    <span
      className={`dot ${tone}`}
      style={glow ? undefined : { boxShadow: "none" }}
    />
  );
}
