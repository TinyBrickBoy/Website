# leo@tinybrickboy

Portfolio mit Hugo im Bento-Design (Theme „bento“). Englisch unter `/`, Deutsch unter `/de/`.

- Texte, Skills und Werkzeuge stehen in `hugo.toml` (je Sprache unter `[languages.<lang>.params]`).
- Projekte liegen in `content/<lang>/projects/`; die Kachelgröße steuert `size = "big" | "wide" | "full"` im Front Matter.
- Keine externen Skripte oder Schriften (Outfit und JetBrains Mono liegen in `themes/bento/static/fonts/`), passt also zur strengen CSP.
- Das alte Terminal-Design ist noch da: in `hugo.toml` `theme = "konsole"` setzen.

## Stats aktualisieren

`scripts/update-data.py` holt GitHub-, Codeberg- und ASN-Daten (RIPEstat) und speichert sie in `data/`.
Der Workflow `.github/workflows/update-stats.yml` macht das täglich und committet die Änderungen.

Einmalig im Repo einstellen: **Settings → Actions → General → Workflow permissions → Read and write permissions**.

Lokal: `python3 scripts/update-data.py`

## Deployen mit Docker

1. In `compose.yml` `REPO_URL` und `BASE_URL` eintragen.
2. `docker compose up -d --build`

Der Container liefert die Seite auf `127.0.0.1:8080` aus (davor ein Reverse-Proxy mit TLS) und
schaut stündlich (`UPDATE_INTERVAL`) nach neuen Commits. Gibt es welche, baut er die Seite neu und
schaltet ohne Ausfall um. Schlägt ein Build fehl, bleibt die alte Version online.

Härtung: read-only, ohne Root, ohne Capabilities, keine Zugriffslogs, strenge CSP.

## Lokal ansehen

`hugo server`
