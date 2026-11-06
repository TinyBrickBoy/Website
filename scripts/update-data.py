#!/usr/bin/env python3
"""
Aktualisiert alle Statistiken der Website und speichert sie unter data/.

  data/stats/github.json          Repos, Sterne, Follower, Sprachen
  data/stats/codeberg.json        dasselbe für Codeberg
  data/stats/asn.json             AS210881 von RIPEstat (Routing, RPKI, Updates …)
  data/contributions/github.json  Beiträge pro Tag (letztes Jahr)
  data/contributions/codeberg.json

Hugo liest diese Dateien beim Bauen. Schlägt eine Quelle fehl, bleibt die
alte Datei unverändert. Nur Standardbibliothek.

Aufruf:  python3 scripts/update-data.py
Optional: GITHUB_TOKEN gegen das Rate-Limit der GitHub-API.
"""
import datetime as dt
import json
import math
import os
import pathlib
import re
import sys
import tomllib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TODAY = dt.date.today()
UA = {"User-Agent": "konsole-stats-updater", "Accept": "application/json"}
RIPE = "https://stat.ripe.net/data/{}/data.json?resource={}"

failures = 0


# ---------------------------------------------------------------- helpers
def get(url, raw=False):
    headers = dict(UA)
    token = os.environ.get("GITHUB_TOKEN")
    if token and url.startswith("https://api.github.com/"):
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=40) as res:
        body = res.read().decode("utf-8")
    return body if raw else json.loads(body)


def save(rel, data):
    """Schreibt JSON nur, wenn sich der Inhalt (ohne Zeitstempel) geändert hat."""
    path = DATA / rel
    old = {}
    if path.exists():
        old = json.loads(path.read_text(encoding="utf-8"))
    strip = lambda d: {k: v for k, v in d.items() if k != "fetched"}
    if strip(old) == strip(data):
        print(f"  = {rel} unverändert")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"  ✓ {rel} aktualisiert")


def task(name):
    def wrap(fn):
        def run(*a):
            global failures
            print(f"- {name}")
            try:
                fn(*a)
            except Exception as exc:
                failures += 1
                print(f"::warning::{name} fehlgeschlagen ({exc}) – alte Daten bleiben.")
        return run
    return wrap


def lang_list(repos, lang_key="language"):
    counts = {}
    for r in repos:
        if r.get(lang_key):
            counts[r[lang_key]] = counts.get(r[lang_key], 0) + 1
    return [[k, v] for k, v in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:6]]


def level(n, mx):
    return 0 if n <= 0 or mx <= 0 else min(4, math.ceil(n * 4 / mx))


# ---------------------------------------------------------------- GitHub
@task("GitHub-Profil")
def github_stats(user):
    profile = get(f"https://api.github.com/users/{user}")
    repos, page = [], 1
    while True:
        batch = get(f"https://api.github.com/users/{user}/repos?per_page=100&page={page}")
        repos += batch
        if len(batch) < 100:
            break
        page += 1
    own = [r for r in repos if not r["fork"]]
    save("stats/github.json", {
        "fetched": TODAY.isoformat(),
        "user": user,
        "repos": len(own),
        "forks": len(repos) - len(own),
        "stars": sum(r["stargazers_count"] for r in own),
        "followers": profile["followers"],
        "since": profile["created_at"][:4],
        "langs": lang_list(own),
    })


@task("GitHub-Beitragskalender")
def github_contrib(user):
    html = get(f"https://github.com/users/{user}/contributions", raw=True)
    counts = {}
    for cell, text in re.findall(r'for="(contribution-day-component-[\d-]+)"[^>]*>\s*([^<]*)</tool-tip>', html):
        m = re.match(r"([\d,]+)", text.strip())
        counts[cell] = int(m.group(1).replace(",", "")) if m else 0
    days = sorted(
        [d, counts.get(c, 0), int(l)]
        for d, c, l in re.findall(
            r'data-date="(\d{4}-\d{2}-\d{2})" id="(contribution-day-component-[\d-]+)" data-level="([0-4])"', html)
    )
    if len(days) < 300:
        raise RuntimeError(f"nur {len(days)} Tage gefunden – Format geändert?")
    save("contributions/github.json", {
        "fetched": TODAY.isoformat(), "total": sum(d[1] for d in days), "days": days,
    })


# ---------------------------------------------------------------- Codeberg
@task("Codeberg-Profil")
def codeberg_stats(user):
    profile = get(f"https://codeberg.org/api/v1/users/{user}")
    repos, page = [], 1
    while True:
        batch = get(f"https://codeberg.org/api/v1/users/{user}/repos?limit=50&page={page}")
        repos += batch
        if len(batch) < 50:
            break
        page += 1
    own = [r for r in repos if not r["fork"]]
    save("stats/codeberg.json", {
        "fetched": TODAY.isoformat(),
        "user": user,
        "repos": len(own),
        "forks": len(repos) - len(own),
        "stars": sum(r["stars_count"] for r in own),
        "followers": profile["followers_count"],
        "since": profile["created"][:4],
        "langs": lang_list(own),
    })


