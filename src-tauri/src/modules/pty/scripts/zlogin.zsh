[[ -n "$_VALLEY_ZLOGIN_DONE" ]] && return
typeset -g _VALLEY_ZLOGIN_DONE=1
if [[ -n "$VALLEY_USER_ZDOTDIR" \
   && "$VALLEY_USER_ZDOTDIR" != "$ZDOTDIR" \
   && -f "$VALLEY_USER_ZDOTDIR/.zlogin" ]]; then
    source "$VALLEY_USER_ZDOTDIR/.zlogin"
fi
