#!/bin/bash
# C6: fixed PATH, so a python3, jq, awk... planted earlier in the user's PATH never runs here.
export PATH=/usr/bin:/bin
# /usr/bin/python3 and /usr/bin/git are xcrun shims: no lookup cache, which the user can write.
export xcrun_nocache=1
# PreToolUse (Bash), global. Enforces the guarantees of docs/AGENTS.md §4 on shell commands:
#   - git push/merge/rebase/reset --hard/checkout --/clean: never from Claude Code
#   - git commit: only with commit_allowed=true in task-scope.json, no --no-verify, no AI attribution
#   - new dependencies: only those listed in deps_allowed
#   - secrets: .env files are not printed or read

HOOK_NAME="bash-guard"
# Fail-closed: without lib.sh there is no block() and no command to read, and the hook would exit 0.
. "$(dirname "$0")/lib.sh" || { echo "BLOCKED by bash-guard: falta lib.sh junto al hook; sin él no se evalúa ningún comando" >&2; exit 2; }
read_input

cmd="$(json_get '.tool_input.command')"
# Fail-closed: if the command could not be read, it does not run.
[ -n "$cmd" ] || block "no se pudo leer el comando del hook (JSON inválido o sin tool_input.command)"
# Caps (S5): the cost of the analysis grows with the command, and a hook that times out does not block.
[ "${#cmd}" -le 65536 ] || block "comando de más de 65536 caracteres: escribe el contenido con Write en un fichero y ejecútalo desde ahí"

# Normalizes whitespace for the patterns.
flat="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"

# Sanitizing (TASK-044). shell_scan.py is a one-pass tokenizer that tracks quotes, $(…), `…`,
# comments and heredocs, and gives two views:
#   sanitized  one command segment per line (split at ; & && || | ( ) { } $( ` and newline).
#              Inside quotes, metacharacters become "_" and everything else is kept (".env" is
#              still .env, "a > b" is not a redirection). $(…) and `…`, also inside double
#              quotes, become segments of their own because bash runs them, and leave the word
#              $_ in the segment that uses their output. So does a "(" after a word (<( ), >( ),
#              =( ), a glob group or qualifier, ${(L)x}).
#   code       the original command without the bodies of data heredocs (cat/tee/python3/python
#              with no pipe after them). The git rules use it.
# When in doubt no text is hidden: an unclosed quote or heredoc makes the rest read as code.
# A write redirection whose target cannot be checked (TD-061: $(…), `…`, {a,b}, or a barrier
# piece around a variable) makes the scanner exit with status 5.
# Fail-closed: without shell_scan.py, without python3, or if the scanner fails, nothing runs.
scan_py="$(dirname "$0")/shell_scan.py"
[ -f "$scan_py" ] || block "falta el saneador $scan_py; sin él no se evalúa ningún comando"
sanitized="$(printf '%s' "$cmd" | python3 -I "$scan_py" sanitize 2>/dev/null)" || {
  rc=$?
  [ $rc = 4 ] && block "( tras una redirección de escritura (> (x), >>(x), 2>(x)…): zsh toma el destino como un patrón y no se puede revisar. Escribe la ruta literal; >(…) con un blanco delante sí se admite"
  [ $rc = 5 ] && block "destino de escritura que se calcula al ejecutar (sustitución, llaves, expansión o comodín) o que monta una barrera alrededor de una variable: no se puede revisar; escribe la ruta literal (una variable sola, > \"\$LOG\", sí se admite)"
  [ $rc = 6 ] && block "el script de sh -c / bash -c no es una sola cadena: hay texto pegado tras la comilla de cierre, una cadena vacía delante o comillas o \\ en una palabra sin comillas. Escribe todo el script dentro de una sola cadena entre comillas"
  [ $rc = 3 ] && block "# pegado a ( o ), o dentro de ( ), fuera de comillas: bash lo lee como comentario y zsh, en un patrón, como texto. Quítalo o ponlo entre comillas"
  block "el saneador shell_scan.py falló (sanitize) o falta python3; el comando no se evalúa"
}
code="$(printf '%s' "$cmd" | python3 -I "$scan_py" code 2>/dev/null)" \
  || block "el saneador shell_scan.py falló (code) o falta python3; el comando no se evalúa"
code_flat="$(printf '%s' "$code" | tr '\n\t' '  ' | tr -s ' ')"
# The same view without the $_ marker (B1): glued to a word (push$_, .env$_, apps/web/x$_), it
# would hide the word from the git, .env, write and printenv rules, and in zsh x$(:) is x. The
# scanner always leaves it at the end of a line, and it is removed only there: elsewhere, $_
# followed by letters is another variable (gre$_p is gre${_p}, not grep). Removing it only makes
# those rules stricter. The rules for dependencies, commit with dynamic options (S9) and cd keep
# $sanitized, because for them the marker is what blocks.
san_nm="$(printf '%s\n' "$sanitized" | sed 's/\$_$//')"
[ "$(printf '%s\n' "$sanitized" | wc -l)" -le 400 ] \
  || block "comando de más de 400 segmentos: escríbelo con Write en un fichero del scratchpad y ejecútalo desde ahí"
# Redirections among the words (CC3). A redirection, glued or not, can hide the command or its
# arguments: chflags>/dev/null nouchg x runs chflags, repeat 1 printenv>/tmp/o runs printenv (not
# a command named o) and git 2>/dev/null push runs git push. Each line with one is added again
# without its redirections and their files, before any rule reads it. A word that is only digits
# (2>, 10>) is a descriptor and goes with it; json2> is the word json2 and a redirection. A {name}
# glued to it stays: zsh runs {f}>/tmp/o as the group {f}. A process substitution (<(…), >(…), left
# as <$_ or >$_ after a blank) is an operand, as in $segs3: it becomes the word _ps_. The leading
# blank that a first redirection leaves is removed (cn_awk reads the first word). The redirection
# targets are still checked on the original lines (S16). This only adds lines, so it only adds
# matches.
san_rd="$(printf '%s\n' "$sanitized" | sed -E 's/(^|[[:space:]])[<>]\$_$/\1_ps_/' | sed -nE 's/(^|[[:space:]])[0-9]+(&?[<>])/\1\2/g; s/(&>>?|<<<|<>|<&|>&|>>|>[|!]?|<)[[:space:]]*[^[:space:]<>&]*/ /gp' | sed -E 's/^[[:space:]]+//')"
if [ -n "$san_rd" ]; then
  sanitized="$sanitized"$'\n'"$san_rd"
  san_nm="$(printf '%s\n' "$sanitized" | sed 's/\$_$//')"
