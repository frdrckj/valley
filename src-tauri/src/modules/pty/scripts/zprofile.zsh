[[ -n "$_VALLEY_ZPROFILE_DONE" ]] && return
typeset -g _VALLEY_ZPROFILE_DONE=1
if [[ -n "$VALLEY_USER_ZDOTDIR" \
   && "$VALLEY_USER_ZDOTDIR" != "$ZDOTDIR" \
   && -f "$VALLEY_USER_ZDOTDIR/.zprofile" ]]; then
    source "$VALLEY_USER_ZDOTDIR/.zprofile"
fi
