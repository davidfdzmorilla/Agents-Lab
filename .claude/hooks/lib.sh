#!/usr/bin/env bash
# Utilidades compartidas por los hooks de Claude Code de AgentLab.
# Los hooks reciben JSON por stdin y bloquean con exit 2 (mensaje en stderr).

set -u

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
SCOPE_FILE="$ROOT/.claude/task-scope.json"

# Lee todo el stdin una vez.
read_input() { INPUT="$(cat)"; export INPUT; }

# json_get '<jq path>' — extrae un valor escalar del INPUT. jq > python3 > node.
json_get() {
  local path="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r "$path // empty"
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -I -c '
import json,sys
p=sys.argv[1].lstrip(".").split(".")
try:
    o=json.load(sys.stdin)
    for k in p:
        if k: o=o[k]
    print("" if o is None else o)
except Exception: pass' "$path"
  else
    printf '%s' "$INPUT" | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{let o=JSON.parse(d);for(const k of process.argv[1].replace(/^\./,"").split(".")){if(k)o=o[k];}process.stdout.write(o==null?"":String(o));}catch(e){}})' "$path"
  fi
}

# scope_get '<key>' — lee una clave de task-scope.json (array → líneas; escalar → valor).
scope_get() {
  local key="$1"
  [ -f "$SCOPE_FILE" ] || return 0
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg k "$key" '.[$k] // empty | if type=="array" then .[] else . end' "$SCOPE_FILE"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -I -c '
import json,sys
try:
    o=json.load(open(sys.argv[1]))[sys.argv[2]]
    print("\n".join(map(str,o)) if isinstance(o,list) else ("" if o is None else o))
except Exception: pass' "$SCOPE_FILE" "$key"
  else
    node -e '
const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))[process.argv[2]];
if(Array.isArray(o))console.log(o.join("\n"));else if(o!=null)console.log(String(o));' "$SCOPE_FILE" "$key"
  fi
}

# Ruta del fichero objetivo de un Edit/Write/MultiEdit/NotebookEdit, relativa a ROOT.
target_path() {
  local p
  p="$(json_get '.tool_input.file_path')"
  [ -n "$p" ] || p="$(json_get '.tool_input.notebook_path')"
  [ -n "$p" ] || { echo ""; return; }
  case "$p" in
    /*) ;;
    *) p="$ROOT/$p" ;;
  esac
  # Normaliza sin resolver symlinks (el fichero puede no existir todavía).
  p="$(python3 -I -c 'import os,sys;print(os.path.normpath(sys.argv[1]))' "$p" 2>/dev/null || printf '%s' "$p")"
  case "$p" in
    "$ROOT"/*) printf '%s' "${p#"$ROOT"/}" ;;
    *) printf 'OUTSIDE:%s' "$p" ;;
  esac
}

# glob_match '<glob>' '<ruta relativa>' — soporta **/, **, * y ?. Puro bash + sed portable.
glob_match() {
  local g="$1" p="$2" re
  re="$g"
  re="${re//\*\*\//$'\x01'}"
  re="${re//\*\*/$'\x02'}"
  re="${re//\*/$'\x03'}"
  re="${re//\?/$'\x04'}"
  re="$(printf '%s' "$re" | sed -e 's/[.+^$(){}|[]/\\&/g')"
  re="${re//$'\x01'/(.*\/)?}"
  re="${re//$'\x02'/.*}"
  re="${re//$'\x03'/[^\/]*}"
  re="${re//$'\x04'/.}"
  [[ "$p" =~ ^${re}$ ]]
}

# any_match '<ruta>' <<< "<globs, uno por línea>"
any_match() {
  local path="$1" g
  while IFS= read -r g; do
    [ -z "$g" ] && continue
    [ "$g" = "*" ] && return 0
    glob_match "$g" "$path" && return 0
  done
  return 1
}

block() { printf 'BLOCKED by %s: %s\n' "${HOOK_NAME:-hook}" "$*" >&2; exit 2; }
