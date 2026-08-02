# mobile-presentation Specification

## Purpose

Browser-level settings for a fullscreen, gesture-free mobile play surface: orientation lock, fullscreen-on-tap prompt, and touch-action suppression.

## Requirements

### Requirement: index.html MUST set touch-action: none

The HTML document MUST apply `touch-action: none` to the canvas element or its container to prevent browser default gestures (scroll, zoom, pull-to-refresh).

#### Scenario: Touch on canvas does not scroll the page

- GIVEN the game is loaded on a phone browser
- WHEN the player touches and drags on the canvas
- THEN the page does not scroll or zoom
- AND the touch events reach the Phaser input system

### Requirement: First touch MUST request fullscreen

The game MUST call `this.scale.startFullscreen()` on the first `pointerup` event that has `pointer.wasTouch === true`.

#### Scenario: First tap triggers fullscreen

- GIVEN the game is loaded on a phone browser not in fullscreen
- WHEN the player taps the screen
- THEN the browser requests fullscreen
- AND the game enters fullscreen mode

### Requirement: Orientation MUST lock to landscape

The game MUST call `this.scale.lockOrientation('landscape')` on boot. On browsers that do not support orientation lock, a rotate-device overlay MUST be shown when `this.scale.isPortrait` is true.

#### Scenario: Device in portrait shows rotate overlay

- GIVEN the device is held in portrait orientation
- WHEN the game detects `isPortrait === true`
- THEN a "Please rotate your device" overlay is displayed
- AND the game canvas is hidden behind the overlay

#### Scenario: Device rotated to landscape hides overlay

- GIVEN the rotate-device overlay is visible
- WHEN the device rotates to landscape
- THEN the overlay is hidden
- AND the game becomes interactive

### Requirement: FULLSCREEN_FAILED MUST be handled gracefully

The game MUST listen for `Phaser.Scale.Events.FULLSCREEN_FAILED` and continue playing without fullscreen rather than crashing or showing an error.

#### Scenario: Fullscreen denied on iOS Safari

- GIVEN the user is on iOS Safari
- WHEN the fullscreen request fails
- THEN the game continues in the viewport without fullscreen
- AND no error dialog is shown to the player
