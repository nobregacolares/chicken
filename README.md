# 🐔 Cacarejo Aim Lab

A CS-style aim trainer, but with chickens. Modes: Normal, Strafe and Precision.

Play: https://nobregacolares.github.io/chicken/

## Global ranking (no server)
The scoreboard lives in `data/scores.json`, inside this repository.

1. At the end of a match the player clicks **Submit to global ranking**, which opens a pre-filled GitHub issue (a GitHub account is needed).
2. The `.github/workflows/score.yml` Action runs `.github/scripts/score.js`, checks the result is possible, updates the JSON and closes the issue.
3. The game reads the JSON straight from the repository. There are 3 lists per mode: **Eggs**, **Accuracy** and **Average reaction**. Accuracy and reaction only count with 15+ hits in the match, so 1 hit out of 1 shot does not become 100%.

The displayed name is the typed nick; the `@user` comes from the issue itself, so nobody can impersonate someone else.

Honest limit: the game runs in the browser, so the ranking is trust-based. The bot only blocks what is impossible (too many hits, eggs that do not match hits and headshots, reaction under 150 ms).

## License
All rights reserved. See `LICENSE`.
