/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from "node:assert";
import fs from "node:fs";

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
    return new CardState(
      this.value,
      this.faceUp,
      this.matched,
      this.controller
    );
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
  private changeListeners: Array<() => void> = []; // array of functions called when the board's state changes
  private readonly locks: Map<string, number> = new Map(); // playerId -> card index
  private playerStates: Map<
    string,
    {
      firstCard: { row: number; col: number } | null;
      secondCard: { row: number; col: number } | null;
      matched: boolean;
    }
  > = new Map();

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
  // - rows and cols are positive
  // - cards has exactly 'rows' rows
  // - each row in cards has exactly 'cols' columns
  // - if a card is matched, it must be face up
  // - if a card has a controller, it must be face up

  //
  // **********************
  // Safety from rep exposure:
  // **********************
  //   - All fields are private and readonly where possible
  //   - Public methods return defensive copies or immutable data
  //   - Internal card state is protected by async method coordination

  constructor(rows?: number, cols?: number, cardValues?: string[][]) {
    // Validate dimensions first
    if (rows === undefined || cols === undefined || rows <= 0 || cols <= 0) {
      throw new Error("Invalid dimensions");
    }

    this.rows = rows;
    this.cols = cols;
    this.cards = [];
    this.changeListeners = [];
    this.locks = new Map();
    this.playerStates = new Map();

    if (cardValues) {
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

  public checkRep(): void {
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
        // if a card is matched, it must be face up
        if (card.controller !== null) {
          assert(card.faceUp, "controlled cards must be face up");
        }
        // if a card has a controller, it must be face up
        if (card.matched) {
          assert(
            card.controller === null,
            "matched cards should not have controllers"
          );
        }
      }
    }
  }

  /**
   * Function called whenever the board's state changes
   */
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
      // Card is currently controlled by another player, yield control
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Defensive: ensure card exists
    const card = this.cards[row]?.[col];
    if (!card || card.matched || card.value === null) {
      this.unlockCard(row, col);
      throw new Error(`no card at (${row},${col})`);
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
  public look(playerId: string): string {
    const lines: string[] = [];

    // First line: dimensions
    lines.push(`${this.rows}x${this.cols}`);

    // Each line should contain: status text
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const card = this.cards[r]![c]!;
        let status: string;
        let text: string = "";

        if (card.matched || card.value === null) {
          // Matched cards or empty spaces show as 'none'
          status = "none";
          text = "";
        } else if (card.faceUp) {
          if (card.controller === playerId) {
            // Card controlled by this player
            status = "my";
            text = card.value;
          } else {
            // Face up but controlled by another player or no one
            status = "up";
            text = card.value;
          }
        } else {
          // Face down card
          status = "down";
          text = "";
        }

        // Each card gets its own line with status and text
        lines.push(status + (text ? ` ${text}` : ""));
      }
    }

    return lines.join("\n");
  }

  /**
   * Flip a card for a player
   */
  public async flip(playerId: string, row: number, col: number): Promise<void> {
    // Validate coordinates
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error("Invalid card coordinates");
    }

    // Get or create player state
    if (!this.playerStates.has(playerId)) {
      this.playerStates.set(playerId, {
        firstCard: null,
        secondCard: null,
        matched: false,
      });
    }

    const playerState = this.playerStates.get(playerId)!;

    await this.waitForCard(playerId, row, col);

    try {
      const card = this.cards[row]![col]!;

      // Case 1-A: No card in this spot
      if (card.matched || card.value === null) {
        throw new Error(`no card at (${row},${col})`);
      }

      // Determine if this is first or second card
      const isFirstCard =
        playerState.firstCard === null || playerState.secondCard !== null;

      // Case 3: Before flipping a new first card, finish previous turn
      if (isFirstCard) {
        await this.finishPreviousPlay(playerId, playerState);
      }

      if (isFirstCard) {
        await this.flipFirstCard(playerId, playerState, row, col, card);
      } else {
        await this.flipSecondCard(playerId, playerState, row, col, card);
      }

      this.checkRep();
    } finally {
      this.unlockCard(row, col);
    }
  }

  /**
   * Case 3: Finish previous turn before starting a new first card
   */
  private async finishPreviousPlay(
    playerId: string,
    playerState: {
      firstCard: { row: number; col: number } | null;
      secondCard: { row: number; col: number } | null;
      matched: boolean;
    }
  ): Promise<void> {
    if (playerState.secondCard === null) {
      return; // No previous turn to finish
    }

    const first = playerState.firstCard;
    const second = playerState.secondCard;

    if (playerState.matched) {
      // Case 3-A: Remove matched cards
      if (first !== null) {
        this.removeCard(first.row, first.col, playerId);
      }
      if (second !== null) {
        this.removeCard(second.row, second.col, playerId);
      }
    } else {
      // Case 3-B: Turn non-matching cards face down if not controlled
      if (first !== null) {
        this.turnDownIfNotControlled(first.row, first.col, playerId);
      }
      if (second !== null) {
        this.turnDownIfNotControlled(second.row, second.col, playerId);
      }
    }

    // Reset player state
    playerState.firstCard = null;
    playerState.secondCard = null;
    playerState.matched = false;
  }

  /**
   * Flip a first card (Cases 1-A through 1-D)
   */
  private async flipFirstCard(
    playerId: string,
    playerState: {
      firstCard: { row: number; col: number } | null;
      secondCard: { row: number; col: number } | null;
      matched: boolean;
    },
    row: number,
    col: number,
    card: CardState
  ): Promise<void> {
    // Case 1-D: Card is held by another player – wait
    while (card.controller !== null && card.controller !== playerId) {
      this.unlockCard(row, col);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await this.waitForCard(playerId, row, col);
      // After waiting, check again (card might have been removed)
      if (card.matched || card.value === null) {
        throw new Error(`no card at (${row},${col})`);
      }
    }

    // Case 1-B and 1-C: Take control of this card
    card.faceUp = true;
    card.controller = playerId;
    playerState.firstCard = { row, col };

    this.notifyChange();
  }

  /**
   * Flip a second card (Cases 2-A through 2-D)
   */
  private async flipSecondCard(
    playerId: string,
    playerState: {
      firstCard: { row: number; col: number } | null;
      secondCard: { row: number; col: number } | null;
      matched: boolean;
    },
    row: number,
    col: number,
    card: CardState
  ): Promise<void> {
    const first = playerState.firstCard;
    if (first === null) {
      throw new Error("No first card selected");
    }

    const firstCard = this.cards[first.row]![first.col]!;

    // Case 2-A: No card in this spot
    if (card.matched || card.value === null) {
      // Release control of first card (Rule 2-A)
      firstCard.controller = null;

      // Reset player state
      playerState.firstCard = null;
      playerState.secondCard = null;
      playerState.matched = false;

      throw new Error(`no card at (${row},${col})`);
    }

    // Case 2-B: Card already controlled by another player (Rule 2-B)
    if (card.controller !== null && card.controller !== playerId) {
      // Release control of first card
      firstCard.controller = null;

      // Reset player state
      playerState.firstCard = null;
      playerState.secondCard = null;
      playerState.matched = false;

      throw new Error(
        `card at (${row},${col}) is controlled by another player`
      );
    }

    // Cases 2-C, 2-D, 2-E: Valid second card flip
    // Turn face up if needed (Rule 2-C)
    if (!card.faceUp) {
      card.faceUp = true;
    }

    this.notifyChange();

    // Check for match (Rule 2-D vs 2-E)
    if (firstCard.value === card.value) {
      // Match found - keep control of both cards (Rule 2-D)
      card.controller = playerId;
      playerState.secondCard = { row, col };
      playerState.matched = true;
    } else {
      // No match - release both cards (Rule 2-E)
      firstCard.controller = null;
      card.controller = null;
      playerState.secondCard = { row, col };
      playerState.matched = false;
    }
  }

  /**
   * Remove a card from the board
   */
  private removeCard(row: number, col: number, playerId: string): void {
    const card = this.cards[row]![col]!;

    card.matched = true;
    card.faceUp = false;
    card.controller = null;

    this.notifyChange();
  }

  /**
   * Turn a card face down if it's not controlled by anyone
   */
  private turnDownIfNotControlled(
    row: number,
    col: number,
    expectedController: string
  ): void {
    const card = this.cards[row]![col]!;

    // Only turn down if: card exists, is face up, and no player controls it
    if (
      !card.matched &&
      card.value !== null &&
      card.faceUp &&
      card.controller === null
    ) {
      card.faceUp = false;
      this.notifyChange();
    }
  }

  /**
   * Apply a function to all cards
   */
  public async map(f: (card: string) => Promise<string>): Promise<void> {
    // Group cards by their current value for pairwise consistency
    const cardPositions = new Map<
      string,
      Array<{ row: number; col: number }>
    >();

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const card = this.cards[r]![c]!;
        if (!card.matched && card.value !== null) {
          const positions = cardPositions.get(card.value);
          if (positions === undefined) {
            cardPositions.set(card.value, [{ row: r, col: c }]);
          } else {
            positions.push({ row: r, col: c });
          }
        }
      }
    }

    // Transform each unique card value and apply to all its positions atomically
    for (const [oldValue, positions] of cardPositions) {
      const newValue = await f(oldValue);

      // Atomically update all positions with this card value
      for (const { row, col } of positions) {
        const card = this.cards[row]![col]!;
        // Only update if the card still has the old value
        if (card.value === oldValue) {
          card.value = newValue;
        }
      }

      if (oldValue !== newValue) {
        this.notifyChange();
      }
    }

    this.checkRep();
  }

  /**
   * Wait for the board to change
   */
  public watch(): Promise<void> {
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
    return this.look("observer");
  }
}
