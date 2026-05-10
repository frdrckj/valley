# valley — restore user ZDOTDIR so their .zshrc finds .zshenv etc.
# Re-source guard: zsh sources .zshenv for every shell (including
# subshells); the guard prevents an infinite loop if a downstream
# config file accidentally re-sources $ZDOTDIR/.zshenv.
[[ -n "$_VALLEY_ZSHENV_DONE" ]] && return
# Shell-local guard (no -x). Exporting leaks into subshells/tmux and
# breaks every downstream zshrc.
typeset -g _VALLEY_ZSHENV_DONE=1
if [[ -n "$VALLEY_USER_ZDOTDIR" \
   && "$VALLEY_USER_ZDOTDIR" != "$ZDOTDIR" \
   && -f "$VALLEY_USER_ZDOTDIR/.zshenv" ]]; then
    source "$VALLEY_USER_ZDOTDIR/.zshenv"
fi
