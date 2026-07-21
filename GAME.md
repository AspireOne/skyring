# ✈️ SkyRing — Game Design Bible

> A 1v1 online aerial king-of-the-hill where you don't kill your opponent — you **bonk them out of the way**. Everything is springy. Nothing dies. Points win.

This document is the source of truth for what the game _is_. It is intentionally non-technical. If the finished game and this document disagree, one of them is wrong — and it's probably the game.

---

## 1. The One-Sentence Pitch

Two planes, one glowing ring in the sky, three to five minutes on the clock: score points by being **alone inside the ring**, and use your gun to **knock the other player out of it** — because your shots don't destroy, they _shove_.

---

## 2. Core Fantasy & Tone

- **Arcade and bouncy.** This is a silly-fun toy, not a war sim. Hits send planes tumbling in exaggerated, cartoonish spins. The world feels like a pinball table in the sky.
- **No death, ever.** There is no health, no destruction, no respawning, no waiting. You are never removed from the action. The worst that happens to you is being flung across the map and having to fight your way back.
- **Everything is springy.** The same rule governs everything: hits bounce, the arena walls bounce, collisions bounce. Consistency is the tone.
- **Readable at a glance.** A spectator (or the players) should always understand who's winning and why, from the score and the position of the ring.

---

## 3. Match Structure

- **Players:** exactly 2, connected online.
- **Match length:** a single timed round of **4 minutes** (design target; tunable in the 3-5 minute range).
- **Goal:** have **more points than your opponent** when the clock hits zero.
- **No lives, no rounds, no elimination.** One continuous bout. The clock is the only thing that ends it.
- **Always-visible state:** both players' scores and the match timer are on screen at all times.

---

## 4. The Capture Ring (the heart of the game)

A single glowing ring/zone floats somewhere in the arena. It is the only place points come from.

