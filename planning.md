# planning.md — Project Planning & AI Context

> **Role of this file**
> This document defines *what* we are building and *how the AI should help right now*.
> It is intentionally lightweight on low-level architecture details (see `architecture.md`).
>
> Claude Code should treat this as the **primary source of truth**.

---

## 1. Project Snapshot

**Project Name:** Asteroidz

**One-Sentence Elevator Pitch:**
A web-based 2D multiplayer Asteroids game for 2–6 players with destructible arena walls, classic drift physics, and one-shot kills.

**Target Platform(s):** Desktop browsers + mobile browsers (touch controls)

**Tech Stack:** TypeScript, Phaser 3, Socket.IO, Node.js

---

## 2. Design Pillars (Gameplay-Driven)

> These are non-negotiable. If a suggestion violates one, it should be rejected.

1. **Gameplay Feel First** – classic drift/inertia movement must feel tight and responsive.
2. **Readable State** – the player should always understand what is happening (who killed whom, ammo state, match status).
3. **Iteration Speed** – features must be fast to tweak and rebalance.

---

## 3. Core Gameplay Loop

> From the player's perspective.

1. Open game URL — choose **Create Lobby** or **Join Lobby** (via shareable direct link)
2. Enter the game immediately — match is in **warmup mode** (infinite respawns, kills don't count)
3. Lobby leader presses **Start Match** when ready
4. **Race to 5 kills** — one-shot kills, respawn after 2–3s delay, ammo is limited (5 shots, refill via pickups)
5. First to 5 kills wins — **victory scoreboard** shown for ~5–10 seconds
6. Map resets, loop returns to warmup (#2)

---

## 4. Player Abilities & Systems (High Level)

> No implementation details here — only intent.

### Player Capabilities
- **Movement:** Classic Asteroids drift/inertia — W thrusts in facing direction, A/D rotate, ship coasts with momentum
- **Combat:** Single-bullet projectiles, 5-shot ammo pool, must find ammo pickups to refill. No ammo = evade only.
- **Survival:** One-shot kill. Shield pickup absorbs one extra hit.

### Core Systems
- **Arena:** Destructible polygon-chunk walls forming arena boundary. Destruction is permanent per match. Void beyond walls = death (suicide, no kill credit).
- **Pickups:** Ammo refill + Shield. Spawn in arena on timers.
- **Ship Collision:** Ships bounce off each other physically (not pass-through).
- **Scoring:** First to 5 kills wins. Deaths don't eliminate — always respawn.

### Controls
- **Desktop:** W = Thrust, A = Rotate Left, D = Rotate Right, Space = Shoot
- **Mobile:** Split-screen touch layout — left side: rotate L/R buttons, right side: thrust + shoot buttons

---

## 5. Scope Control

### In Scope (Prototype)
- Lobby creation via shareable URL (direct link join)
- Warmup → match → victory → warmup loop
- Classic drift movement + 1-shot kill combat
- 5-shot ammo with pickup refills
- Shield pickup
- Destructible polygon arena walls (permanent, void = death)
- Ship-to-ship bounce collision
- Minimal HUD (kill count, ammo near ship)
- Kill feedback via screen flash
- Player name input, auto-assigned colors
- Mobile touch controls (split-screen layout)
- Respawn after 2–3 second delay
- Victory scoreboard (5–10s)
- Deploy to local LAN and Railway (cloud)

### Explicitly Out of Scope
- Server-authoritative physics / cheat protection
- Audio (SFX or music)
- Account system / persistent stats
- Multiple game modes
- AI bots
- Spectator mode

### Nice-to-Have (Do Not Build Yet)
- Kill feed text
- Lobby browser
- Leader match settings (kill target, map size)
- Additional pickup types (speed boost, rapid fire)
- Ram/melee kill mechanic
- Minimap

---

## 6. Current Development Phase

**Phase:** Prototype

### Active Goals
- [ ] Set up monorepo project structure (client/server/shared)
- [ ] Core networking with Socket.IO (relay server, lobby system)
- [ ] Phaser game scene with drift movement
- [ ] Shooting + ammo system
- [ ] Destructible polygon arena walls
- [ ] Pickup spawning (ammo + shield)
- [ ] Match flow (warmup → match → victory → reset)
- [ ] Mobile touch controls
- [ ] Deploy to Railway

### Risks
- Polygon wall destruction complexity — may need to simplify if performance is an issue
- Relay networking sync — client-side simulation divergence without authority
- Phaser + Socket.IO integration patterns (not heavily documented)

---

## 7. AI Assistant Instructions (Claude Code)

> This section is authoritative. Claude must follow it strictly.

### Role
You are a **senior web game developer** assisting an experienced developer.

### Expectations
- Prioritize gameplay clarity over abstraction
- Optimize only when required or requested
- Prefer idiomatic TypeScript and Phaser patterns
- Keep networking logic simple — this is a relay server, not authoritative

### When Requirements Are Unclear
- Ask **one concise clarifying question** before writing code
- Do not invent mechanics or rules

### Output Rules
- Provide complete, working TypeScript files
- Use clear comments explaining intent
- State assumptions explicitly

---

## 8. Open Questions

> These are unresolved. Do not assume answers.

- Exact pickup spawn mechanics (timer intervals, spawn locations, max concurrent pickups)
- Arena size and shape specifics
- How many polygon chunks make up the walls
- Exact respawn invulnerability duration (if any)
- Ship speed / thrust / rotation tuning values

---

## 9. Change Log

- 2026-04-01: Full rewrite — web-based multiplayer Asteroids with TypeScript/Phaser/Socket.IO. All sections filled from design interview.
