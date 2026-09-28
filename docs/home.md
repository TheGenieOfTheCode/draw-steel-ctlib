# Draw Steel: CTLib

CTLib is a library module for Foundry VTT's Draw Steel system: the shared code the Combat Tools family of modules is built on, open for any module to use.

It does nothing on its own. A module that depends on it gets canvas pickers, line of effect and cover checks, writes that work for players who don't own the document, a settings window base, a shared hook into the Target Damage panel, and a handful of Draw Steel helpers, without carrying its own copy of any of it.

**Requires Foundry v14, the Draw Steel system, and [socketlib](https://foundryvtt.com/packages/socketlib).**

## Where to start

- [Using CTLib](Using-CTLib): declaring the dependency, and the two ways to reach the library from your code.
- [Config and Services](Config-and-Services): how modules share settings and functions through CTLib without importing each other.

## What it offers

| Area | Page |
|---|---|
| Writes a player can make on documents they don't own | [Permission-Safe Writes](Permission-Safe-Writes) |
| The picker bar, dimmed canvas and target marks | [Pickers](Pickers) |
| Line of effect, cover, concealment and burrowing | [Line of Effect and Cover](Line-of-Effect-and-Cover) |
| Grid maths, footprints, walls and doors | [Grid and Walls](Grid-and-Walls) |
| Wall materials and tags | [Materials and Tags](Materials-and-Tags) |
| Squads, Stamina, abilities, power rolls, monster filters | [Draw Steel Helpers](Draw-Steel-Helpers) |
| A settings window built from your registered settings | [Settings Window](Settings-Window) |
| Adding to the Target Damage panel alongside other modules | [Target Damage Panel](Target-Damage-Panel) |
| Your own header in the token's status list | [Status Headers](Status-Headers) |
| Theme colours, preview tokens and small utilities | [Utilities](Utilities) |

## Modules that use it

- [Draw Steel: Combat Tools](https://github.com/TheGenieOfTheCode/draw-steel-combat-tools)
- [Draw Steel: Death Tracker](https://github.com/TheGenieOfTheCode/draw-steel-death-tracker)