- **Scoring:** while you are inside the ring and your opponent is **not**, you accrue points steadily (e.g. ~1 point per second — tunable). Continuous, not chunky.
- **Dwell then teleport:** the ring stays in one location for a **dwell period (~20-25 seconds)**, then **instantly teleports** to a new location elsewhere in the arena. It does not drift. Each relocation is a fresh "race to the new ring" moment.
- **Telegraphed relocation:** the ring gives a **clear warning** (visual + audio cue, e.g. a few seconds of pulsing/countdown) before it teleports, so the move is a strategic beat both players can react to — not a random rug-pull. The _next_ location is revealed at the moment of warning so both players can start committing to the flight path.
- **Generous but not huge:** the ring is big enough that two planes can both be inside it (that's the whole point of the contest rule below), but small enough that a good knockback can clear someone out of it.

### 4.1 The Contest Rule (both planes inside at once) — **Tug-of-War**

When both planes are inside the ring simultaneously, it is **not** a dead freeze. Instead:

- **Whoever is closer to the ring's exact center scores; the other player scores nothing.**
- This turns a shared ring into a **micro-positioning duel**: you fight to hug the center while shoving your rival toward the edge (and ideally out).
- If the two planes are essentially tied for center distance (within a small threshold), **neither** scores for that instant — a genuine standoff earns nobody anything, discouraging pure mutual camping.

This rule means being in the ring is never "safe." Even alone, the opponent can dive in, out-center you, and flip the scoring — or knock you off center entirely.

---

## 5. The Gun = Knockback, Not Damage

Your weapon is the game's signature twist. It **never damages or destroys**. It applies force.

- **On a hit:** the struck plane receives a **strong directional shove** along the shot's line of travel. A clean hit can genuinely throw someone out of the ring or send them tumbling across the sky.
- **Stumble window:** on top of the shove, the hit plane briefly **loses control** — a short (~0.5s) stall/spin the victim must actively recover from. This is the real punishment. A pure push with instant recovery would barely matter; the stumble is what buys the shooter a few uncontested seconds in the ring.
- **Recoil on the shooter:** firing shoves **you** backward a little too. Blasting your rival away as you both close on the ring is a real trade — you'll drift off your own line in the process. No free shots.
- **Limited, regenerating ammo/energy:** you can't hold the trigger forever. Shots draw from a small pool that **refills slowly on its own**. This stops the gun from becoming a zone-denial turret — it's a well-timed tool, not a wall of bullets.
- **No consequences beyond force.** There is no bleed, no lingering damage, no kill credit. The entire consequence of being shot is: _you got moved, and you fumbled for half a second._

---

## 6. The Arena

- **A bounded 3D volume of open sky** (with a ground/horizon for orientation and a sense of up/down).
- **Bouncy boundaries:** the arena is enclosed by an **invisible dome**. Fly into it and you **ricochet off** — you are never hard-stopped, clamped, or teleported back. The edges obey the same springy rule as everything else, so knocking someone into a wall can bounce them back into play in unexpected ways.
- **Open middle:** no obstacles are required for the core game. (Optional later: a few large soft/bouncy obstacles to bank around — but the base game is clean open sky so the ring and the two planes are always the focus.)
- **Size:** large enough that the ring's teleport genuinely repositions the fight, small enough that you're never more than a few seconds of flight from the action.

---

## 7. Flight Feel

- **Arcade flight, not a simulator.** Easy to pick up: steer, throttle, fire. Forgiving handling — the challenge is the duel and the positioning, not fighting your own aircraft.
- **Momentum matters.** Planes carry speed and can't stop on a dime; this is what makes knockback meaningful and recovery a skill.
- **The stumble is the only "bad" state.** Otherwise you are always in full control.

---

## 8. Win / Lose / Tie

- **Win:** more points than the opponent when the timer reaches zero.
- **Lose:** fewer points at zero.
- **Tie → Sudden Death:** if the score is level when the clock hits zero, the match goes to **overtime**. The ring relocates (and may shrink slightly to sharpen the fight), and the **next player to score a point wins instantly.** First point ends it.

---

## 9. Edge Cases & Rulings

These exist so the game behaves predictably in weird moments.

- **Both players outside the ring:** nobody scores. Normal state between engagements.
- **Ring teleports while a player is inside it:** scoring simply stops at the old location and resumes wherever players stand relative to the new one. No points are awarded for "being where the ring used to be." The warning (§4.1) is what gives players a fair chance to follow it.
- **A player is knocked out of the ring mid-scoring:** scoring for them stops the instant they cross the ring boundary. Being shoved out is a legitimate way to deny points — that's the design intent.
- **A player is knocked _into_ the ring by a shot:** they count as inside the moment they cross in, stumble or not. Getting bonked into the scoring zone is a funny, valid outcome.
- **Both inside, dead-even on center distance:** neither scores until someone gains the center (see §4.1).
- **Shooting while stumbling:** a stumbling plane cannot fire until it recovers control. You can't shoot your way out of a fumble.
- **Out of ammo:** you simply can't fire until energy regenerates. You are never defenseless in the sense of dying — you just can't shove for a moment, so you rely on flying.
- **Simultaneous mutual hits:** both planes get shoved and both stumble. Perfectly legal and encouraged chaos.
- **Ricochet into the ring / off a wall into the opponent:** all bounces are "real." Emergent bank-shots and lucky caroms are a feature, not a bug — they fit the springy tone.
- **Stalling in the ring doing nothing while contested:** the tug-of-war rule (§4.1) means a passive plane loses the center to an active one, so camping is not a stable strategy.
- **Disconnection:** if a player drops, the match cannot be a real 1v1 — the remaining player is informed and the match ends (no-contest or awarded; final ruling to be decided at implementation, but the match does **not** silently continue against a frozen ghost).

---

## 10. What the Server Owns (light technical note)

Kept deliberately minimal and high-level: because nothing dies, the only things that need to be authoritative and agreed-upon are **continuous values** — where each plane is, how fast it's moving, which way it faces, how much ammo it has, who is inside the ring, and who is closer to center. A hit is just "add a shove to a velocity," which stays smooth even over an imperfect connection. There is no "prove a kill happened at an exact instant" problem to solve. This is a deliberate design choice that makes fair online play far easier than a traditional shooter. _(Anything beyond this — how messages are structured, tick rates, prediction — is out of scope for this document.)_

---

## 11. Presentation

- **Real plane models.** Use actual 3D aircraft models sourced from the internet (free/licensed model libraries), not primitive placeholder shapes — the planes should look like planes. Two visually distinct aircraft so players never confuse themselves with their opponent.
- **The ring is the star.** It should glow, pulse, and clearly telegraph its state (scoring for me / scoring for them / contested / about to teleport).
- **Juicy feedback.** Hits, shoves, stumbles, ricochets, and ring captures all deserve exaggerated, satisfying visual and audio punch — this sells the arcade-bouncy tone.
- **Clarity over realism.** Whenever "looks cool" fights "reads clearly," clarity wins.

---

## 12. Explicitly Out of Scope (for now)

To keep the core tight, these are **not** part of the initial concept (candidates for later):

- More than 2 players.
- Multiple simultaneous rings.
- Obstacles/terrain in the arena.
- Power-ups, alternate weapons, plane customization.
- Persistent progression, ranking, matchmaking beyond a single lobby.

---

## 13. The Feel We're Chasing (north star)

A 4-minute SkyRing match should be a **rhythm**: short bursts of solo scoring, punctuated by springy knockback duels over the ring, punctuated by mad dashes to each new ring location — with **zero dead time**, no waiting to respawn, and a score that's always climbing for _someone_. It should be as fun to lose as to win, because getting bonked across the sky is genuinely funny. If a playtester laughs out loud the first time they knock the other plane clean out of the ring, the design is working.
