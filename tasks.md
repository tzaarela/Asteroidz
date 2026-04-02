Asteroidz — Kanban Task Breakdown                                                                                                                                                                                                                                         
     Context                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                            
     The project has full planning/architecture docs but zero code. These tasks break the entire prototype scope into small, actionable kanban cards across three categories. Tasks are ordered roughly by dependency (top = do first).

     ---
     ADMIN (Project Setup, Tooling, Shared Code, Deployment)

     ┌─────┬──────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
     │  #  │                       Task                       │                                                                     Description                                                                      │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A1  │ Initialize monorepo with package.json + tsconfig │ Root package.json with workspaces for client/server/shared. Base tsconfig.json with strict mode and project references.                              │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A2  │ Scaffold directory structure                     │ Create all directories from architecture.md: client/src/scenes/, systems/, network/, ui/, types/, server/src/lobby/, relay/, types/, shared/types/.  │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A3  │ Configure client build tooling (Vite + Phaser)   │ Set up Vite as client bundler with TS support. Create client/index.html and client/tsconfig.json. Verify Phaser loads in dev mode.                   │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A4  │ Configure server build tooling (ts-node/nodemon) │ Set up server/tsconfig.json, configure nodemon for auto-restart. Add Express + Socket.IO dependencies.                                               │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A5  │ Create npm run dev concurrent script             │ Root-level dev command that starts Vite (client) and nodemon (server) concurrently.                                                                  │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A6  │ Define shared Socket.IO event types              │ Create shared/types/events.ts with typed interfaces for all Socket.IO events: lobby, player, pickup, arena, match events.                            │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A7  │ Define shared game state types                   │ Create shared/types/game.ts with interfaces for Player, Bullet, Pickup, ArenaChunk, LobbyState, MatchState, and enums for MatchPhase and PickupType. │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A8  │ Create shared constants file                     │ Create shared/constants.ts with all tunable gameplay values: physics, bullet, ammo, respawn, pickup, arena, network tick rate.                       │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A9  │ Configure production build script                │ npm run build that compiles server TS and bundles client via Vite. Server serves static client files in production.                                  │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A10 │ Set up Railway deployment                        │ Create deployment config (Procfile/railway.toml). Server serves Vite-built client as static files. Respect PORT env var.                             │
     ├─────┼──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ A11 │ Add .gitignore and env config                    │ .gitignore for node_modules/dist/build artifacts. .env.example with PORT and any other config.                                                       │
     └─────┴──────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

     ---
     SERVER (Express, Socket.IO, Lobby, Relay, Match State)

     ┌─────┬─────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
     │  #  │                  Task                   │                                                                     Description                                                                      │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S1  │ Express + Socket.IO server bootstrap    │ Create server/src/index.ts with Express serving static files, Socket.IO attached, configurable port. Verify WebSocket connection works.              │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S2  │ Lobby creation and join logic           │ Handle lobby:create (generate code, assign leader), lobby:join (validate + add player), lobby:leave (remove + reassign leader). In-memory lobby map. │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S3  │ Shareable lobby URL routing             │ Express route for /game/:lobbyCode that serves the client. Pass lobby code so client auto-joins on load.                                             │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S4  │ Player name and color assignment        │ On join, accept player name and auto-assign a distinct color from a palette. Broadcast updated player list to lobby.                                 │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S5  │ Relay player state updates              │ On player:update, broadcast sender's position/rotation/velocity to all other players in the same lobby.                                              │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S6  │ Relay shooting events                   │ On player:shoot, broadcast bullet spawn data (position, direction, owner) to all other lobby players.                                                │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S7  │ Relay kill and death events             │ On player:hit, relay kill to all clients. On player:died/player:respawn, broadcast to lobby.                                                         │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S8  │ Match state management                  │ Track match phase per lobby. On lobby:start from leader, transition warmup -> active. Track kills server-side. Declare winner at 5 kills.            │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S9  │ Victory-to-warmup transition            │ After victory phase (5-10s timer), broadcast match reset. Clear scores, return to warmup phase.                                                      │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S10 │ Relay pickup events                     │ On pickup:spawn/pickup:collected, relay to all lobby clients. Trust lobby leader as pickup authority.                                                │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S11 │ Relay arena destruction events          │ On arena:destroy, relay destroyed chunk ID to all other clients in the lobby.                                                                        │
     ├─────┼─────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ S12 │ Handle disconnections and lobby cleanup │ On disconnect: remove player, broadcast updated list, reassign leader if needed, delete empty lobbies.                                               │
     └─────┴─────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

     ---
     CLIENT (Phaser Scenes, Gameplay Systems, UI, Networking)

     ┌─────┬─────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
     │  #  │                  Task                   │                                                         Description                                                         │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C1  │ Phaser game bootstrap + scene registry  │ Create client/src/main.ts — init Phaser with Arcade Physics, register MenuScene/GameScene/VictoryScene, start on MenuScene. │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C2  │ MenuScene: lobby creation UI            │ "Create Lobby" button + name input field. On create, emit lobby:create and transition to GameScene.                         │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C3  │ MenuScene: join lobby via URL           │ Detect lobby code from URL path /game/:code. If present, show name input only and auto-join on submit.                      │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C4  │ Socket.IO client wrapper                │ Create client/src/network/socket.ts — typed emit/on methods matching shared event types, connect/disconnect/error handling. │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C5  │ GameScene: world setup + camera         │ Dark background, world bounds from constants, camera follows local player.                                                  │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C6  │ Local ship rendering                    │ Geometric ship sprite (triangle/polygon) using Phaser graphics with auto-assigned player color.                             │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C7  │ Local ship movement (drift/inertia)     │ W = thrust in facing direction, A/D = rotate, velocity drag + max speed cap. Uses shared constants. Feel-critical system.   │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C8  │ Remote player rendering + interpolation │ Render remote ships from player:update events. Lerp between states for smooth movement at ~20 updates/sec.                  │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C9  │ Send local player state to server       │ At fixed tick rate (~20/s), emit player:update with position, rotation, velocity.                                           │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C10 │ Shooting: local bullets                 │ Space = fire bullet in facing direction (if ammo > 0). Decrement ammo. Despawn on max distance. Emit player:shoot.          │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C11 │ Shooting: remote bullets                │ On player:shoot from others, spawn and render their bullets with same trajectory logic.                                     │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C12 │ Hit detection (shooter-side)            │ Arcade Physics overlap: local bullets vs remote ships. On hit, emit player:hit with victim ID. Destroy bullet.              │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C13 │ Death and respawn flow                  │ On death: disable controls, hide ship, wait 2-3s, respawn at random safe location. Emit player:respawn.                     │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C14 │ Arena wall generation (polygon chunks)  │ Generate arena boundary as ring of irregular polygon chunks. Each chunk = collidable body with unique ID for sync.          │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C15 │ Arena wall destruction                  │ Bullet hits chunk -> destroy permanently, emit arena:destroy. On receiving event, remove chunk locally.                     │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C16 │ Void death zone beyond arena            │ Detect ship crossing into void space beyond walls. Trigger death (suicide, no kill credit).                                 │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C17 │ Ammo pickup spawning + collection       │ Leader spawns ammo pickups on timer, emits pickup:spawn. On local player overlap, refill ammo, emit pickup:collected.       │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C18 │ Shield pickup spawning + collection     │ Same as ammo but grants one-hit shield. Visual indicator on ship. Consume shield on hit instead of dying.                   │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C19 │ Ship-to-ship collision (elastic bounce) │ Arcade Physics collision between all ships. Elastic bounce response, no damage.                                             │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C20 │ HUD: kill count display                 │ On-screen kill count for local player. Updates on kill events during active match.                                          │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C21 │ HUD: ammo display near ship             │ Ammo count as dots/number near local player ship. Updates on shoot and pickup.                                              │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C22 │ HUD: shield indicator                   │ Visual ring/glow on ship when shield is active.                                                                             │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C23 │ Kill screen flash effect                │ Brief screen flash (white/colored overlay) on scoring a kill.                                                               │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C24 │ Warmup mode behavior                    │ During warmup: infinite respawns, kills don't count, "Warmup" indicator on screen.                                          │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C25 │ Start Match button (leader only)        │ In warmup, if local player is leader, show "Start Match" button. On press, emit lobby:start.                                │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C26 │ Match active mode transition            │ On match:state = active: clear warmup indicators, reset kills to 0, begin tracking toward 5-kill target.                    │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C27 │ VictoryScene: scoreboard overlay        │ On victory, show overlay with all players' names, colors, kill counts. Highlight winner.                                    │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C28 │ Victory-to-warmup auto-transition       │ On match reset from server, dismiss victory overlay, return to warmup. Reset arena, pickups, ammo, shields.                 │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C29 │ Mobile touch detection                  │ Detect touch support on load. Enable touch overlay for touch devices, keyboard-only otherwise.                              │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C30 │ Mobile touch control layout             │ Semi-transparent button overlays: left = Rotate L/R, right = Thrust + Shoot. Wire to same input actions as keyboard.        │
     ├─────┼─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ C31 │ Lobby player list display               │ Show connected player names + colors in game UI. Update on join/leave.                                                      │
     └─────┴─────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

     ---
     Summary

     ┌──────────┬────────────┐
     │ Category │ Task Count │
     ├──────────┼────────────┤
     │ Admin    │ 11         │
     ├──────────┼────────────┤
     │ Server   │ 12         │
     ├──────────┼────────────┤
     │ Client   │ 31         │
     ├──────────┼────────────┤
     │ Total    │ 54         │
     └──────────┴────────────┘

     Suggested priority order for first playable:

     1. Admin: A1, A2, A3, A4, A5, A11, A6, A7, A8
     2. Server: S1, S2, S3, S4, S5, S6, S7, S12
     3. Client: C1, C4, C2, C3, C5, C6, C7, C9, C8, C10, C11, C12, C13
     4. Then layer in: arena, pickups, match flow, HUD, mobile, deployment

● The plan is approved. Ready to start implementing — where would you like to begin? The suggested path is Admin setup first (A1-A5, A11) to get the monorepo and dev tooling running, then shared types (A6-A8), then server bootstrap, then client.