fi
# Braces glued to the words (CC3). zsh runs {cmd args} and { cmd args}: a "{" glued to the start of
# the first word opens the group, and a "}" glued to the end of a word (the last one, or the one
# before a redirection) closes it. Each line of $sanitized with one of them is added again without
# them, before any rule reads it, so every rule sees the plain name and arguments: {cat .env},
# {git push} and {echo x > .claude/task-scope.json} are cat .env, git push and echo x > ….
# After a glued "}", zsh goes on with a reserved word (always, then, else, elif, do, fi, done,
# esac) and a command starts in the middle of the line: {true} always {cmd}, if {true} then cmd,
# if false; then {true} else cmd. Any other word there is a syntax error. A redirection can come
# between the "}" and the word ({printenv}>/tmp/o fi, {export -p} 2>/dev/null fi). A line with a
# "}" is split before each of those words (after a blank or a tab), and each piece is added
# without its leading "{" and its glued "}". This only adds lines, so it only adds matches.
san_br="$(printf '%s\n' "$sanitized" | awk '{ o = $0; s = $0 " "; gsub(/\t/, " ", s); gsub(/[}]+</, "<", s); gsub(/[}]+>/, ">", s); gsub(/[}]+&/, "\\&", s); if (o ~ /[}]/) gsub(/ +(always|then|else|elif|do|fi|done|esac) /, "\001&", s); n = split(s, part, /\001 +/); for (k = 1; k <= n; k++) { $0 = part[k] " "; sub(/^ *[{]+/, ""); gsub(/[}]+ /, " "); if (NF) { $1 = $1; if ($0 != o) print } } }')"
if [ -n "$san_br" ]; then
  sanitized="$sanitized"$'\n'"$san_br"
  san_nm="$(printf '%s\n' "$sanitized" | sed 's/\$_$//')"
fi
# Command name (C1). A line of $sanitized whose command is written in another way is added again
# with the plain name: without assignments (LC_ALL=C sed), leading redirections, the wrappers
# command, builtin, exec, nohup, nice, env, time, noglob, nocorrect and "-" with their options,
# the "=" of zsh (=rm) and the directory (/usr/bin/git), and in lower case, because APFS ignores
# case and GIT runs git. Only the name is lowered: options keep their case (-C/-c, -D). Every rule
# that reads $sanitized or $san_nm sees both lines, so this only adds matches. command -v/-V does
# not run the command and env -S splits a string: those lines are not rewritten.
# Also dropped (TD-112, TD-113, TD-087): zsh's coproc and repeat N, a [[ … ]] up to its ]] (the
# short if/while/until [[ … ]] cmd of zsh), the reserved words !, if, while and until, the words do,
# then, else, elif and always (zsh reads repeat 1 do cmd, [[ 1 ]] then cmd and {…} always {cmd}
# without a ";"), and any word
# that starts with "-" (the options that time -p leaves). zsh also runs {cmd} and { cmd}, with the
# braces glued: a "{" glued to the start of the line (not {a,b} or {1..3}) and a "}" glued to the
# end of the command name are removed. A line whose command is not known and has
# a ]] later is read again after it: a $( ) in the test ([[ -z $(:) ]] printenv) splits the line
# before the ]]. Each line gets at most 16 rounds: a line that still has a prefix after them is
# blocked (TD-093), instead of passing the command after it.
cn_awk='function drop() { sub(/^[^ ]+ */, "") }
{
  last = $0; stop = 0; abort = 0
  for (n = 0; NF && n < 16 && !stop; n++) {
    if ($1 ~ /^[A-Za-z_][A-Za-z0-9_]*\+?=/) { drop(); continue }
    if ($1 ~ /^[0-9]*(<|>|&>)/) { if ($1 ~ /^[0-9]*(<|>|&>)[<>&|!]*$/) drop(); drop(); continue }
    if ($1 ~ /^[{]./ && $1 !~ /,|[.][.]/) { sub(/^[{]/, ""); continue }
    w = tolower($1); sub(/^=/, "", w); sub(/^.*\//, "", w); if (w ~ /^[a-z0-9_.+-]+[}]+$/) sub(/[}]+$/, "", w)
    if (w != $1) $1 = w
    if ($0 != last) { print; last = $0 }
    if (w == "builtin" || w == "nohup" || w == "noglob" || w == "nocorrect" || w == "coproc" || w == "!" || w == "if" || w == "while" || w == "until" || w == "do" || w == "then" || w == "else" || w == "elif" || w == "always" || w ~ /^-/) { drop(); continue }
    if (w == "repeat") { drop(); drop(); continue }
    if (w == "[[") { if (match($0, / \]\]( |$)/)) $0 = substr($0, RSTART + RLENGTH); else $0 = ""; continue }
    if (w == "command" || w == "exec" || w == "nice" || w == "env" || w == "time") {
      drop()
      while (NF && $1 ~ /^-/ && !abort) {
        if ((w == "command" && $1 ~ /[vV]/) || (w == "env" && $1 ~ /^-[a-zA-Z0-9]*S/)) abort = 1
        else if ((w == "exec" && $1 ~ /^-[a-z]*a$/) || (w == "nice" && $1 == "-n") || (w == "env" && $1 ~ /^-[a-zA-Z0-9]*[uPLU]$/)) { drop(); drop() }
        else drop()
      }
      if (abort) break
      continue
    }
    if (match($0, /(^| )\]\] /)) { $0 = substr($0, RSTART + RLENGTH); continue }
    stop = 1
  }
  if (!stop && !abort && NF) exit 3
  if (!abort && NF && $0 != last) print
}'
san_cn="$(printf '%s\n' "$sanitized" | awk "$cn_awk")" \
  || block "más de 16 prefijos o envoltorios (nohup, env, builtin, repeat, asignaciones…) delante de una orden: quita los que sobran"
if [ -n "$san_cn" ]; then
  sanitized="$sanitized"$'\n'"$san_cn"
  san_nm="$(printf '%s\n' "$sanitized" | sed 's/\$_$//')"
fi
# Separators before "git" (S11): ; & | ( ) { } ` and blanks, plus "/" (/usr/bin/git), "="
# (=git, which zsh expands to the path of git) and "\" (\git, which skips aliases).
gsep='(^|[;&|(){}`[:space:]/=\])'
# Global git options (OD-D): git -c / --config-env / GIT_CONFIG_* can disable the hooks or run
# commands; they are blocked. The others (-C dir, --no-pager…) are removed so that the git rules
# see the subcommand. The git rules look at the raw text and at the sanitized segments (OD-C).
if printf '%s\n%s\n' "$code_flat" "$san_nm" | grep -Eq "${gsep}git([[:space:]]+((-C|--git-dir|--work-tree|--namespace)[[:space:]]+[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+(-c|--config-env)([[:space:]=]|\$)|GIT_CONFIG_(COUNT|PARAMETERS|KEY_[0-9]+)"; then
  block "git -c, --config-env y GIT_CONFIG_* no se usan desde Claude Code (pueden desactivar los hooks o ejecutar comandos)"
