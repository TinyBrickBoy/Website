#!/bin/sh
# Startet Caddy und – wenn REPO_URL gesetzt ist – einen Updater, der das Repo
# regelmäßig abruft und die Seite bei Änderungen neu baut.
set -eu

SITE_DIR="${SITE_DIR:-/var/lib/site}"
REPO_DIR="$SITE_DIR/repo"
RELEASES="$SITE_DIR/releases"
CURRENT="$SITE_DIR/current"

log() { echo "[site] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

mkdir -p "$RELEASES"
# Zuerst die im Image gebaute Version ausliefern
[ -e "$CURRENT" ] || ln -s /srv/baked "$CURRENT"

build() {
  rev="$1"
  out="$RELEASES/$rev"
  if hugo --source "$REPO_DIR" --minify --gc --quiet -d "$out" ${BASE_URL:+--baseURL "$BASE_URL"} \
     && [ -f "$out/index.html" ]; then
    ln -sfn "$out" "$CURRENT"
    log "neue Version live: ${rev}"
    # nur die letzten 2 Versionen behalten
    ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +3 | xargs -r rm -rf
  else
    rm -rf "$out"
    log "Build fehlgeschlagen – alte Version bleibt online"
  fi
}

update_loop() {
  while :; do
    if [ ! -d "$REPO_DIR/.git" ]; then
      log "klone $REPO_URL ($REPO_BRANCH)"
      git clone --quiet --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$REPO_DIR" \
        && build "$(git -C "$REPO_DIR" rev-parse --short HEAD)" \
        || log "Klonen fehlgeschlagen"
    elif git -C "$REPO_DIR" fetch --quiet --depth 1 origin "$REPO_BRANCH"; then
      old="$(git -C "$REPO_DIR" rev-parse HEAD)"
      new="$(git -C "$REPO_DIR" rev-parse FETCH_HEAD)"
      if [ "$old" != "$new" ]; then
        git -C "$REPO_DIR" reset --quiet --hard FETCH_HEAD
        build "$(git -C "$REPO_DIR" rev-parse --short HEAD)"
      fi
    else
      log "Abruf fehlgeschlagen – versuche es später erneut"
    fi
    sleep "${UPDATE_INTERVAL:-3600}"
  done
}

if [ -n "${REPO_URL:-}" ]; then
  update_loop &
else
  log "REPO_URL nicht gesetzt – liefere die im Image gebaute Version aus"
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
