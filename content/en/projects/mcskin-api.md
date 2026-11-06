---
title: "mcskin-api"
weight: 4
description: "Fast Minecraft skin API in pure Go: faces, heads, bodies and 3D avatars from a username or UUID."
stack: ["Go"]
repo: "https://github.com/TinyBrickBoy/mcskin-api"
---

A fast, lean Minecraft skin API written in Go using only the standard library. It resolves usernames or UUIDs through the official Mojang APIs, fetches the skin texture and renders avatars from it.

## Endpoints

- `/skin` raw texture, `/face` and `/head` with hat layer
- `/body` front render, `/pfp` bust avatar, `/3dpfp` 3D render
- Size via `?size=N` (1–512)
