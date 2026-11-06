---
title: "mcskin-api"
weight: 4
description: "Schnelle Minecraft-Skin-API in reinem Go: Gesichter, Köpfe, Körper und 3D-Avatare aus Name oder UUID."
stack: ["Go"]
repo: "https://github.com/TinyBrickBoy/mcskin-api"
---

Eine schnelle, schlanke Minecraft-Skin-API in Go, nur mit der Standardbibliothek. Sie löst Namen oder UUIDs über die offiziellen Mojang-APIs auf, holt die Skin-Textur und rendert daraus Avatare.

## Endpunkte

- `/skin` rohe Textur, `/face` und `/head` mit Hut-Layer
- `/body` Ganzkörper von vorne, `/pfp` Büsten-Avatar, `/3dpfp` 3D-Render
- Größe per `?size=N` (1–512)
