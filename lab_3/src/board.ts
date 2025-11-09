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
 * Board ADT for Memory Scramble
 * mutable and concurrency safe.
 */
export class Board {
  private rows: number;
  private cols: number;
  private cards: string[][];

  // **********************
  // Abstraction function:
  // **********************
  // Abstraction function (AF):
  //   The Board represents a 2D grid of cards. Each cell contains a card value,
  //   and optionally other info like whether the card is face-up.
  //
  // **********************
  // Representation invariant (RI):
  // **********************
  //   - rows >= 0, cols >= 0
  //   - cards.length === rows
  //   - each cards[r].length === cols
  //   This ensures the board is always a proper rectangular grid.
  //
  // **********************
  // Safety from rep exposure:
  // **********************
  //   No internal arrays or objects are exposed directly. methods return copies or strings.

  // **********************
  // Constructor
  // **********************

  constructor(rows?: number, cols?: number, cards?: string[][]) {
    this.rows = rows ?? 0;
    this.cols = cols ?? 0;
    this.cards = cards ?? [];
    this.checkRep();
  }

  // defined public getters
  public getRows(): number {
    return this.rows;
  }
  public getCols(): number {
    return this.cols;
  }
  public getCards(): string[][] {
    return this.cards.map((row) => [...row]);
  } // defensive copy

  // **********************
  // Check representation invariant
  // **********************
  private checkRep(): void {
    assert(this.rows >= 0, "rows must be non-negative");
    assert(this.cols >= 0, "cols must be non-negative");
    assert(Array.isArray(this.cards), "cards must be an array");
    assert(this.cards.length === this.rows, "cards length must match rows");
    for (const row of this.cards) {
      assert(Array.isArray(row), "each row must be an array");
      assert(row.length === this.cols, "row length must match cols");
    }
  }

  // **********************
  // Factory method
  // **********************
  /**
   * Make a new board by parsing a file.
   *
   * PS4 instructions: the specification of this method may not be changed.
   *
   * @param filename path to game board file
   * @returns a new board with the size and cards from the file
   * @throws Error if the file cannot be read or is not a valid game board
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
}
