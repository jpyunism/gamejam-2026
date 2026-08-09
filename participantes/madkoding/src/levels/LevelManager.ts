// ─── Level Manager: progression through 20 levels ────────────────────────────

import { LEVELS, type LevelDefinition } from './LevelData';

export class LevelManager {
  private _currentIndex = 0;
  private _totalLevels: number;

  constructor() {
    this._totalLevels = LEVELS.length;
  }

  get currentIndex(): number { return this._currentIndex; }
  get totalLevels(): number { return this._totalLevels; }
  get currentLevel(): LevelDefinition { return LEVELS[this._currentIndex]; }
  get isLastLevel(): boolean { return this._currentIndex >= this._totalLevels - 1; }

  /** Load a specific level by index. Returns the level definition. */
  loadLevel(index: number): LevelDefinition {
    this._currentIndex = Math.min(index, this._totalLevels - 1);
    return this.currentLevel;
  }

  reset(): void {
    this._currentIndex = 0;
  }
}