fi
git_norm="s#${gsep}git(([[:space:]]+((-C|--git-dir|--work-tree|--namespace)[[:space:]]+[^[:space:]]+|-[^[:space:]]+))+)([[:space:]])#\\1git\\6#g"
code_git="$(printf '%s\n' "$code_flat" | sed -E "$git_norm")"
san_git="$(printf '%s\n' "$san_nm" | sed -E "$git_norm")"
git_view="$(printf '%s\n%s\n' "$code_git" "$san_git")"

# ---- destructive / remote git --------------------------------------------------------
if printf '%s\n' "$git_view" | grep -Eq "${gsep}git[[:space:]]+(push|merge|rebase|cherry-pick|revert)([[:space:]]|\$)"; then
  block "push/merge/rebase/cherry-pick/revert los hace el humano fuera de Claude Code (ADR-006)"
fi
if printf '%s\n' "$git_view" | grep -Eq "${gsep}git[[:space:]]+reset[[:space:]]+--hard|${gsep}git[[:space:]]+checkout[[:space:]]+--[[:space:]]|${gsep}git[[:space:]]+restore[[:space:]]|${gsep}git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f|${gsep}git[[:space:]]+branch[[:space:]]+-[dD]|${gsep}git[[:space:]]+stash[[:space:]]+(drop|clear)"; then
  block "operaciones git que descartan trabajo están prohibidas desde Claude Code"
fi
# TD-089: git that moves a branch, rewrites the index or drops changes in other ways. These rules
# read only the sanitized segments ($san_git): there a quoted commit message is one word, so
# git commit -m "… git reset x" is not one of them. switch/checkout -f, --force,
# --discard-changes, -C and -B; branch -f, -M, -C and -d/-D anywhere in the options, --delete;
# update-ref.
git_fo='([[:space:]]+[^;&|[:space:]]+)*[[:space:]]+'
if printf '%s\n' "$san_git" | grep -Eq "${gsep}git[[:space:]]+(switch|checkout)${git_fo}(-[a-zA-Z]*[fCB][a-zA-Z]*|--force|--discard-changes)([[:space:]]|\$)|${gsep}git[[:space:]]+branch${git_fo}(-[a-zA-Z]*[dDfMC][a-zA-Z]*|--force|--delete)([[:space:]]|\$)|${gsep}git[[:space:]]+update-ref([[:space:]]|\$)"; then
  block "operaciones git que descartan trabajo están prohibidas desde Claude Code"
fi
# git reset: only a bare git reset and git reset [-q] [HEAD] [--] <paths> (unstaging) pass.
# Without HEAD or --, the word after reset can be a commit (git reset HEAD~1, git reset main).
reset_ok='^([[:space:]]+(-q|--quiet))*([[:space:]]+HEAD([[:space:]]+--)?([[:space:]]+[^-[:space:]][^[:space:]]*)*|[[:space:]]+--([[:space:]]+[^[:space:]]+)*)?[[:space:]]*$'
while IFS= read -r r; do
  [[ $r =~ $reset_ok ]] || block "git reset que mueve una rama o reescribe el índice (git reset <commit>, --soft, --mixed, --keep, --merge) no se usa desde Claude Code; para sacar rutas del índice: git reset HEAD -- <rutas>"
done <<< "$(printf '%s\n' "$san_git" | grep -oE "${gsep}git[[:space:]]+reset([[:space:]].*)?" | sed -E 's/^.?git[[:space:]]+reset//')"
if printf '%s\n' "$git_view" | grep -Eq "${gsep}git[[:space:]]+config[[:space:]]"; then
  block "no se cambia la configuración de git desde Claude Code"
fi
# Interpreters (S7): if the command starts an interpreter (sh, bash, zsh, python3, node, perl,
# ruby, source or ".") or uses <<<, the text it receives can build a destructive or remote git
# with split quotes (git\ push, "git"' push'), a here-string, a pipe or a heredoc. The git rules
# then apply to the whole command, without quotes or backslashes. The interpreter is looked for in
# the text and also without quotes (ba''sh, "bash"), and it ends at any non-word character
# (| bash;, | bash)). It is also looked for in the rewritten names of C1 (| BASH), and "git" is
# matched in any case (GIT push). tcsh, csh, fish, tclsh, wish, expect, osascript, php and lua run
# commands too, and so does awk when its program has system or getline (TD-077). The git forms of
# TD-089 count as well.
deq="$(printf '%s' "$flat" | tr -d "\"'\\\\" | sed -E 's#(^|[^A-Za-z0-9_.-])git(([[:space:]]+((-C|--git-dir|--work-tree|--namespace)[[:space:]]+[^[:space:]]+|-[^[:space:]]+))+)([[:space:]])#\1git\6#g')"
if printf '%s\n%s\n%s\n' "$flat" "$deq" "$san_cn" | grep -Eq '(^|[^A-Za-z0-9_.-])(sh|bash|zsh|dash|ksh|python3?|node|perl|ruby|source|tcsh|csh|fish|tclsh|wish|expect|osascript|php|lua)([^A-Za-z0-9_.-]|$)|(^|[;&|(){}])[[:space:]]*\.[[:space:]]|<<<' \
  || { printf '%s\n%s\n' "$flat" "$san_cn" | grep -Eq '(^|[^A-Za-z0-9_.-])[gnm]?awk([^A-Za-z0-9_.-]|$)' && printf '%s' "$flat" | grep -Eq 'system|getline'; }; then
  if printf '%s\n' "$deq" | grep -Eq '(^|[^A-Za-z0-9_.-])[gG][iI][tT][[:space:]]+(push|merge|rebase|cherry-pick|revert|config|reset[[:space:]]+--hard|clean[[:space:]]+-[a-zA-Z]*f|branch[[:space:]]+-[dD]|stash[[:space:]]+(drop|clear)|restore[[:space:]]|checkout[[:space:]]+--[[:space:]]|reset[[:space:]]+(--(soft|mixed|merge|keep)|[^-[:space:]])|update-ref|(switch|checkout)([[:space:]]+[^;&|[:space:]]+)*[[:space:]]+(-[a-zA-Z]*[fCB][a-zA-Z]*|--force|--discard-changes)|branch([[:space:]]+[^;&|[:space:]]+)*[[:space:]]+(-[a-zA-Z]*[dDfMC][a-zA-Z]*|--force|--delete))'; then
    block "push/merge/rebase/reset --hard/config de git dentro de un intérprete o de una cadena (bash -c, <<<, | bash, python3…): no se ejecutan desde Claude Code (ADR-006)"
  fi
fi

