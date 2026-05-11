//! Tiny `~/.ssh/config` resolver — just enough to turn `prod` into the
//! real HostName/User/Port the user already configured for their `ssh`
//! invocations. Not a full parser: ignores keys we don't need (ProxyJump,
//! IdentityFile, ForwardAgent, etc.) since we only do agent-auth SFTP.

#[derive(Debug, Clone)]
pub struct Resolved {
    pub host: String,
    pub user: String,
    pub port: u16,
}

pub fn resolve(alias: &str) -> Resolved {
    let mut out = Resolved {
        host: alias.to_string(),
        user: std::env::var("USER").unwrap_or_else(|_| "root".into()),
        port: 22,
    };

    let Some(home_dir) = home::home_dir() else {
        return out;
    };
    let cfg_path = home_dir.join(".ssh").join("config");
    let Ok(contents) = std::fs::read_to_string(cfg_path) else {
        return out;
    };

    // Walk the config; track whether the current Host block matches.
    let mut active = false;
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let mut parts = trimmed.splitn(2, |c: char| c.is_whitespace() || c == '=');
        let Some(key) = parts.next() else { continue };
        let Some(value) = parts.next().map(str::trim) else { continue };
        let lkey = key.to_lowercase();
        if lkey == "host" {
            active = value.split_whitespace().any(|pat| matches_pattern(pat, alias));
            continue;
        }
        if !active {
            continue;
        }
        match lkey.as_str() {
            "hostname" => out.host = value.to_string(),
            "user" => out.user = value.to_string(),
            "port" => {
                if let Ok(p) = value.parse() {
                    out.port = p;
                }
            }
            _ => {}
        }
    }
    out
}

/// Minimal glob support: `*` matches any run of chars, `?` any single
/// char. Sufficient for typical SSH config patterns like `*.example.com`.
fn matches_pattern(pat: &str, name: &str) -> bool {
    if pat == "*" || pat == name {
        return true;
    }
    if !pat.contains('*') && !pat.contains('?') {
        return false;
    }
    fn rec(p: &[u8], n: &[u8]) -> bool {
        match (p.first(), n.first()) {
            (None, None) => true,
            (Some(b'*'), _) => {
                if rec(&p[1..], n) {
                    return true;
                }
                if let Some(_) = n.first() {
                    return rec(p, &n[1..]);
                }
                false
            }
            (Some(b'?'), Some(_)) => rec(&p[1..], &n[1..]),
            (Some(a), Some(b)) if a == b => rec(&p[1..], &n[1..]),
            _ => false,
        }
    }
    rec(pat.as_bytes(), name.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::matches_pattern;

    #[test]
    fn glob_basics() {
        assert!(matches_pattern("*", "anything"));
        assert!(matches_pattern("prod", "prod"));
        assert!(matches_pattern("*.example.com", "host.example.com"));
        assert!(matches_pattern("prod-*", "prod-east-1"));
        assert!(!matches_pattern("prod-*", "staging-east-1"));
        assert!(matches_pattern("h?st", "host"));
    }
}
