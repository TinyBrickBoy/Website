# syntax=docker/dockerfile:1
#
# Website-Container: baut die Hugo-Seite und liefert sie mit Caddy aus.
# Mit REPO_URL holt er sich regelmäßig den neuesten Stand (z. B. die täglichen
# Stats aus dem GitHub-Workflow) und baut sich ohne Neustart neu.
#
#   docker compose up -d --build
#
# Alles steckt in dieser einen Datei – kein docker/-Ordner nötig.

ARG HUGO_VERSION=0.140.2
ARG CADDY_VERSION=2.10

# ---------------------------------------------------------------- Hugo holen
FROM alpine:3.22 AS hugo
ARG HUGO_VERSION
ARG TARGETARCH=amd64
RUN wget -q -O /tmp/hugo.tar.gz "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_linux-${TARGETARCH}.tar.gz" \
 && tar -xzf /tmp/hugo.tar.gz -C /usr/local/bin hugo \
 && rm /tmp/hugo.tar.gz \
 && hugo version

# ---------------------------------------------------------------- Seite bauen
FROM alpine:3.22 AS build
COPY --from=hugo /usr/local/bin/hugo /usr/local/bin/hugo
WORKDIR /src
COPY . .
ARG BASE_URL=""
RUN hugo --minify --gc --cleanDestinationDir -d /out ${BASE_URL:+--baseURL "$BASE_URL"} \
 && test -f /out/index.html

# ---------------------------------------------------------------- Auslieferung
FROM caddy:${CADDY_VERSION}-alpine

# hadolint ignore=DL3018
RUN apk add --no-cache git tini \
 && addgroup -S -g 10001 web \
 && adduser -S -D -H -u 10001 -G web -s /sbin/nologin web \
 && install -d -o web -g web /var/lib/site \
 # Datei-Capability (Port <1024) entfernen: wir lauschen auf 8080, und mit
 # no-new-privileges + cap_drop ALL ließe sich caddy sonst nicht starten
 && cp /usr/bin/caddy /tmp/caddy && mv -f /tmp/caddy /usr/bin/caddy

COPY --from=hugo /usr/local/bin/hugo /usr/local/bin/hugo
COPY --from=build /out /srv/baked
# Webserver-Konfiguration (direkt hier drin, keine Zusatzdateien nötig)
COPY <<"CADDYFILE" /etc/caddy/Caddyfile
# Statische Auslieferung ohne Zugriffslogs, ohne Tracking, mit strengen Headern.
# TLS übernimmt der Reverse-Proxy davor (oder Caddy auf dem Host).
{
	admin off
	auto_https off
	persist_config off
}

:8080 {
	root * /var/lib/site/current
	encode zstd gzip

	header {
		Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"
		Referrer-Policy "no-referrer"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Cross-Origin-Opener-Policy "same-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()"
		-Server
	}

	# CSS, JS und Schrift haben Hashes/ändern sich nie → lange cachen
	@assets path /css/* /js/* /fonts/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
	@pages not path /css/* /js/* /fonts/*
	header @pages Cache-Control "public, max-age=300"

	file_server

	handle_errors {
		@de path /de/*
		rewrite @de /de/404.html
		rewrite * /404.html
		file_server
	}
}
CADDYFILE

# Startskript: Caddy + optionaler Updater
COPY --chmod=755 <<"SCRIPT" /usr/local/bin/entrypoint.sh
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
SCRIPT

ENV HOME=/tmp \
    XDG_CONFIG_HOME=/tmp/caddy-config \
    XDG_DATA_HOME=/tmp/caddy-data \
    SITE_DIR=/var/lib/site \
    REPO_URL="" \
    REPO_BRANCH=main \
    UPDATE_INTERVAL=3600 \
    BASE_URL=""

USER web
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