# ---- git commit ---------------------------------------------------------------------
if printf '%s\n' "$git_view" | grep -Eq "${gsep}git[[:space:]]+commit([[:space:]]|\$)"; then
  # Flags of git commit itself, in two views: (1) each sanitized segment that starts with git
  # commit, up to " -- " (what follows are paths); there a quoted flag is already the flag; (2) the
  # raw text after "git commit" up to -m/--message (what follows is the message), which covers a
  # commit inside bash -c "…". git accepts unique prefixes of long options (--amen, --no-verif).
  nv_re="(^|[[:space:]])(--no-ve[a-z]*|-n|-[a-zA-Z]*n[a-zA-Z]*)([[:space:]\"'\`)]|\$)"
  am_re="(^|[[:space:]])--am[a-z]*([[:space:]\"'\`)]|\$)"
  # View (1) comes from $sanitized, with the $_ marker (also the one glued to commit: commit$(…)),
  # for S9; --no-verify and --amend are looked for without it.
  commit_opts="$(printf '%s\n' "$sanitized" | sed -E "$git_norm" | sed -nE 's/^git[[:space:]]+commit((\$_)*)([[:space:]]|$)/ \1 /p' | sed -E 's/[[:space:]]--([[:space:]].*|$)//')
$(printf '%s\n' "$code_git" | grep -oE 'git[[:space:]]+commit([[:space:]][^;&|]*)?' | sed -E 's/^git[[:space:]]+commit//; s/([[:space:]]-[a-zA-Z]*m|[[:space:]]--message)([=[:space:]].*|$)/\1/; s/[[:space:]]--([[:space:]].*|$)//')"
  printf '%s\n' "${commit_opts//\$_/}" | grep -Eq -- "$nv_re" && block "git commit --no-verify está prohibido"
  printf '%s\n' "${commit_opts//\$_/}" | grep -Eq -- "$am_re" && block "git commit --amend está prohibido; crea un commit nuevo"
  # Options built from a variable or a substitution (S9): their value is not visible here. The
  # words of the sanitized segment count, except the value of -m/--message/-F/--file (it is the
  # message), and so does the raw text before -m.
  commit_dyn="$(printf '%s\n' "$commit_opts" | sed -E 's/[[:space:]](-[a-zA-Z]*[mF]|--message|--file)([=[:space:]]+)[^[:space:]]*/ /g')"
  printf '%s\n' "$commit_dyn" | grep -q '[$`]' && block "git commit con opciones montadas por una variable o una sustitución (\$…, \`…\`): escribe las opciones literales"
  # The message text is checked (-m, heredoc), not the paths in the command: a file in
  # /tmp/claude-*/ or a mention of .claude/ is not attribution. Messages passed with
  # -F <file> are not visible here; .githooks/commit-msg covers them.
  msgtext="$(printf '%s' "$cmd" | tr ' \t' '\n\n' | grep -v '/' | tr '\n' ' ')"
  if printf '%s' "$msgtext" | grep -Eiq 'co-authored-by|generated with|generated by|claude|anthropic|🤖'; then
    block "el mensaje de commit contiene atribución a IA; está prohibida (ADR-006)"
  fi
  allowed="$(scope_get commit_allowed)"
  [ "$allowed" = "true" ] || block "git commit solo está permitido tras /commit (commit_allowed=true en .claude/task-scope.json)"
fi

# ---- gh (GitHub CLI) ----------------------------------------------------------------
# gh can merge, delete or change the repository, its releases, secrets and workflows, and print
# its token (C4). Those subcommands are blocked. The reads stay allowed (gh pr view|list|checks|
# diff, gh run view|list|watch, gh api without a method), because the CI checks use them. gh api
# writes with -X/--method other than GET, and with -f/-F/--field/--raw-field/--input, which turn
# the request into a POST.
# Options may come before the subcommand (gh pr -R o/r merge).
gh_re='(^|[[:space:]/=\])gh[[:space:]]+'
gh_fl='([[:space:]]+-[^[:space:]]*([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+'
if printf '%s\n' "$san_nm" | grep -Eq "${gh_re}(pr${gh_fl}merge|repo${gh_fl}(delete|rename|edit)|release|secret|workflow${gh_fl}(run|enable|disable))([[:space:]]|\$)"; then
  block "gh pr merge, gh repo delete|rename|edit, gh release, gh secret y gh workflow run|enable|disable los hace el humano fuera de Claude Code (ADR-006)"
fi
if printf '%s\n' "$san_nm" | grep -Eq "${gh_re}auth[[:space:]]+(token|status([[:space:]].*)?[[:space:]](-t|--show-token))([[:space:]=]|\$)"; then
  block "no se imprime el token de gh (gh auth token, gh auth status --show-token)"
