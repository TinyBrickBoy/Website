---
title: "bgp-router"
weight: 2
description: "Weboberfläche für einen BGP-VPS: eigene IPv4/IPv6-Präfixe announcen und IPs per WireGuard an Backends routen."
stack: ["Go", "BIRD2", "WireGuard"]
repo: "https://github.com/TinyBrickBoy/router"
---

Software für einen BGP-VPS. Über eine Weboberfläche announcest du eigene IPv4- und IPv6-Präfixe und legst fest, wohin einzelne IPs oder Subnetze geroutet werden — lokal auf dem VPS oder per WireGuard zu einem Backend, etwa einem Homeserver.

## So funktioniert es

- **bgp-router** läuft auf dem VPS: Weboberfläche, generierte BIRD2-Konfiguration, WireGuard-Hub, Monitoring und Benachrichtigungen
- **bgp-agent** läuft auf jedem Backend: holt seine Konfiguration, baut den Tunnel auf und richtet die IPs lokal ein
- Backends brauchen kein BGP, nur ausgehendes UDP zum VPS
- Beides sind statische Go-Binaries ohne externe Abhängigkeiten
