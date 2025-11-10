/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from "node:assert";
import fs from "node:fs";

// TODO fields
// Abstraction function:
//   TODO
// Representation invariant:
//   TODO
// Safety from rep exposure:
//   TODO
// TODO constructor
// TODO checkRep
// TODO other methods



/**
 * Represents the state of a single card on the board
 */
class CardState {
    constructor(
        public value: string,
        public faceUp: boolean = false,
        public matched: boolean = false,
        public controller: string | null = null
    ) {}

    public copy(): CardState {
        return new CardState(this.value, this.faceUp, this.matched, this.controller);
    }
}

/**
 * Board ADT for Memory Scramble
 * mutable and concurrency safe.
 */
export class Board {
  private readonly rows: number;
  private readonly cols: number;
  private cards: CardState[][];
  private changeListeners: Array<() => void> = [];
  private readonly locks: Map<string, number> = new Map(); // playerId -> card index

  // **********************
  // Abstraction function:
  // **********************
  // AF(rows, cols, cards) = a game board where:
  //   - The board has dimensions rows × cols
  //   - cards[r][c] represents the state of the card at position (r,c)
  //   - cards[r][c].value is the string value of the card
  //   - cards[r][c].faceUp is true if the card is currently visible
  //   - cards[r][c].matched is true if the card has been permanently removed
  //   - cards[r][c].controller is the player ID controlling the card, or null if free
  //
  // **********************
  // Representation invariant (RI):
  // **********************
  //   - rows > 0 && cols > 0
  //   - cards.length === rows
  //   - ∀r in [0,rows): cards[r].length === cols
  //   - ∀r,c: if cards[r][c].matched is true then cards[r][c].faceUp must be true
  //   - ∀r,c: if cards[r][c].controller ≠ null then cards[r][c].faceUp must be true
  //
  // **********************
  // Safety from rep exposure:
  // **********************
  //   - All fields are private and readonly where possible
  //   - Public methods return defensive copies or immutable data
  //   - Internal card state is protected by async method coordination

  constructor(rows?: number, cols?: number, cardValues?: string[][]) {
    this.rows = rows ?? 0;
    this.cols = cols ?? 0;
    this.cards = [];
    this.changeListeners = [];
    this.locks = new Map();

    if (cardValues && this.rows > 0 && this.cols > 0) {
      for (let r = 0; r < this.rows; r++) {
        const row: CardState[] = [];
        for (let c = 0; c < this.cols; c++) {
          row.push(new CardState(cardValues[r]![c]!));
        }
        this.cards.push(row);
      }
    }

    this.checkRep();
  }

  private checkRep(): void {
    assert(this.rows >= 0, "rows must be non-negative");
    assert(this.cols >= 0, "cols must be non-negative");
    assert(this.cards.length === this.rows, "cards length must match rows");

    for (let r = 0; r < this.rows; r++) {
      assert(
        this.cards[r]!.length === this.cols,
        `row ${r} length must match cols`
      );
      for (let c = 0; c < this.cols; c++) {
        const card = this.cards[r]![c]!;
        if (card.matched) {
          assert(card.faceUp, "matched cards must be face up");
        }
        if (card.controller !== null) {
          assert(card.faceUp, "controlled cards must be face up");
        }
      }
    }
  }

  private notifyChange(): void {
    const listeners = this.changeListeners;
    this.changeListeners = [];
    listeners.forEach((listener) => listener());
  }

  /**
   * Convert card index to string key for locking
   */
  private cardKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  /**
   * Try to acquire lock on a card for a player
   */
  private tryLockCard(playerId: string, row: number, col: number): boolean {
    const key = this.cardKey(row, col);
    if (this.locks.has(key)) {
      return false;
    }
    this.locks.set(key, 1);
    return true;
  }

  /**
   * Release lock on a card
   */
  private unlockCard(row: number, col: number): void {
    const key = this.cardKey(row, col);
    this.locks.delete(key);
  }