@task("Codeberg-Beitragskalender")
def codeberg_contrib(user):
    per_day = {}
    for e in get(f"https://codeberg.org/api/v1/users/{user}/heatmap"):
        d = dt.datetime.fromtimestamp(e["timestamp"], dt.timezone.utc).date().isoformat()
        per_day[d] = per_day.get(d, 0) + e["contributions"]
    # wie GitHub: 52 volle Wochen + aktuelle Woche, Beginn an einem Sonntag
    start = TODAY - dt.timedelta(days=364 + (TODAY.isoweekday() % 7))
    mx = max(per_day.values(), default=0)
    days = []
    d = start
    while d <= TODAY:
        n = per_day.get(d.isoformat(), 0)
        days.append([d.isoformat(), n, level(n, mx)])
        d += dt.timedelta(days=1)
    save("contributions/codeberg.json", {
        "fetched": TODAY.isoformat(), "total": sum(x[1] for x in days), "days": days,
    })


# ---------------------------------------------------------------- ASN (RIPEstat)
@task("ASN (RIPEstat)")
def asn_stats(number):
    asn = f"AS{number}"
    ov = get(RIPE.format("as-overview", asn))["data"]
    st = get(RIPE.format("routing-status", asn))["data"]
    prefixes = [p["prefix"] for p in get(RIPE.format("announced-prefixes", asn))["data"]["prefixes"]]

    rpki = {}
    for p in prefixes:
        r = get(f"https://stat.ripe.net/data/rpki-validation/data.json?resource={asn}&prefix={p}")["data"]
        rpki[p] = r.get("status", "unknown")

    upstreams = []
    for n in [x for x in get(RIPE.format("asn-neighbours", asn))["data"]["neighbours"] if x["type"] == "left"][:5]:
        holder = get(RIPE.format("as-overview", f"AS{n['asn']}"))["data"].get("holder", "")
        upstreams.append(f"AS{n['asn']} {holder}".strip())

    abuse = get(RIPE.format("abuse-contact-finder", asn))["data"].get("abuse_contacts", [])

    geo, geo_pct = "", 0
    for res in get(RIPE.format("maxmind-geo-lite-announced-by-as", asn))["data"].get("located_resources", []):
        for loc in res["locations"]:
            if loc["covered_percentage"] > geo_pct:
                geo, geo_pct = f"{loc['country']} · {loc['city']}".strip(" ·"), loc["covered_percentage"]

    paths = get(RIPE.format("as-path-length", asn))["data"]["stats"]
    cnt = sum(p["count"] for p in paths) or 1

    v4 = v6 = 0
    first = "9999"
    for origin in get(RIPE.format("routing-history", asn))["data"]["by_origin"]:
        for p in origin["prefixes"]:
            if ":" in p["prefix"]:
                v6 += 1
            else:
                v4 += 1
            first = min([first] + [t["starttime"] for t in p["timelines"]])

    start = (TODAY - dt.timedelta(days=30)).isoformat()
    upd = get(f"https://stat.ripe.net/data/bgp-update-activity/data.json?resource={asn}&starttime={start}&sampling_period=86400")["data"]["updates"]

    save("stats/asn.json", {
        "fetched": TODAY.isoformat(),
        "holder": ov.get("holder", ""),
        "announced": ov.get("announced", False),
        "since": st["first_seen"]["time"][:10],
        "v4p": st["announced_space"]["v4"]["prefixes"],
        "v4ips": st["announced_space"]["v4"]["ips"],
        "v6p": st["announced_space"]["v6"]["prefixes"],
        "v4seen": st["visibility"]["v4"]["ris_peers_seeing"],
        "v4total": st["visibility"]["v4"]["total_ris_peers"],
        "v6seen": st["visibility"]["v6"]["ris_peers_seeing"],
        "v6total": st["visibility"]["v6"]["total_ris_peers"],
        "prefixes": prefixes,
        "rpki": rpki,
        "upstreams": upstreams,
        "abuse": abuse[0] if abuse else "",
        "geo": geo,
        "geoPct": round(geo_pct, 1),
        "pathAvg": round(sum(p["stripped"]["sum"] for p in paths) / cnt, 1),
        "pathMin": min((p["stripped"]["min"] for p in paths), default=0),
        "pathMax": max((p["stripped"]["max"] for p in paths), default=0),
        "collectors": len(paths),
        "histTotal": v4 + v6,
        "histV4": v4,
        "histV6": v6,
        "histSince": first[:4],
        "updates": [{"d": u["starttime"][:10], "n": (u["announcements"] or 0) + (u["withdrawals"] or 0)} for u in upd],
    })


# ---------------------------------------------------------------- main
def main():
    conf = tomllib.loads((ROOT / "hugo.toml").read_text(encoding="utf-8"))["params"]
    stats = conf.get("stats", {})
    if "github" in stats:
        github_stats(stats["github"]["user"])
        github_contrib(stats["github"]["user"])
    if "codeberg" in stats:
        codeberg_stats(stats["codeberg"]["user"])
        codeberg_contrib(stats["codeberg"]["user"])
    if "asn" in conf:
        asn_stats(conf["asn"]["number"])
    print(f"Fertig, {failures} Quelle(n) fehlgeschlagen.")
    # Nur scheitern, wenn gar nichts geklappt hat
    return 1 if failures >= 5 else 0


if __name__ == "__main__":
    sys.exit(main())
