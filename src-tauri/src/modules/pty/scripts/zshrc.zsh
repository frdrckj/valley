# valley shell integration — sourced after user's ~/.zshrc.
# Re-source guard: prevents an infinite loop if the user's .zshrc
# accidentally sources $ZDOTDIR/.zshrc (which is us).
[[ -n "$_VALLEY_ZSHRC_DONE" ]] && return
typeset -gx _VALLEY_ZSHRC_DONE=1

# OSC 7 — current working directory after every prompt.
__valley_osc7() {
    printf '\033]7;file://%s%s\a' "$HOST" "$PWD"
}

# OSC 133 — prompt markers (semantic shell integration).
__valley_osc133_pre()  { printf '\033]133;A\a'; }
__valley_osc133_post() { printf '\033]133;B\a'; }
__valley_osc133_exec() { printf '\033]133;C\a'; }
__valley_osc133_done() { printf '\033]133;D;%s\a' "$?"; }

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