  /**
   * Wait until a card becomes available for locking
   */
  private async waitForCard(
    playerId: string,
    row: number,
    col: number
  ): Promise<void> {
    while (!this.tryLockCard(playerId, row, col)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  public getRows(): number {
    return this.rows;
  }

  public getCols(): number {
    return this.cols;
  }

  /**
   * Get a defensive copy of card values
   */
  public getCardValues(): string[][] {
    return this.cards.map((row) => row.map((card) => card.value));
  }

  /**
   * Get the current board state as a string for a player
   */
  /**
   * Get the current board state as a string for a player in the format expected by the UI
   */
  public getBoardState(playerId: string): string {
    const lines: string[] = [];

    // First line: dimensions
    lines.push(`${this.rows}x${this.cols}`);

    // The UI expects a flat list of all cards, one per line
    // Each line should contain: status text
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const card = this.cards[r]![c]!;
        let status: string;
        let text: string = "";

        if (card.matched) {
          // Matched cards show as 'none'
          status = "none";
          text = "";
        } else if (card.faceUp) {
          if (card.controller === playerId) {
            // Card controlled by this player
            status = "my";
            text = card.value;
          } else if (card.controller !== null) {
            // Card controlled by another player
            status = "up";
            text = card.value;
          } else {
            // Face up but not controlled by anyone
            status = "up";
            text = card.value;
          }
        } else {
          // Face down card
          status = "down";
          text = "";
        }

        // Each card gets its own line with status and text
        lines.push(`${status} ${text}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Flip a card for a player
   */
  public async flipCard(
    playerId: string,
    row: number,
    col: number
  ): Promise<void> {
    // Validate coordinates
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error("Invalid card coordinates");
    }

    await this.waitForCard(playerId, row, col);

    try {
      const card = this.cards[row]![col]!;

      // Check if card can be flipped
      if (card.matched) {
        throw new Error("Card is already matched and removed");
      }

      if (card.controller !== null && card.controller !== playerId) {
        throw new Error("Card is controlled by another player");
      }

      if (card.faceUp) {
        // Flip face down - only if player controls it
        if (card.controller === playerId) {
          card.faceUp = false;
          card.controller = null;
          this.notifyChange();
        } else {
          throw new Error("Cannot flip down a card you don't control");
        }
      } else {
        // Flip face up
        card.faceUp = true;
        card.controller = playerId;
        this.notifyChange();
      }

      this.checkRep();
    } finally {
      this.unlockCard(row, col);
    }
  }

  /**
   * Check for matching cards and update state
   */
  public checkMatches(): void {
    const faceUpCards: Array<{ row: number; col: number; value: string }> = [];

    // Find all face-up, unmatched cards
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const card = this.cards[r]![c]!;
        if (card.faceUp && !card.matched && card.controller !== null) {
          faceUpCards.push({ row: r, col: c, value: card.value });
        }
      }
    }

    // Group by value
    const valueGroups = new Map<string, Array<{ row: number; col: number }>>();
    for (const card of faceUpCards) {
      if (!valueGroups.has(card.value)) {
        valueGroups.set(card.value, []);
      }
      valueGroups.get(card.value)!.push({ row: card.row, col: card.col });
    }

    // Mark complete groups as matched
    let changed = false;
    for (const [value, cards] of valueGroups) {
      if (cards.length >= 2) {
        // Found a match - mark all cards with this value as matched
        for (const card of cards) {
          this.cards[card.row]![card.col]!.matched = true;
          this.cards[card.row]![card.col]!.controller = null;
        }
        changed = true;
      }
    }

    if (changed) {
      this.notifyChange();
    }
  }

  /**
   * Apply a function to all cards
   */
  public async mapCards(f: (card: string) => Promise<string>): Promise<void> {
    // Create a copy of current values to ensure consistency
    const oldValues: string[][] = [];
    const cardPositions: Array<[number, number]> = [];

    for (let r = 0; r < this.rows; r++) {
      oldValues.push([]);
      for (let c = 0; c < this.cols; c++) {
        oldValues[r]!.push(this.cards[r]![c]!.value);
        cardPositions.push([r, c]);
      }
    }

    // Apply the function to create new values
    const newValues: string[][] = [];
    for (let r = 0; r < this.rows; r++) {
      newValues.push([]);
      for (let c = 0; c < this.cols; c++) {
        const newValue = await f(oldValues[r]![c]!);
        newValues[r]!.push(newValue);
      }
    }

    // Update all cards atomically
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.cards[r]![c]!.value = newValues[r]![c]!;
      }
    }

    this.notifyChange();
    this.checkRep();
  }

  /**
   * Wait for the board to change
   */
  public async waitForChange(): Promise<void> {
    return new Promise((resolve) => {
      this.changeListeners.push(resolve);
    });
  }

  /**
   * Make a new board by parsing a file.
   */
  public static async parseFromFile(filename: string): Promise<Board> {
    const data = await fs.promises.readFile(filename, { encoding: "utf8" });
    const lines = data
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 1) throw new Error("invalid board file: no lines");

    const dimMatch = lines[0]!.match(/^(\d+)x(\d+)$/);
    if (!dimMatch) throw new Error("invalid board dimension line");
    const rows = parseInt(dimMatch[1]!, 10);
    const cols = parseInt(dimMatch[2]!, 10);

    const cardsFlat = lines.slice(1);
    if (cardsFlat.length !== rows * cols) {
      throw new Error("number of card lines does not match rows*cols");
    }

    const cards: string[][] = [];
    for (let r = 0; r < rows; r++) {
      cards.push(cardsFlat.slice(r * cols, r * cols + cols));
    }

    return new Board(rows, cols, cards);
  }

  public toString(): string {
    return this.getBoardState("observer");
  }
}