fi
gh_api="$(printf '%s\n' "$san_nm" | grep -E "${gh_re}api([[:space:]]|\$)" || true)"
while IFS= read -r seg; do
  [ -n "$seg" ] || continue
  read -r -a w <<< "${seg#*api}"
  meth=GET fld=0
  for ((i = 0; i < ${#w[@]}; i++)); do
    a="${w[i]}"
    if [[ $a == --method=* ]]; then meth="${a#--method=}"
    elif [[ $a == --method ]] || [[ $a =~ ^-[a-zA-Z]*X$ ]]; then meth="${w[i+1]-}"
    elif [[ $a =~ ^-[a-zA-Z]*X(.+)$ ]]; then meth="${BASH_REMATCH[1]}"
    fi
    [[ $a =~ ^(--field|--raw-field|--input|-[a-zA-Z]*[fF]) ]] && fld=1
  done
  [ $fld = 0 ] && case "$meth" in [gG][eE][tT]) continue ;; esac
  block "gh api con escritura (-X/--method distinto de GET, -f, -F, --field, --raw-field o --input) la hace el humano fuera de Claude Code; para leer, gh api sin método"
done <<< "$gh_api"

# ---- dependencies -------------------------------------------------------------------
# pnpm/npm/yarn/bun add|install with package names: each one must be in deps_allowed.
# `pnpm install` without packages (flags only) installs the lockfile and is allowed.
# Each segment of the command (one line of $sanitized) is checked on its own. A $(…) or `…` leaves
# the word $_ in the segment, which counts as a package that is not allowed, also when it is glued
# to the subcommand (pnpm add$(:) lodash: in zsh it is pnpm add lodash; C8).
# Options before the subcommand may take a value (N-3): pnpm -F <pkg>, --filter <pkg>, -C <dir>,
# --dir <dir>, --prefix <dir>, npm -w <ws>, yarn --cwd <dir>, and yarn workspace <ws>. Any option
# may take the next word that does not start with "-" as its value: the line matches if one way
# of reading its words reaches add, i or install, so pnpm -w add x is still add.
# The packages are read from the first add, i or install after the manager (the awk below), not
# from the end of that match: the longest reading may take add as the value of an option and a
# package named i, add or install as the subcommand (pnpm -w add i); the first one never sees
# fewer packages.
deps_re='^[[:space:]]*(pnpm|npm|yarn|bun)([[:space:]]+(-[^[:space:]]*|-[^[:space:]]*[[:space:]]+[^-[:space:]][^[:space:]]*|workspace[[:space:]]+[^[:space:]]+))*[[:space:]]+(add|i|install)((\$_)*)([[:space:]]|$)'
segs="$sanitized"
printf '%s\n' "$segs" | while IFS= read -r seg; do
  [[ $seg =~ $deps_re ]] || continue
  deps_allowed="$(scope_get deps_allowed)"
  # Flags and every redirection (2>&1, > file, < file) with its target are dropped.
  pkgs="$(printf '%s\n' "$seg" | awk '{ for (k = 2; k <= NF; k++) if ($k ~ /^(add|i|install)(\$_)*$/) break
    s = ($k ~ /\$_$/) ? "$_" : ""; for (k++; k <= NF; k++) s = s " " $k; print s }' | sed -E 's/[0-9]*[<>]&?[0-9]*[[:space:]]*[^[:space:]]*//g' | tr ' ' '\n' | grep -v '^-' | grep -v '^$' | sed -E 's/(.)@[^@/]+$/\1/')"
  for name in $pkgs; do
    if ! printf '%s\n' "$deps_allowed" | grep -Fxq "$name"; then
      printf 'BLOCKED by %s: dependencia %s no autorizada en el TASK PACKET (deps_allowed). Repórtala en el informe; el humano decide.\n' "$HOOK_NAME" "'$name'" >&2
      exit 2
    fi
  done
done || exit 2

# ---- shell writes -------------------------------------------------------------------
# scope-guard only sees Edit/Write. Here the shell writes that land inside the repository are
# checked: redirections (> >> >| >! &> &>> >& file, in any command) and the arguments of sed -i,
# tee, cp (target), mv, rm, touch, truncate and mkdir. Outside the repository (temporary files,
# caches) nothing is checked.
#   - Barriers (S13): .claude/hooks, .githooks, .claude/settings*.json, .git/config and .git/hooks,
#     and their parents (.claude, .git and the root), are never written by shell, with or without
#     an active task. Neither is .claude/task-scope.json: the Orchestrator writes it with Write,
#     and by shell any agent could grant itself commit_allowed, allow or deps_allowed.
#   - With an active task (allow other than "*"), everything else may only target scope paths.
# A relative path is resolved against every directory the command can be in (S4): the initial one
# and the one of each cd/pushd, because a cd inside ( ), $( ), bash -c or a pipe does not change
# the directory of what follows, and "cd -", popd or a cd to a variable can go back to the initial
# one. If the command starts with "cd <literal path> &&", that path replaces the initial one.
allow_scope="$(scope_get allow)"
scope_on=0
[ -n "$allow_scope" ] && [ "$allow_scope" != "*" ] && scope_on=1
# normp <absolute path>: sets NP to the normalized path (like os.path.normpath), without touching
# the disk and without starting processes, so the cost does not grow by one process per path (S5).
normp() {
  local IFS=/ part
  local -a parts=() out=()
  read -r -a parts <<< "$1"
  for part in ${parts[@]+"${parts[@]}"}; do
    case "$part" in
      ''|.) ;;
      ..) [ ${#out[@]} -gt 0 ] && unset "out[$((${#out[@]} - 1))]" ;;
      *) out+=("$part") ;;
    esac
  done
  NP="/${out[*]+${out[*]}}"
}
# absp <directory> <path>: NP gets the absolute path, or empty if it cannot be resolved (~user).
absp() {
  case "$2" in
    /*) normp "$2" ;;
    '~'|'~/'*) normp "$HOME/${2#\~}" ;;
    # ~+ is the directory itself. ~-, ~N, ~+N and ~-N ($OLDPWD and the directory stack) are not
    # known here and resolve from the root, like cd - (C7).
    '~+'|'~+/'*) normp "$1/${2#\~+}" ;;
    '~-'*|'~'[0-9]*|'~+'[0-9]*) case "$2" in */*) normp "$ROOT/${2#*/}" ;; *) normp "$ROOT" ;; esac ;;
    '~'*) NP="" ;;
    *) normp "$1/$2" ;;
  esac
  canon
}
# canon: the same file under another name (C5). /System/Volumes/Data/<path> is <path> (APFS
# firmlink), and /private/tmp, /private/var and /private/etc are /tmp, /var and /etc. NP and the
# root are compared in that form, case-insensitively like APFS. Symbolic links are not resolved.
canon() {
  shopt -s nocasematch
  case "$NP" in /System/Volumes/Data|/System/Volumes/Data/*) NP="${NP:20}"; NP="${NP:-/}" ;; esac
  case "$NP" in /private/tmp|/private/tmp/*|/private/var|/private/var/*|/private/etc|/private/etc/*) NP="${NP:8}" ;; esac
  shopt -u nocasematch
}
normp "$ROOT"; canon; croot="$NP"
ndirs=0
dirs=$'\n'
add_dir() {
  [ -n "$1" ] || return 0
  case "$dirs" in *$'\n'"$1"$'\n'*) return 0 ;; esac
  ndirs=$((ndirs + 1))
  [ $ndirs -le 16 ] || block "más de 16 directorios posibles por cd/pushd en un comando; divídelo en varios"
  dirs="$dirs$1"$'\n'
}
cd_segs="$(printf '%s\n' "$sanitized" | grep -E '^(cd|pushd|popd)([[:space:]]|$)' || true)"
# Leading chain "cd <literal path> && cd <literal path> && …": it is resolved in order, and its cd
# (the first lines of $sanitized and of $cd_segs) are not looked at again. "~" and "~/…" count as
# literals (they are $HOME) only if everything after the chain is joined by &&: with ; || & or a
# newline, what follows runs even if the cd fails (M1, still open for the other paths), and the
# previous behaviour is kept. "~user", "~-" and "~+" do not count (absp resolves ~- from the root).
cd_re='^[[:space:]]*cd[[:space:]]+("[^"$`\\~]+"|~(/[^"$`\\[:space:];&|<>(){}*?[]*)?|[^-"$`\\~=[:space:];&|<>(){}*?[][^"$`\\[:space:];&|<>(){}*?[]*)[[:space:]]*$'
base="$ROOT" rest="$cmd" cd_all="$cd_segs" tilde=0
while pre="${rest%%&&*}"; [ "$pre" != "$rest" ] && [[ $pre =~ $cd_re ]] && [[ $pre != *"'"* ]]; do
  d="${BASH_REMATCH[1]}"; d="${d#\"}"; d="${d%\"}"
  case "$d" in '~'*) tilde=1 ;; esac
  absp "$base" "$d"; base="$NP"
  rest="${rest#*&&}"
  case "$cd_segs" in *$'\n'*) cd_segs="${cd_segs#*$'\n'}" ;; *) cd_segs="" ;; esac
done
if [ $tilde = 1 ]; then
  case "${rest//&&/}" in *\;*|*\|*|*\&*|*$'\n'*) base="$ROOT" cd_segs="$cd_all" ;; esac
fi
add_dir "$base"
while IFS= read -r seg; do
  [ -n "$seg" ] || continue
  read -r -a w <<< "$seg"
  arg=""
  for a in "${w[@]:1}"; do
    case "$a" in -[LPe@]*) ;; *) arg="$a"; break ;; esac
  done
  case "${w[0]}:$arg" in
    popd:*|pushd:|*:-|*:[-+][0-9]*|*'$'*|*'`'*) add_dir "$ROOT" ;;
    cd:) add_dir "$HOME" ;;
    # A relative path is resolved from every directory known up to this segment.
    *) while IFS= read -r d; do [ -n "$d" ] && { absp "$d" "$arg"; add_dir "$NP"; }; done <<< "$dirs" ;;
  esac
done <<< "$cd_segs"
npairs=0
# check_target <path> <command>: blocks if the path, resolved from any possible directory, is a
# barrier or, with an active task, falls inside the repository and outside the scope.
check_target() {
  local t="$1" d rel
  case "$t" in
    /dev/*|'&'*|[0-9]|-|'') return 0 ;;                 # descriptors and nulls
    *'$'*|*'('*|*'{'*|*'`'*|*'<'*|*'>'*) return 0 ;;  # variables/expansions: cannot be resolved, not blocked
  esac
  while IFS= read -r d; do
    [ -n "$d" ] || continue
    npairs=$((npairs + 1))
    [ $npairs -le 128 ] || block "más de 128 rutas de escritura que resolver en un comando; divídelo en varios"
    absp "$d" "$t"
    [ -n "$NP" ] || continue
    shopt -s nocasematch   # APFS ignores case: .Claude/Hooks is .claude/hooks
    case "$NP" in "$croot") rel=. ;; "$croot"/*) rel="${NP:${#croot}+1}" ;; *) shopt -u nocasematch; continue ;; esac
    case "$rel" in
      .claude/hooks|.claude/hooks/*|.githooks|.githooks/*|.claude/settings*.json|.git/config|.git/hooks|.git/hooks/*)
        block "escritura por shell en '$rel': es una barrera (ADR-006) y solo la cambia el humano" ;;
      .claude/task-scope.json)
        block "escritura por shell en '$rel': es una barrera; el scope lo escribe el Orchestrator con Write" ;;
      .|.claude|.git)
        [ "$2" = mkdir ] || block "escritura por shell en '$rel': contiene barreras (ADR-006) y solo la cambia el humano" ;;
    esac
    shopt -u nocasematch
    [ $scope_on = 1 ] || continue
    case "$rel" in
      node_modules|node_modules/*|*/node_modules/*|.turbo/*|*/.turbo/*|dist/*|*/dist/*|.next/*|*/.next/*|coverage/*|*/coverage/*|.pnpm-store|.pnpm-store/*) continue ;;
    esac
    any_match "$rel" <<< "$allow_scope" && continue
    # mkdir of a PARENT directory of an allowed path (mkdir -p apps/web/src) touches nothing else.
    if [ "$2" = mkdir ] && printf '%s\n' "$allow_scope" | grep -Eq "^$(printf '%s' "$rel" | sed -e 's/[.[\*^$]/\\&/g')/"; then
      continue
    fi
    block "escritura por shell en '$rel' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo."
  done <<< "$dirs"
}
# Redirection targets (S16): ">&N" and ">&-" duplicate or close a descriptor, they are not files.
redir="$(printf '%s\n' "$san_nm" | grep -oE '(&>>?|>[>|!&]?)[[:space:]]*[^[:space:];&|<>]+' | sed -E 's/^>&[[:space:]]*([0-9]+|-)$//; s/^>&[[:space:]]*//; s/^(&>>?|>[>|!]?)[[:space:]]*//' || true)"
while IFS= read -r t; do
  [ -n "$t" ] && check_target "$t" ">"
done <<< "$redir"
# The arguments of the writing commands, without the redirections and their files (CC3): in
# cp /tmp/x .claude/task-scope.json 2>/dev/null the target is not /dev/null. A file descriptor
# glued in front (2>, {fd}>) goes too. The redirection targets are checked above.
san_wa="$(printf '%s\n' "$san_nm" | sed -E 's/(^|[[:space:]])([0-9]+|[{][A-Za-z_][A-Za-z0-9_]*[}])(&?[<>])/\1\3/g; s/(&>>?|<<<|<>|<&|>&|>>|>[|!]?|<)[[:space:]]*[^[:space:]<>&]*/ /g')"
while IFS= read -r seg; do
  read -r -a w <<< "$seg"
  [ ${#w[@]} -gt 1 ] || continue
  c="${w[0]##*/}"
  case "$c" in sed|tee|cp|mv|rm|touch|truncate|mkdir) ;; *) continue ;; esac
  inplace=0; last=""; args=()
  for a in "${w[@]:1}"; do
    case "$a" in
      -*) [ "$c" = sed ] && { [[ $a =~ ^-[a-zA-Z]*i ]] || [[ $a == --in-place* ]]; } && inplace=1 ;;
      *) last="$a"; args+=("$a") ;;
    esac
  done
  case "$c" in
    sed) [ $inplace = 1 ] && [ -n "$last" ] && check_target "$last" sed ;;
    cp) [ -n "$last" ] && check_target "$last" cp ;;
    *) for a in ${args[@]+"${args[@]}"}; do check_target "$a" "$c"; done ;;
  esac
