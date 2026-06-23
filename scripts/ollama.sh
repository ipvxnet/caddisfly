#!/usr/bin/env bash
# Delegate a small task to the LAN Ollama (default qwen3:14b). Fast path: native
# /api/chat with think:false — Qwen3's default thinking mode makes trivial tasks
# take 50-60s, so it's OFF here (~2-12s instead). See memory/lan-ollama.md.
#
# Usage:
#   scripts/ollama.sh "your prompt"
#   echo "your prompt" | scripts/ollama.sh
#   scripts/ollama.sh -s "system prompt" --json "user prompt"
#   scripts/ollama.sh -m gemma4:12b --think -t 0.7 "prompt"
#   scripts/ollama.sh --raw "prompt"        # full JSON response, not just .content
#
# Flags:
#   -s, --system TEXT   system prompt
#   -m, --model NAME    model (default qwen3:14b; use qwen2.5-coder:14b for code)
#   -t, --temp N        temperature (default 0.3)
#   -c, --conventions   prepend repo CONVENTIONS.md (bridge pattern + D1 idioms) — for code tasks
#   --json              request strict JSON output (Ollama format:json)
#   --think             enable thinking (default OFF — much slower)
#   --raw               print the full JSON response instead of just the content
#   -h, --help          show this help
#
# Env: OLLAMA_HOST (default http://192.168.1.100:11434)
# Stats (model / tokens / seconds) are printed to stderr so stdout stays clean
# for piping into files or other tools.
set -euo pipefail

MODEL="qwen3:14b"; SYSTEM=""; TEMP="0.3"; FORMAT=""; THINK="false"; RAW="false"; CONV="false"; PROMPT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--system) SYSTEM="${2:-}"; shift 2;;
    -m|--model)  MODEL="${2:-}"; shift 2;;
    -t|--temp)   TEMP="${2:-}"; shift 2;;
    -c|--conventions) CONV="true"; shift;;
    --json)      FORMAT="json"; shift;;
    --think)     THINK="true"; shift;;
    --raw)       RAW="true"; shift;;
    -h|--help)   sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    --) shift; PROMPT="${PROMPT:+$PROMPT }$*"; break;;
    *)  PROMPT="${PROMPT:+$PROMPT }$1"; shift;;
  esac
done

# Prompt from stdin when none given as args (e.g. piped input).
if [[ -z "$PROMPT" && ! -t 0 ]]; then PROMPT="$(cat)"; fi
if [[ -z "$PROMPT" ]]; then echo "ollama.sh: no prompt (pass as arg or via stdin)" >&2; exit 2; fi

# -c/--conventions: prepend the repo's CONVENTIONS.md so the model gets the bridge
# pattern + D1 idioms it otherwise gets wrong. Resolved relative to this script.
if [[ "$CONV" == "true" ]]; then
  CONV_FILE="$(cd "$(dirname "$0")/.." && pwd)/CONVENTIONS.md"
  if [[ -f "$CONV_FILE" ]]; then PROMPT="$(cat "$CONV_FILE")"$'\n\n'"$PROMPT"
  else echo "ollama.sh: --conventions set but $CONV_FILE not found" >&2; fi
fi

export OLLAMA_HOST="${OLLAMA_HOST:-http://192.168.1.100:11434}"
export MODEL SYSTEM TEMP FORMAT THINK RAW PROMPT
python3 - <<'PY'
import os, sys, json, time, urllib.request, urllib.error
host = os.environ['OLLAMA_HOST'].rstrip('/')
msgs = []
if os.environ.get('SYSTEM'):
    msgs.append({'role': 'system', 'content': os.environ['SYSTEM']})
msgs.append({'role': 'user', 'content': os.environ['PROMPT']})
body = {
    'model': os.environ['MODEL'],
    'think': os.environ['THINK'] == 'true',
    'stream': False,
    'options': {'temperature': float(os.environ['TEMP'])},
    'messages': msgs,
}
if os.environ.get('FORMAT') == 'json':
    body['format'] = 'json'
req = urllib.request.Request(host + '/api/chat', data=json.dumps(body).encode(),
                             headers={'Content-Type': 'application/json'})
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.loads(r.read())
except urllib.error.URLError as e:
    print(f"ollama.sh: cannot reach {host} ({e.reason}). Is the LAN host up / OLLAMA_HOST right?", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"ollama.sh: request failed: {e}", file=sys.stderr)
    sys.exit(1)
dt = time.time() - t0
if os.environ['RAW'] == 'true':
    print(json.dumps(d, indent=2, ensure_ascii=False))
else:
    print((d.get('message') or {}).get('content', ''))
print(f"[ollama] {os.environ['MODEL']} think={os.environ['THINK']} | "
      f"{d.get('eval_count')} tok | {dt:.1f}s", file=sys.stderr)
PY
