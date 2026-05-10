# valley shell integration for bash.

# Inside tmux, raw OSC sequences are swallowed by tmux. Wrap each emit
# in tmux's DCS passthrough envelope. Requires
# `set -g allow-passthrough on` in tmux config (>= 3.3) to take effect.
if [[ -n "$TMUX" ]]; then
    __valley_emit() { printf '\033Ptmux;\033%s\033\\' "$1"; }
else
    __valley_emit() { printf '%s' "$1"; }
fi

__valley_osc7()        { __valley_emit "$(printf '\033]7;file://%s%s\a' "$HOSTNAME" "$PWD")"; }
__valley_osc133_pre()  { __valley_emit $'\033]133;A\a'; }
__valley_osc133_post() { __valley_emit $'\033]133;B\a'; }
__valley_osc133_exec() { __valley_emit $'\033]133;C\a'; }
__valley_osc133_done() { __valley_emit "$(printf '\033]133;D;%s\a' "$?")"; }

PROMPT_COMMAND='__valley_osc133_done; __valley_osc133_pre; __valley_osc7; __valley_osc133_post'

# trap DEBUG to fire OSC 133 C right before commands run
trap '__valley_osc133_exec' DEBUG

# Source the user's bashrc after ours so theirs wins.
if [[ -n "$VALLEY_USER_BASH_ENV" && -f "$VALLEY_USER_BASH_ENV" ]]; then
    source "$VALLEY_USER_BASH_ENV"
elif [[ -f "$HOME/.bashrc" ]]; then
    source "$HOME/.bashrc"
fi
