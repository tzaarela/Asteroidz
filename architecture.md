# architecture.md — Technical Architecture & Code Contracts

> **Role of this file**
> This document defines *how the game is built* at a technical level.
> Claude Code should use this to stay consistent with the project's architecture.

---

## 1. Architectural Goals

- High gameplay iteration speed
- Predictable data flow
- Debuggable systems
- Minimal hidden magic
- Simple relay networking (no server authority)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Game Engine | Phaser 3 |
| Language | TypeScript (strict mode) |
| Networking | Socket.IO |
| Server Runtime | Node.js |
| Deployment | Local LAN + Railway (cloud) |

---

## 3. Project Structure

```
/
  package.json          # Root — scripts for dev, build, start
  tsconfig.json         # Base TypeScript config
  client/
    index.html
    src/
      main.ts           # Phaser game bootstrap
      scenes/           # Phaser scenes (Menu, Game, Victory)
      systems/          # Gameplay systems (movement, shooting, pickups, arena)
      network/          # Socket.IO client wrapper
      ui/               # HUD, touch controls, lobby UI
      types/            # Client-specific types
  server/
    src/
      index.ts          # Express + Socket.IO server entry
      lobby/            # Lobby management (create, join, state)
      relay/            # Message relay logic
      types/            # Server-specific types
  shared/
    types/              # Shared types/interfaces (messages, game state, constants)
    constants.ts        # Tunable gameplay values (single source of truth)
```

---

## 4. Networking Model

### Relay Server
- The server does **not** run game simulation
- Server responsibilities:
  - Lobby management (create/join/leave, shareable link routing)
  - Relay player inputs and state between clients
  - Track match state (warmup/active/victory) and scores
  - Broadcast authoritative match events (match start, match end, score updates)
- Clients run their own Phaser simulation and send state updates
- Clients trust each other's reported positions, shots, and hits

### Socket.IO Events (Draft)
- `lobby:create` / `lobby:join` / `lobby:leave`
- `lobby:start` (leader only)
- `player:update` (position, rotation, velocity)
- `player:shoot`
- `player:hit` (report a kill)
- `player:died` / `player:respawn`
- `pickup:spawn` / `pickup:collected`
- `arena:destroy` (wall chunk destroyed)
- `match:state` (warmup / active / victory)
- `match:scores`

### Sync Strategy
- Clients send position updates at a fixed rate (~20/s)
- Other clients interpolate remote player positions
- Hit detection runs on the shooter's client — shooter reports kills
- Server validates kill count and declares winner

---

## 5. Game Systems

### Movement (Client)
- Classic Asteroids drift: thrust adds velocity in facing direction
- Ship has max speed, drag coefficient (slow coast to stop)
- A/D rotate at fixed angular velocity
- All physics values in `shared/constants.ts`

### Shooting (Client)
- 5-shot ammo pool, no auto-reload
- Must collect ammo pickup to refill
- Bullets travel at fixed speed, despawn after max distance or wall/player hit
- Fire rate limit (~0.2s between shots)

### Arena (Client)
- Arena boundary made of polygon chunks (irregular shapes)
- Shooting a chunk destroys it permanently (for the duration of the match)
- Beyond destroyed walls is void — flying into void = death (suicide)
- Arena resets on match reset (warmup restart)

### Pickups (Client, Synced)
- Two types: **Ammo** (refills to 5) and **Shield** (absorbs one hit)
- Spawn at predefined locations on a timer
- One client (lobby leader) acts as pickup authority — decides spawns, broadcasts to all
- Collecting a pickup removes it for everyone

### Ship Collision (Client)
- Ships physically bounce off each other
- No damage from collision — only bullets kill
- Simple elastic collision response

### Respawn
- On death: 2–3 second delay, then respawn at random safe location
- During warmup: same behavior, kills don't count toward score
- During match: same behavior, kills count toward first-to-5

---

## 6. UI & HUD

### Menu / Lobby
- Landing page: "Create Lobby" button + "Enter Name" field
- Creating a lobby generates a shareable URL (e.g. `/game/ABC123`)
- Joining via link goes straight into the game
- Lobby leader sees a "Start Match" button in-game

### In-Game HUD (Minimal)
- Kill count displayed on screen
- Ammo count displayed near/on the ship
- Shield indicator when active
- No kill feed text — screen flash on kills only

### Victory Screen
- Scoreboard overlay showing all players' kill counts
- Displayed for ~5–10 seconds after someone reaches 5 kills
- Auto-transitions back to warmup

### Mobile Touch Controls
- Split-screen layout:
  - **Left side:** Rotate Left (A) and Rotate Right (D) buttons
  - **Right side:** Thrust (W) and Shoot (Space) buttons
- Buttons are large, semi-transparent overlays
- Detect touch vs mouse on load — show touch controls only on touch devices

---

## 7. Visual Style

- **Modern Minimal:** filled geometric shapes, subtle glow/particle effects, dark background
- Ships are simple geometric shapes with distinct auto-assigned colors
- Bullets are small bright projectiles
- Arena walls are rocky polygon chunks with a solid fill
- Destruction shows brief particle burst
- Screen flash effect on kills
- Camera follows the local player (larger-than-screen world)

---

## 8. Coding Standards

### General
- TypeScript strict mode
- One module/class per file
- Explicit types — avoid `any`
- Constants and tuning values in `shared/constants.ts`

### Phaser Specific
- Use Phaser scenes for state management (MenuScene, GameScene, VictoryScene)
- Use Phaser's built-in physics (Arcade) for movement and collision
- Keep rendering logic in Phaser — no raw canvas manipulation
- Separate game logic from rendering where practical

### Networking
- All Socket.IO event names and payload types defined in `shared/types/`
- Client network code isolated in `client/src/network/`
- Server relay logic isolated in `server/src/relay/`

---

## 9. Development & Deployment

### Local Development
- `npm run dev` — starts both client (dev server) and server concurrently
- Hot reload for client, nodemon for server

### Build & Deploy
- Client: bundled (Vite or similar) to static files
- Server: compiled TypeScript, runs on Node.js
- Railway deployment: single service serving both static client and WebSocket server

---

## 10. Change Log

- 2026-04-01: Full rewrite — web-based architecture with TypeScript, Phaser 3, Socket.IO, Node.js. Relay networking model. All systems defined from design interview.
