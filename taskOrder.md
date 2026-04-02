&#x20;Based on dependencies and the "first playable" goal, here's the full ordering for all 54 tasks:

&#x20;                                                                                                                                                          

&#x20; Admin — Foundation                                                                                                                                       

&#x20; 1. A1 — Root package.json + tsconfig (everything depends on this)                                                                                          2. A2 — Scaffold directories (structure before files)                                                                                                    

&#x20; 3. A11 — .gitignore + env config (before any commits)                                                                                                    

&#x20; 4. A3 — Client build tooling

&#x20; 5. A4 — Server build tooling       

&#x20; 6. A5 — Concurrent dev script (needs A3 + A4)

&#x20; 7. A6 — Shared event types (both sides depend on these)

&#x20; 8. A7 — Shared game state types

&#x20; 9. A8 — Shared constants

&#x20; 10. A9 — Production build script (after dev works)

&#x20; 11. A10 — Railway deployment (last, after build works)



&#x20; Server — Core First

&#x20; 12. S1 — Express + Socket.IO bootstrap

&#x20; 13. S2 — Lobby create/join logic

&#x20; 14. S4 — Player name/color (part of the join flow)

&#x20; 15. S12 — Disconnect handling (catch regressions early)

&#x20; 16. S3 — Shareable lobby URL

&#x20; 17. S5 — Relay player state

&#x20; 18. S6 — Relay shooting

&#x20; 19. S7 — Relay kill/death

&#x20; 20. S8 — Match state management

&#x20; 21. S9 — Victory-to-warmup transition

&#x20; 22. S10 — Relay pickup events

&#x20; 23. S11 — Relay arena destruction



&#x20; Client — Scaffold → Movement → Combat → Systems → Polish

&#x20; 24. C1 — Phaser bootstrap + scene registry

&#x20; 25. C4 — Socket.IO client wrapper (needed by all network calls)

&#x20; 26. C2 — MenuScene: lobby creation UI

&#x20; 27. C3 — MenuScene: join via URL

&#x20; 28. C5 — GameScene: world setup + camera

&#x20; 29. C6 — Local ship rendering

&#x20; 30. C7 — Local ship movement (feel-critical, test early)

&#x20; 31. C9 — Send local player state to server

&#x20; 32. C8 — Remote player rendering + interpolation

&#x20; 33. C10 — Shooting: local bullets

&#x20; 34. C11 — Shooting: remote bullets

&#x20; 35. C12 — Hit detection

&#x20; 36. C13 — Death and respawn flow

&#x20; 37. C24 — Warmup mode behavior

&#x20; 38. C25 — Start Match button (leader only)

&#x20; 39. C26 — Match active mode transition

&#x20; 40. C19 — Ship-to-ship collision (elastic bounce)

&#x20; 41. C14 — Arena wall generation

&#x20; 42. C15 — Arena wall destruction

&#x20; 43. C16 — Void death zone

&#x20; 44. C17 — Ammo pickup spawning + collection

&#x20; 45. C18 — Shield pickup spawning + collection

&#x20; 46. C31 — Lobby player list display

&#x20; 47. C20 — HUD: kill count

&#x20; 48. C21 — HUD: ammo display

&#x20; 49. C22 — HUD: shield indicator

&#x20; 50. C23 — Kill screen flash

&#x20; 51. C27 — VictoryScene scoreboard

&#x20; 52. C28 — Victory-to-warmup auto-transition

&#x20; 53. C29 — Mobile touch detection

&#x20; 54. C30 — Mobile touch controls



&#x20; The milestone after task 36 (C13) is first playable — two players can connect, move, shoot, and die. Everything after that is layered systems and polish

