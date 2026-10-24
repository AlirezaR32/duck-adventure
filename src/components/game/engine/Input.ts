/**
 * Project Duck — unified input state.
 * Fed by keyboard listeners and touch buttons alike; the game loop only
 * reads edge-triggered (jump / interact) and held (left / right) state.
 */

export type InputName = 'left' | 'right' | 'jump' | 'interact'

export class InputState {
  private held: Record<InputName, boolean> = { left: false, right: false, jump: false, interact: false }
  private pressed: Record<'jump' | 'interact', boolean> = { jump: false, interact: false }

  set(name: InputName, down: boolean): void {
    if (down && !this.held[name] && (name === 'jump' || name === 'interact')) {
      this.pressed[name] = true
    }
    this.held[name] = down
  }

  isDown(name: InputName): boolean {
    return this.held[name]
  }

  /** True once per physical press of the jump button. */
  consumeJump(): boolean {
    if (this.pressed.jump) {
      this.pressed.jump = false
      return true
    }
    return false
  }

  /** True once per physical press of the interact button. */
  consumeInteract(): boolean {
    if (this.pressed.interact) {
      this.pressed.interact = false
      return true
    }
    return false
  }

  /** -1 left, +1 right, 0 idle. */
  dir(): number {
    return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0)
  }

  clearAll(): void {
    this.held = { left: false, right: false, jump: false, interact: false }
    this.pressed = { jump: false, interact: false }
  }
}
