# responsive-layout Specification

## Purpose

Dynamic scale and resize handling so HUD, menus, and overlays reposition and rescale when the canvas resizes, supporting both desktop 1280x960 and phone 375x667 landscape.

## Requirements

### Requirement: GameConfig MUST use Phaser.Scale.RESIZE

The game MUST configure `scale.mode: Phaser.Scale.RESIZE` with `width: '100%'` and `height: '100%'` so the canvas fills the viewport without letterboxing.

#### Scenario: Game loads on a phone

- GIVEN the game loads on a 375x667 viewport
- WHEN the game boots
- THEN the canvas fills the full viewport width and height
- AND no letterboxing bars are visible

#### Scenario: Game loads on desktop

- GIVEN the game loads on a 1280x960 viewport
- WHEN the game boots
- THEN the canvas is 1280x960 pixels
- AND the game is fully playable with keyboard and mouse

### Requirement: HUD elements MUST reposition on scale.resize event

All HUD, menu, and overlay scenes MUST subscribe to `this.scale.on('resize', ...)` and recompute positions relative to `this.scale.width` and `this.scale.height`.

#### Scenario: Phone landscape resize

- GIVEN the game is running on a phone in landscape (667x375)
- WHEN the scale emits a resize event
- THEN HUD elements are positioned relative to the new dimensions
- AND all elements are fully visible without overlap

#### Scenario: Window resize mid-game

- GIVEN the game is running on desktop
- WHEN the user resizes the browser window
- THEN HUD elements reposition within 1 frame of the resize event
- AND the game remains playable without visual glitches

### Requirement: Font sizes MUST scale proportionally from baseline constants

The system MUST compute a scale factor from `this.scale.width / 1280` and apply it to baseline font sizes (e.g., HUD 14px baseline, title 44px baseline).

#### Scenario: Phone landscape font rendering

- GIVEN the game is running on a 667x375 phone
- WHEN the HUD renders
- THEN font sizes are scaled by `667 / 1280 ≈ 0.52` from baseline constants
- AND all text is readable without overflow
