#!/usr/bin/env bash
#
# dev-db.sh — local research-DB helper for offline / blocked-WiFi dev.
#
# Copies ONLY the `pmt_research` database from Atlas into your local mongod, so
# the backend can run fully offline via `npm run dev:local`. Your other local
# database (e.g. pmt_data) is never touched — the restore is scoped with
# --nsInclude='<db>.*' and --drop only drops collections it is restoring.
#
# No secrets live in this file: the Atlas URI is read from server/.env at
# runtime, never printed, and never placed on a command line — `pull` hands it
# to mongodump through a mode-600 --config file so `ps` can't see it. Safe to
# commit; the deploy never runs it.
#
# Usage (run from anywhere):
#   server/scripts/dev-db.sh status     # show local pmt_research collection counts
#   server/scripts/dev-db.sh pull        # dump pmt_research from Atlas -> restore to local
#
# `pull` must be run on a network where Atlas (TCP 27017) is reachable
# (home WiFi, phone hotspot, or a VPN) — it fails fast with guidance otherwise.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SERVER_DIR/.env"
LOCAL_URI="mongodb://127.0.0.1:27017"
NODE_BIN="$(command -v node)"

# --- read a KEY from server/.env without echoing / shell-expanding the value ---
read_env() {
  local key="$1"
  [ -f "$ENV_FILE" ] || { echo "✗ $ENV_FILE not found" >&2; exit 1; }
  # Everything after the first '=', then strip optional surrounding quotes.
  grep -E "^${key}=" "$ENV_FILE" | head -1 | sed -E "s/^${key}=//; s/^[\"']//; s/[\"']$//"
}

DB_NAME="$(read_env DB_NAME)"; DB_NAME="${DB_NAME:-pmt_research}"

redact_host() {  # print just the host for logs, never user:pass
  sed -E 's#^(mongodb(\+srv)?://)[^@]*@#\1<redacted>@#; s#(mongodb\.net)/.*#\1/…#'
}

status() {
  echo "→ local $LOCAL_URI  db=$DB_NAME"
  "$NODE_BIN" -e '
    const path=require("path");
    const {MongoClient}=require(path.join(process.argv[1],"node_modules/mongodb"));
    const dbName=process.argv[2];
    (async()=>{
      const c=await MongoClient.connect("mongodb://127.0.0.1:27017",{serverSelectionTimeoutMS:4000});
      const cols=await c.db(dbName).listCollections().toArray();
      if(!cols.length){console.log("  (empty — run: server/scripts/dev-db.sh pull)");}
      let total=0;
      for(const col of cols.sort((a,b)=>a.name.localeCompare(b.name))){
        const n=await c.db(dbName).collection(col.name).estimatedDocumentCount(); total+=n;
        console.log("  "+col.name.padEnd(26)+" "+n);
      }
      if(cols.length) console.log("  "+"= total docs".padEnd(26)+" "+total);
      await c.close();
    })().catch(e=>{console.error("  ✗ local mongod not reachable:",e.message);process.exit(1)});
  ' "$SERVER_DIR" "$DB_NAME"
}

# Resolve a mongodb+srv URI to a standard seed-list URI and write it (with
# credentials) to a mode-600 config file for the Go tools. Uses `dig` — the OS
# resolver answers SRV reliably even when the tools' built-in Go resolver returns
# EBADRESP / "cannot unmarshal DNS message" on flaky hotspot/captive DNS — with
# public-resolver fallbacks. The credential lives only in a shell var + the
# mode-600 file, never on argv. Returns non-zero if the cluster can't resolve.
write_seedlist_cfg() {
  local uri="$1" cfg="$2"
  local rest userinfo host seed txt authSource rs std r

  # Non-SRV URIs need no resolution — pass through, ensuring a db path.
  if [[ "$uri" != mongodb+srv://* ]]; then
    local base="${uri%%\?*}" q; q="${uri#"$base"}"; base="${base%/}"
    ( umask 077; printf 'uri: %s\n' "${base}/${DB_NAME}${q}" > "$cfg" )
    return 0
  fi

  rest="${uri#mongodb+srv://}"
  if [[ "$rest" == *@* ]]; then userinfo="${rest%%@*}"; rest="${rest#*@}"; else userinfo=""; fi
  host="${rest%%/*}"; host="${host%%\?*}"

  for r in "" "@1.1.1.1" "@8.8.8.8"; do
    seed="$(dig $r +short SRV "_mongodb._tcp.$host" 2>/dev/null | awk 'NF>=4{sub(/\.$/,"",$4);print $4":"$3}' | paste -sd, -)"
    if [ -n "$seed" ]; then txt="$(dig $r +short TXT "$host" 2>/dev/null | tr -d '"' | head -1)"; break; fi
  done
  [ -n "$seed" ] || return 1

  authSource="$(printf '%s' "$txt" | sed -nE 's/.*authSource=([^&]+).*/\1/p')"; authSource="${authSource:-admin}"
  rs="$(printf '%s' "$txt" | sed -nE 's/.*replicaSet=([^&]+).*/\1/p')"
  std="mongodb://${userinfo:+${userinfo}@}${seed}/${DB_NAME}?ssl=true&authSource=${authSource}&retryWrites=true"
  [ -n "$rs" ] && std="${std}&replicaSet=${rs}"
  ( umask 077; printf 'uri: %s\n' "$std" > "$cfg" )
  echo "  resolved: $(awk -F, '{print NF}' <<<"$seed") hosts, replicaSet=${rs:-(none)}" >&2
}

pull() {
  local uri; uri="$(read_env MONGO_URI)"
  [ -n "$uri" ] || { echo "✗ MONGO_URI not set in $ENV_FILE" >&2; exit 1; }
  echo "→ source: $(printf '%s' "$uri" | redact_host)"
  echo "→ target: $LOCAL_URI  db=$DB_NAME"

  # Build a seed-list mongodump config (off-argv). Resolves SRV via dig,
  # sidestepping the Go tools' flaky SRV resolver on hotspot/captive DNS.
  # NOT `local`: the EXIT trap (global scope) must still see these to clean the
  # credentialed cfg + archive after pull() returns; :- guards keep `set -u`
  # from tripping inside the trap.
  cfg="$(mktemp -t pmt_dbcfg_XXXX)"
  archive="$(mktemp -t pmt_research_XXXX).archive.gz"
  trap 'rm -f "${cfg:-}" "${archive:-}"' EXIT

  echo "→ resolving cluster (dig) …"
  if ! write_seedlist_cfg "$uri" "$cfg"; then
    echo "✗ could not resolve the Atlas cluster from this network (DNS)." >&2
    echo "  Make sure you're on an unblocked network (hotspot / home / VPN) and retry." >&2
    exit 2
  fi

  echo "→ dumping $DB_NAME from Atlas …"
  mongodump --config="$cfg" --gzip --archive="$archive"

  echo "→ restoring into local $DB_NAME (scoped; pmt_data untouched) …"
  mongorestore --uri="$LOCAL_URI" --gzip --archive="$archive" \
    --nsInclude="${DB_NAME}.*" --drop
  echo "✓ done."
  status
}

case "${1:-}" in
  status) status ;;
  pull)   pull ;;
  *) echo "usage: $0 {status|pull}" >&2; exit 64 ;;
esac
