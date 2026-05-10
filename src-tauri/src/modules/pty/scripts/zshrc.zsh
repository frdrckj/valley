# valley shell integration — sourced after user's ~/.zshrc.
# Re-source guard: prevents an infinite loop if the user's .zshrc
# accidentally sources $ZDOTDIR/.zshrc (which is us).
[[ -n "$_VALLEY_ZSHRC_DONE" ]] && return
typeset -gx _VALLEY_ZSHRC_DONE=1

# Inside tmux, raw OSC sequences from the inner shell are consumed by
# tmux for its own pane state and never reach valley's xterm — that's
# why cwd/branch chrome stops updating after `cd`. Wrap each emit in
# tmux's DCS passthrough envelope when $TMUX is set so the bytes are
# forwarded verbatim. Requires `set -g allow-passthrough on` in the
# user's tmux config (tmux >= 3.3); a no-op otherwise.
if [[ -n "$TMUX" ]]; then
    __valley_emit() { printf '\033Ptmux;\033%s\033\\' "$1"; }
else
    __valley_emit() { printf '%s' "$1"; }
fi

# OSC 7 — current working directory after every prompt.
__valley_osc7() {
    __valley_emit "$(printf '\033]7;file://%s%s\a' "$HOST" "$PWD")"
}

# OSC 133 — prompt markers (semantic shell integration).
__valley_osc133_pre()  { __valley_emit $'\033]133;A\a'; }
__valley_osc133_post() { __valley_emit $'\033]133;B\a'; }
__valley_osc133_exec() { __valley_emit $'\033]133;C\a'; }
__valley_osc133_done() { __valley_emit "$(printf '\033]133;D;%s\a' "$?")"; }

# Pre-prompt: emit A and B, plus OSC 7. Layered via precmd hook.
autoload -Uz add-zsh-hook 2>/dev/null || true
__valley_precmd() {
    __valley_osc133_done
    __valley_osc133_pre
    __valley_osc7
    __valley_osc133_post
}
__valley_preexec() {
    __valley_osc133_exec
}
add-zsh-hook precmd  __valley_precmd
add-zsh-hook preexec __valley_preexec

# If the user has a real ~/.zshrc, source it AFTER ours so they take precedence
# (their hooks are appended). ZDOTDIR points here, but we want their config too.
# The "$VALLEY_USER_ZDOTDIR" != "$ZDOTDIR" guard makes a stale parent
# ZDOTDIR pointing at our temp dir a no-op instead of an infinite loop.
if [[ -n "$VALLEY_USER_ZDOTDIR" \
   && "$VALLEY_USER_ZDOTDIR" != "$ZDOTDIR" \
   && -f "$VALLEY_USER_ZDOTDIR/.zshrc" ]]; then
    source "$VALLEY_USER_ZDOTDIR/.zshrc"
fi
