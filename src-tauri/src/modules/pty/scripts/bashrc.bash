# valley shell integration for bash.

__valley_osc7()        { printf '\033]7;file://%s%s\a' "$HOSTNAME" "$PWD"; }
__valley_osc133_pre()  { printf '\033]133;A\a'; }
__valley_osc133_post() { printf '\033]133;B\a'; }
__valley_osc133_exec() { printf '\033]133;C\a'; }
__valley_osc133_done() { printf '\033]133;D;%s\a' "$?"; }

PROMPT_COMMAND='__valley_osc133_done; __valley_osc133_pre; __valley_osc7; __valley_osc133_post'

# trap DEBUG to fire OSC 133 C right before commands run
trap '__valley_osc133_exec' DEBUG

# Source the user's bashrc after ours so theirs wins.
if [[ -n "$VALLEY_USER_BASH_ENV" && -f "$VALLEY_USER_BASH_ENV" ]]; then
    source "$VALLEY_USER_BASH_ENV"
elif [[ -f "$HOME/.bashrc" ]]; then
    source "$HOME/.bashrc"
fi