done <<< "$san_wa"
# A $(…), `…`, <( ), >( ), =( ) or ( ) among the arguments of a writing command splits its
# segment: what comes after it lands on another line and is no longer checked as an argument
# (cp $(:) x .claude/hooks/lib.sh, rm "-rf$(:)" .claude, cp <(:) .claude/hooks/lib.sh). A writing
# command whose line ends in the $_ marker is blocked (OD-M, B-1).
while IFS= read -r seg; do
  case "$seg" in *'$_') ;; *) continue ;; esac
  read -r -a w <<< "$seg"
  case "${w[0]##*/}" in
    sed) [[ $seg =~ (^|[[:space:]])(-[a-zA-Z]*i|--in-place) ]] || continue ;;
    tee|cp|mv|rm|touch|truncate|mkdir) ;;
    *) continue ;;
  esac
  block "argumentos de ${w[0]##*/} montados con \$(…), \`…\`, <( ), >( ), =( ) o ( ): lo que va detrás no se puede revisar; escribe las rutas literales"
done <<< "$sanitized"

# ---- file flags ---------------------------------------------------------------------
# chflags can remove the uchg flag of the barrier files, if the human sets it (OD of cycle 3).
if printf '%s\n' "$san_nm" | grep -Eq '^([^[:space:]]*/)?chflags([[:space:]]|$)'; then
  block "chflags no se usa desde Claude Code: las marcas de los ficheros de barrera las pone y las quita el humano"
fi

