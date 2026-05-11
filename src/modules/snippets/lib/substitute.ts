export interface SnippetDefaults {
  lhost?: string;
  lport?: string;
  target?: string;
  port?: string;
}

/**
 * Replace $LHOST, $LPORT, $TARGET, $PORT with provided values.
 * Uses word-boundary anchoring so $LHOSTNAME is not corrupted.
 * Leaves a placeholder unchanged when no value is supplied.
 */
export function substitute(body: string, d: SnippetDefaults): string {
  return body
    .replace(/\$LHOST(?![A-Z0-9_])/g, d.lhost ?? "$LHOST")
    .replace(/\$LPORT(?![A-Z0-9_])/g, d.lport ?? "$LPORT")
    .replace(/\$TARGET(?![A-Z0-9_])/g, d.target ?? "$TARGET")
    .replace(/\$PORT(?![A-Z0-9_])/g, d.port ?? "$PORT");
}
