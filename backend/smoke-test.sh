#!/usr/bin/env bash
# Pre-deploy smoke tests for Fine Print Whisperer.
#
# Usage:
#   # 1a. Validate your Groq key + JSON-mode scan shape directly against the API
#   #     (default provider — de-risks the runtime unknown before deploying):
#   GROQ_API_KEY=gsk_... ./smoke-test.sh groq
#
#   # 1b. Or validate an Anthropic key + structured-output scan shape:
#   ANTHROPIC_API_KEY=sk-ant-... ./smoke-test.sh anthropic
#
#   # 2. Validate a running worker (local `wrangler dev`, or a deployed URL):
#   ./smoke-test.sh worker http://localhost:8787
#   ./smoke-test.sh worker https://fine-print-whisperer.<sub>.workers.dev
#
# Requires: curl, python3 (both already present on this machine).
set -euo pipefail

MODE="${1:-}"

# A short sample with a few obvious red-flag clauses.
read -r -d '' SAMPLE <<'EOF' || true
Terms of Service. By using the Service you agree to binding arbitration and waive
your right to a class action. Your subscription will automatically renew each month
unless you cancel. We may share your personal information with third-party advertising
partners. All fees are non-refundable. We may modify these terms at any time at our
sole discretion without prior notice.
EOF

pp() { python3 -m json.tool 2>/dev/null || cat; }

case "$MODE" in
  groq)
    : "${GROQ_API_KEY:?Set GROQ_API_KEY in the environment}"
    echo "== Groq /openai/v1/chat/completions with response_format json_object (scan shape) =="
    BODY=$(python3 - "$SAMPLE" <<'PY'
import json, sys
sample = sys.argv[1]
system = ("You are Fine Print Whisperer. Return ONLY a JSON object: "
          '{"tldr":[string],"riskScore":int,'
          '"redFlags":[{"title":string,"detail":string,"severity":"high|medium|low","category":string}],'
          '"greenFlags":[string]}')
print(json.dumps({
  "model": "llama-3.3-70b-versatile",
  "temperature": 0.3,
  "max_tokens": 1024,
  "response_format": {"type": "json_object"},
  "messages": [
    {"role": "system", "content": system},
    {"role": "user", "content": "DOCUMENT TEXT:\n" + sample},
  ],
}))
PY
)
    curl -sS https://api.groq.com/openai/v1/chat/completions \
      -H "content-type: application/json" \
      -H "authorization: Bearer $GROQ_API_KEY" \
      -d "$BODY" | pp
    echo
    echo "If you see choices[].message.content holding valid JSON (tldr/riskScore/redFlags/greenFlags) → key + JSON mode work."
    echo "If you see an 'error' about the model → pick another Groq model id in backend/src/providers/groq.js"
    echo "  (e.g. llama-3.1-8b-instant for cheaper/faster, or check console.groq.com for current ids)."
    ;;

  anthropic)
    MODEL="claude-haiku-4-5"
    : "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY in the environment}"
    echo "== Anthropic /v1/messages with output_config.format (scan shape) =="
    BODY=$(python3 - "$SAMPLE" <<'PY'
import json, sys
sample = sys.argv[1]
schema = {
  "type": "object",
  "properties": {
    "tldr": {"type": "array", "items": {"type": "string"}},
    "riskScore": {"type": "integer"},
    "redFlags": {"type": "array", "items": {"type": "object",
      "properties": {
        "title": {"type": "string"}, "detail": {"type": "string"},
        "severity": {"type": "string", "enum": ["high","medium","low"]},
        "category": {"type": "string"}
      }, "required": ["title","detail","severity","category"], "additionalProperties": False}},
    "greenFlags": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["tldr","riskScore","redFlags","greenFlags"], "additionalProperties": False
}
print(json.dumps({
  "model": "claude-haiku-4-5",
  "max_tokens": 1024,
  "system": "Return ONLY a JSON object describing red flags in the document.",
  "output_config": {"format": {"type": "json_schema", "schema": schema}},
  "messages": [{"role": "user", "content": "DOCUMENT TEXT:\n" + sample}]
}))
PY
)
    curl -sS https://api.anthropic.com/v1/messages \
      -H "content-type: application/json" \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -d "$BODY" | pp
    echo
    echo "If you see a JSON body with content[].text (valid JSON inside) → key + structured outputs work."
    echo "If you see an 'error' about output_config → drop output_config in backend/src/providers/claude.js"
    echo "  and rely on the prompt's JSON instruction + JSON.parse (the gemini.js pattern)."
    ;;

  worker)
    BASE="${2:?Usage: ./smoke-test.sh worker <base-url>}"
    echo "== POST $BASE/api/scan =="
    curl -sS -X POST "$BASE/api/scan" \
      -H "content-type: application/json" \
      -H "x-fpw-install-id: smoke-test" \
      -d "$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1]}))' "$SAMPLE")" | pp
    echo
    echo "== POST $BASE/api/chat =="
    curl -sS -X POST "$BASE/api/chat" \
      -H "content-type: application/json" \
      -H "x-fpw-install-id: smoke-test" \
      -d "$(python3 -c 'import json,sys; print(json.dumps({"tosText": sys.argv[1], "question": "Can I get a refund?"}))' "$SAMPLE")" | pp
    echo
    echo "Expect {\"data\":{tldr,riskScore,redFlags,greenFlags}} and {\"answer\":\"...\"}."
    ;;

  *)
    echo "Usage:"
    echo "  GROQ_API_KEY=gsk_... $0 groq"
    echo "  ANTHROPIC_API_KEY=sk-ant-... $0 anthropic"
    echo "  $0 worker http://localhost:8787"
    exit 1
    ;;
esac
