const DENY_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\..+)?$/,
  /(^|\/)\.ssh(\/|$)/,
  /(^|\/)credentials(\.[^/]+)?$/,
  /\.pem$/,
  /(^|\/)id_rsa(\.[^/]+)?$/,
];

export function deny(path: string): boolean {
  return DENY_PATTERNS.some((re) => re.test(path));
}