# ---- secrets ------------------------------------------------------------------------
# Reading .env (S1, variant B): a segment with a word .env or .env.* (except .example) is blocked
# whatever the command, because almost any command reads a file (base64, dd if=, sort, "< .env"
# in zsh, $(<.env)). Case-insensitive: APFS ignores case too (.ENV is .env).
# Also blocked: a word with a glob or braces whose component starts with "." and may go on with
# "e" (envg_re: .env*, .en?, .e*, .*, {.env,}, .e{n,}v), and, in the text, a word that starts
# like that and has a "(" (the zsh alternation .e(n|x)v, which the sanitizer splits at the paren).
# First the value of --exclude/--exclude-dir, that of --grep in git log and the grep/rg pattern
# are removed, unless the pattern comes from -e/-f. The pattern is removed only if all options
# before it are known and take no value (M3: the value of --include, -g, -t… can be .env) and if
# it has no glob or braces (unquoted, the shell expands it to files).
# Commands that only look at the name are exempt (ls, test, [, [[, stat, echo, printf without
# options, git check-ignore, git status, git ls-files) if nothing reads or stores their output:
# no |, $(, `, <( or >( in the command, and no $ or < outside single quotes (W: cat $_, cat $x,
# < .env). "@" (curl -d @.env, -F f=@.env) and ":" (git show :.env, HEAD:.env) also name a file.
# A word ends at a blank, "<", ">" and "&" (cat .env&>/tmp/o).
env_re='(^|[/=@:])\.[eE][nN][vV](\.[A-Za-z0-9_.-]+)?$'
env_ex='\.[eE][nN][vV](\.[tT][eE][sS][tT])?\.[eE][xX][aA][mM][pP][lL][eE]$'
envg_re='(^|[/=@:,{|(+?-])\.([eE*?[{(,}|)]|$)'
gr_nv='recursive|line-number|ignore-case|smart-case|case-sensitive|fixed-strings|extended-regexp|basic-regexp|perl-regexp|word-regexp|line-regexp|files-with-matches|files-without-match|count|only-matching|with-filename|no-filename|invert-match|hidden|no-ignore|no-ignore-vcs|follow|heading|no-heading|no-messages|quiet|silent|text|null|column|vimgrep|json|pcre2|multiline|unrestricted|no-line-number|byte-offset|line-buffered|binary'
gr_pat='[^-*?[{[:space:]][^*?[{[:space:]]*([[:space:]]|$)'
gr_opt="-[abcEFGHhIiLlnoPpqRrSsTUuVvwxyZz]+|--($gr_nv)|--[a-z-]+=[^[:space:]]*"
rg_opt="-[abcFHhIiLlNnoPpqSsUuVvwxz0.]+|--($gr_nv)|--[a-z-]+=[^[:space:]]*"
gr_ef='(^|[[:space:]])(-[a-zA-Z]*[ef]|--regexp|--file)'
env_pre="$(printf '%s\n' "$san_nm" \
  | sed -E 's/(^|[[:space:]])--(exclude|exclude-dir)(=|[[:space:]]+)[^[:space:]]+/ /g' \
  | sed -E 's/^(git[[:space:]]+log([[:space:]].*)?[[:space:]])--grep(=|[[:space:]]+)[^[:space:]]+/\1 /' \
  | sed -E "/$gr_ef/!s/^((git[[:space:]]+)?[ef]?grep)(([[:space:]]+($gr_opt))*)([[:space:]]+--)?[[:space:]]+$gr_pat/\\1\\3 /" \
  | sed -E "/$gr_ef/!s/^(rg)(([[:space:]]+($rg_opt))*)([[:space:]]+--)?[[:space:]]+$gr_pat/\\1\\2 /")"
if printf '%s\n' "$env_pre" | tr ' <>&' '\n\n\n\n' | grep -Eq "$env_re|$envg_re"; then
  env_wl=1
  printf '%s' "$cmd" | sed 's/||//g' | grep -Eq '[|`]|\$\(|<\(|>\(' && env_wl=0
  case "$sanitized" in *'$'*|*'<'*) env_wl=0 ;; esac
  while IFS= read -r seg; do
    seg="${seg#"${seg%%[![:space:]]*}"}"
    if [ $env_wl = 1 ]; then
      case "$seg" in
        printf\ -*) ;;
        ls|ls\ *|test\ *|\[\ *|\[\[\ *|stat\ *|echo|echo\ *|printf\ *|git\ check-ignore\ *|git\ status|git\ status\ *|git\ ls-files|git\ ls-files\ *) continue ;;
      esac
    fi
    IFS=' <>&' read -r -a w <<< "$seg"
    for a in ${w[@]+"${w[@]}"}; do
      if { [[ $a =~ $env_re ]] && ! [[ $a =~ $env_ex ]]; } || { [[ $a == *[*?[{]* ]] && [[ $a =~ $envg_re ]]; }; then
        block "no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\\.env')"
      fi
    done
  done <<< "$env_pre"
fi
# Empty quotes before the word ('', "", $'') do not quote the glob group after them (TD-090):
# cat ''(.e)nv is cat (.e)nv in zsh, so they are removed before the quoted words are skipped.
if printf '%s\n' "$code_flat" | tr ' \t;&<>' '\n\n\n\n\n\n' | sed -E "s/^([\$]?(''|\"\"))+//" | grep -v "^[\"']" | grep -F '(' | grep -Eq "$envg_re"; then
  block "no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\\.env')"
fi
# A word that the sanitizer split at a $(…), `…` or "(" and that starts like .env (C9): in zsh,
# .e$(:)nv, .en`:`v, ".e"(n)v and .$(printf env) are .env. ${x:-.env} and ${x+.env} are caught by
# envg_re, whose prefix also takes "-", "+" and "?".
if printf '%s\n' "$sanitized" | grep -Eq '(^|[[:space:]/=@:])\.([eE]([nN]([vV](\.[A-Za-z0-9_.-]*)?)?)?)?\$_$'; then
  block "no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\\.env')"
fi
# A "}", ")" or ";" glued after printenv/env ends the word too ({docker exec c env}, … env;).
if printf '%s' "$flat" | grep -Eq 'docker[[:space:]]+(compose[[:space:]]+)?exec[^|;&]*[[:space:]](printenv|env)([^A-Za-z0-9_./=-]|$)|docker[[:space:]]+inspect[^|;&]*(Config\.Env|\.Env\b)|docker[[:space:]]+(compose[[:space:]]+)?exec[^|;&]*(cat|grep|sed|awk)[^|;&]*\.env'; then
  block "no se leen variables de entorno ni secretos de un contenedor en marcha; la evidencia con la base la aporta el humano con su .env"
fi
# Printing secrets: unfiltered `env`/`printenv`, or the EXPANSION of a variable with a sensitive
# name ($X, ${X}, ${!X}). Mentioning the name in a grep or reading a scratchpad file is not.
# `env`/`printenv` as the COMMAND (first token of a segment) without arguments dumps the whole
# environment. As an argument of another command (grep -i env, ls env/) it means nothing.
env_dump=0
segs3="$san_nm"
# The same lines without their redirections (env > f, env 2>&1, export -p >&2): a redirection
# does not stop a dump, so the rules below also see the line without it. Only the lines that
# change are added, and this only adds lines. A process substitution (<(…), >(…), left as <$_
# or >$_ after a blank) is an operand, not a redirection: it becomes the word _ps_, so
# printenv <(:) NAME stays printenv with an operand.
segs3="$segs3"$'\n'"$(printf '%s\n' "$sanitized" | awk '{
  o = $0; sub(/\$_$/, "", o); sub(/[[:space:]]+$/, "", o); n = $0
  if (n ~ /(^|[[:space:]])[<>]\$_$/) sub(/[<>]\$_$/, "_ps_", n)
  sub(/\$_$/, "", n); gsub(/[0-9]*(&>>?|[<>][>|!&]?)[[:space:]]*[^[:space:]]*/, " ", n); sub(/[[:space:]]+$/, "", n)
  if (n != o) print n
}')"
while IFS= read -r seg; do
  seg="${seg#"${seg%%[![:space:]]*}"}"
  case "$seg" in
    env|printenv|env[[:space:]]*|printenv[[:space:]]*)
      # a specific variable name that is not sensitive is allowed (printenv HOME)
      args="$(printf '%s' "$seg" | sed -E 's/^(printenv|env)[[:space:]]*//')"
      # `env -i X=y cmd` / `env X=y cmd` run a command with a given environment: allowed.
      if printf '%s' "$args" | grep -Eq '(^|[[:space:]])[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+[^[:space:]-]' && ! printf '%s' "$args" | grep -Eq '(^|[[:space:]])(env|printenv)([[:space:]]|$)'; then :
      elif [ -z "$args" ] || printf '%s' "$args" | grep -Eq '^-[^i]|^-i[[:space:]]*$|(^|[[:space:]])(env|printenv)([[:space:]]|$)' || printf '%s' "$args" | grep -Eq 'API_KEY|SECRET|TOKEN|PASSWORD|PASSWD'; then env_dump=1; fi ;;
    export|export[[:space:]]*|typeset|typeset[[:space:]]*|declare|declare[[:space:]]*|readonly|readonly[[:space:]]*|local|local[[:space:]]*|set)
      # Dumps without env (C3): export, typeset, declare, readonly and local (zsh, TD-092) without a name (export -p,
      # typeset -x, declare -px), with -m (a pattern) or with a sensitive name, and a bare set.
      # set -euo pipefail, set -o and export FOO=bar are not dumps.
      read -r -a w <<< "$seg"
      dump=1
      for a in "${w[@]:1}"; do
        case "$a" in [-+]*m*) dump=1; break ;; [-+]*) ;; *) dump=0 ;; esac
      done
      [ "${w[0]}" = set ] && [ ${#w[@]} -gt 1 ] && dump=0
      printf '%s' "$seg" | grep -Eq 'API_KEY|SECRET|TOKEN|PASSWORD|PASSWD' && dump=1
      [ $dump = 1 ] && env_dump=1 ;;
    setenv)
      # csh/tcsh: setenv without a name prints the whole environment (setenv NAME value sets it).
      env_dump=1 ;;
    ps|ps[[:space:]]*)
      # ps with "e" in BSD style (ps eww) or with -E prints the environment of each process (C3).
      read -r -a w <<< "$seg"
      case "${w[1]-}" in -*) ;; *[eE]*) env_dump=1 ;; esac
      for a in "${w[@]:1}"; do case "$a" in -*E*) env_dump=1 ;; esac; done ;;
  esac
