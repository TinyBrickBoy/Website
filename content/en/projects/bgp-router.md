---
title: "bgp-router"
weight: 3
description: "Web UI for a BGP VPS: announce your own IPv4/IPv6 prefixes and route IPs to backends over WireGuard."
stack: ["Go", "BIRD2", "WireGuard"]
repo: "https://github.com/TinyBrickBoy/router"
size: "wide"
---

Software for a BGP VPS. Through a web interface you announce your own IPv4 and IPv6 prefixes and decide where single IPs or subnets are routed — configured locally on the VPS or sent through WireGuard to a backend such as a home server.

## How it works

- **bgp-router** runs on the VPS: web UI, generated BIRD2 config, WireGuard hub, monitoring and notifications
- **bgp-agent** runs on every backend: pulls its config, sets up the tunnel and configures the IPs locally
- Backends need no BGP at all, only outgoing UDP to the VPS
- Both are static Go binaries without external dependencies
