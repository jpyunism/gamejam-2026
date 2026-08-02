# mobile-touch-controls Specification

## Purpose

Touch input system for movement, aim, and fire on mobile devices, with pointer-ID isolation to prevent simultaneous touch conflicts.

## Requirements

### Requirement: Left movement joystick MUST track its captured pointer independently

The system MUST assign the left VirtualJoystick a unique `pointer.id` on first touch and reject all other pointer events on that joystick until the captured pointer lifts.

#### Scenario: Player moves with left joystick

- GIVEN the player touches the left side of the screen
- WHEN the player drags within the left joystick zone
- THEN the player sprite moves in the dragged direction
- AND the joystick thumb follows the touch within its radius

#### Scenario: Second touch does not interfere with left joystick

- GIVEN the left joystick has captured pointer ID 1
- WHEN a second finger (pointer ID 2) touches the left joystick zone
- THEN the joystick ignores pointer ID 2 and continues tracking pointer ID 1

### Requirement: Right aim joystick MUST provide a direction vector

The system MUST expose a normalized direction vector (not `pointer.worldX/worldY`) from the right-side aim joystick, consumed by `Player.ts` for bullet direction.

#### Scenario: Player aims with right joystick

- GIVEN the player touches the right side of the screen
- WHEN the player drags within the right joystick zone
- THEN bullets fire in the direction of the joystick vector
- AND the aim direction is independent of the player's screen position

#### Scenario: Right joystick returns zero vector when idle

- GIVEN no touch is active on the right joystick zone
- WHEN the game reads the aim vector
- THEN the vector is `{ x: 0, y: 0 }`

### Requirement: Fire button MUST emit a fire event on press

The system MUST fire a single bullet per press (not continuous hold) when the fire button is touched.

#### Scenario: Player fires a bullet

- GIVEN the fire button is visible on the right side
- WHEN the player taps the fire button
- THEN one bullet is fired in the current aim direction
- AND holding the button does not fire additional bullets until released and pressed again

### Requirement: Pointer-ID isolation MUST prevent cross-talk

Each control (left joystick, right joystick, fire button) MUST track its own `pointer.id` and ignore events from other pointers.

#### Scenario: All three controls used simultaneously

- GIVEN the player touches left joystick (ID 1), right joystick (ID 2), and fire button (ID 3)
- WHEN all three are held simultaneously
- THEN movement, aim, and fire each respond to their captured pointer only
- AND no control receives events from another control's pointer
