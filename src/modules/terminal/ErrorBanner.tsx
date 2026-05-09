import { Kbd } from "@/components/Kbd";

interface ErrorBannerProps {
  cmd?: string;
}

export function ErrorBanner({ cmd = "gti push" }: ErrorBannerProps) {
  return (
    <div className="vy-errbanner">
      <span className="x" style={{ color: "var(--accent-danger)" }}>
        ✗
      </span>
      <span style={{ color: "var(--text-strong)" }}>command not found:</span>
      <span style={{ color: "var(--accent-danger)" }}>{cmd}</span>
      <span className="askvalley">
        <span>↩ ask valley?</span>
        <Kbd>↩</Kbd>
      </span>
    </div>
  );
}
