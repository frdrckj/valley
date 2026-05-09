# valley — restore user ZDOTDIR so their .zshrc finds .zshenv etc.
if [[ -n "$VALLEY_USER_ZDOTDIR" && -f "$VALLEY_USER_ZDOTDIR/.zshenv" ]]; then
    source "$VALLEY_USER_ZDOTDIR/.zshenv"
fi
