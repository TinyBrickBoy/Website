# syntax=docker/dockerfile:1
#
# Website-Container: baut die Hugo-Seite und liefert sie mit Caddy aus.
# Mit REPO_URL holt er sich regelmäßig den neuesten Stand (z. B. die täglichen
# Stats aus dem GitHub-Workflow) und baut sich ohne Neustart neu.
#
#   docker compose up -d --build

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
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh

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