done <<EOF3
$segs3
EOF3
[ "$env_dump" = 1 ] && block "no se vuelca el entorno completo ni variables sensibles"
# An expansion cut by the scanner among the arguments of printenv or env (X11). ${(L)x}, ${x:+(y)},
# $x[(r)y] and $x$(:) are split at the "(" or the "$(", so what follows them (the name) lands on
# another line and the rule above does not see it. In zsh an empty unquoted expansion is removed:
# printenv ${(L)x} OPENAI_API_KEY prints the key, and printenv ${(L)x} dumps the environment.
# The cut word is the last one of its line and starts with "$"; <(:), =(:) and 2> >(tee …) do not.
# env only counts when no command shows before the cut (env ${(L)x} printenv NAME).
cut_re='^\$.+\$_$'
while IFS= read -r seg; do
  case "$seg" in *'$_') ;; *) continue ;; esac
  read -r -a w <<< "$seg"
  [ ${#w[@]} -gt 1 ] || continue
  case "${w[0]}" in printenv|env) ;; *) continue ;; esac
  n=$((${#w[@]} - 1))
  [[ ${w[n]} =~ $cut_re ]] || continue
  if [ "${w[0]}" = env ]; then
    i=1; shown=0
    while [ $i -lt $n ]; do
      case "${w[i]}" in -*|*=*) ;; *) shown=1 ;; esac
      i=$((i + 1))
    done
    [ $shown = 0 ] || continue
  fi
  block "printenv o env con una expansión cortada por ( o \$(…) (\${(L)x}, \${x:+(y)}, \$x[(r)y], \$x\$(:)): en zsh una expansión vacía desaparece y el nombre que va detrás no se revisa; escribe el nombre literal"
done <<< "$sanitized"
if printf '%s' "$flat" | grep -Eq '\$\{?!?[A-Za-z0-9_]*(API_KEY|SECRET|TOKEN|PASSWORD|PASSWD)[A-Za-z0-9_]*\}?' ; then
  block "no se expanden variables de entorno con secretos"
fi
# Indirect expansion (${!V}) or eval: they can build the name of a variable piece by piece and
# get around the rule above. They have no legitimate use here. eval is also looked for as the
# command of each segment ($san_nm, with the lines of C1), where e""val, \eval, (eval …),
# $(eval …), bash -c 'eval …' and a heredoc that runs show it. Before it there may be the options
# that time -p leaves, coproc, and zsh's repeat N and [[ … ]]. zsh's flags P and e (${(P)x},
# ${(@P)x}, ${${(e)x}}) are indirect expansion and eval too (TD-085).
if printf '%s' "$flat" | grep -Eq '\$\{![A-Za-z_]|\$\{(\$\{)*\([^)]*[Pe]|(^|[;&| ])eval[[:space:]]' \
  || printf '%s\n' "$san_nm" | grep -Eq '^((-[^[:space:]]*|coproc|repeat[[:space:]]+[^[:space:]]+|\[\[.*\]\])[[:space:]]+)*eval([[:space:]]|$)'; then
  block "expansión indirecta o eval no permitidos (podrían exponer secretos por nombre compuesto)"
fi

# ---- executed downloads -------------------------------------------------------------
# The interpreter ends at any non-word character, as in S7: | bash;, | bash), {curl … | bash}.
if printf '%s' "$flat" | grep -Eq '(curl|wget)[^|]*\|[[:space:]]*(sh|bash|zsh|node|python3?)([^A-Za-z0-9_.-]|$)'; then
  block "no se ejecutan descargas directamente (curl | sh)"
fi

exit 0
