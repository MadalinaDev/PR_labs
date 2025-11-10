/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from "node:assert";
import fs from "node:fs";
import { Board } from "../src/board.ts";


/**
 * Tests for the Board abstract data type.
 */
const boardFiles = ["ab.txt", "perfect.txt", "zoom.txt"];

boardFiles.forEach((fileName) => {
  describe(`Board - ${fileName}`, function () {
    let board: any;

    beforeEach(async function () {
      board = await Board.parseFromFile(`boards/${fileName}`);
    });

    it("parses the board file correctly", function () {
      assert(board.getRows() > 0, "rows should be positive");
      assert(board.getCols() > 0, "cols should be positive");

      const cards = board.getCardValues(); // defensive copy
      assert(
        cards.length === board.getRows(),
        "cards row count should match board rows"
      );
      assert(
        cards[0].length === board.getCols(),
        "cards col count should match board cols"
      );
    });

    it("checkRep does not throw", function () {
      if (board.checkRep) {
        assert.doesNotThrow(() => board.checkRep());
      }
    });

    it("toString works without error", function () {
      if (board.toString) {
        assert.doesNotThrow(() => board.toString());
      }
    });

    it("reads the board file asynchronously", async function () {
      const content = (
        await fs.promises.readFile(`boards/${fileName}`)
      ).toString();
      assert(content.length > 0, "file should not be empty");
    });

    // ========== ADDITIONAL TESTS ==========

    it("getBoardState returns correct format for different players", function () {
      if (board.getBoardState) {
        const player1State = board.getBoardState("player1");
        const player2State = board.getBoardState("player2");

        assert(
          typeof player1State === "string",
          "board state should be a string"
        );
        assert(
          typeof player2State === "string",
          "board state should be a string"
        );

        const lines1 = player1State.split("\n");
        const lines2 = player2State.split("\n");

        assert.strictEqual(
          lines1.length,
          board.getRows(),
          "state should have correct number of rows"
        );
        assert.strictEqual(
          lines2.length,
          board.getRows(),
          "state should have correct number of rows"
        );

        for (let i = 0; i < lines1.length; i++) {
          assert.strictEqual(
            lines1[i]!.length,
            board.getCols(),
            `row ${i} should have correct number of columns`
          );
          assert.strictEqual(
            lines2[i]!.length,
            board.getCols(),
            `row ${i} should have correct number of columns`
          );
        }
      }
    });

    it("flipCard operation changes card state", async function () {
      if (board.flipCard && board.getBoardState) {
        const initialState = board.getBoardState("testPlayer");

        // Try to flip first card
        await board.flipCard("testPlayer", 0, 0);
        const afterFlipState = board.getBoardState("testPlayer");

        // State should change after flip
        assert.notStrictEqual(
          initialState,
          afterFlipState,
          "board state should change after flip"
        );
      }
    });

    it("flipCard rejects invalid coordinates", async function () {
      if (board.flipCard) {
        const invalidRow = board.getRows();
        const invalidCol = board.getCols();

        await assert.rejects(
          () => board.flipCard("testPlayer", invalidRow, 0),
          /Invalid card coordinates/,
          "should reject invalid row"
        );

        await assert.rejects(
          () => board.flipCard("testPlayer", 0, invalidCol),
          /Invalid card coordinates/,
          "should reject invalid column"
        );
      }
    });

    it("checkMatches detects and removes matching cards", function () {
      if (board.checkMatches && board.getBoardState) {
        // Create a simple 2x2 board with one pair for testing
        const testCards = [
          ["A", "B"],
          ["A", "C"],
        ];
        const testBoard = new Board(2, 2, testCards);

        // Manually set cards to face-up state to simulate they've been flipped
        // This tests the matching logic without going through flipCard
        testBoard["cards"][0]![0]!.faceUp = true;
        testBoard["cards"][0]![0]!.controller = "player1";
        testBoard["cards"][1]![0]!.faceUp = true;
        testBoard["cards"][1]![0]!.controller = "player1";

        testBoard.checkMatches();
        const state = testBoard.getBoardState("player1");

        // Both 'A' cards should be matched and show as '_'
        const lines = state.split("\n");
        assert(
          lines[0]!.startsWith("_") || lines[0]!.includes("_"),
          "matched cards should show as _"
        );
        assert(
          lines[1]!.startsWith("_") || lines[1]!.includes("_"),
          "matched cards should show as _"
        );
      }
    });

    it("mapCards applies function to all cards", async function () {
      if (board.mapCards && board.getCardValues) {
        const originalValues = board.getCardValues();

        await board.mapCards(async (card: string) => card + "-modified");

        const modifiedValues = board.getCardValues();

        // All cards should be modified
        for (let r = 0; r < board.getRows(); r++) {
          for (let c = 0; c < board.getCols(); c++) {
            assert.strictEqual(
              modifiedValues[r]![c],
              originalValues[r]![c] + "-modified",
              `card at (${r},${c}) should be modified`
            );
          }
        }
      }
    });

    it("waitForChange resolves when board changes", async function () {
      if (board.waitForChange && board.flipCard) {
        const changePromise = board.waitForChange();

        // Trigger a change
        await board.flipCard("testPlayer", 0, 0);

        // waitForChange should resolve
        await assert.doesNotReject(
          changePromise,
          "waitForChange should resolve when board changes"
        );
      }
    });

    it("getCardValues returns defensive copy", function () {
      if (board.getCardValues) {
        const cards1 = board.getCardValues();
        const cards2 = board.getCardValues();

        // Should be different arrays (defensive copy)
        assert.notStrictEqual(
          cards1,
          cards2,
          "should return different array instances"
        );

        // But with same content
        assert.deepStrictEqual(cards1, cards2, "content should be identical");
      }
    });

    it("concurrent flip operations don't cause errors", async function () {
      if (board.flipCard && board.getBoardState) {
        // Test that multiple flip operations can be initiated
        // without causing immediate errors (concurrency safety)
        const flipPromises = [];

        for (let i = 0; i < 3; i++) {
          flipPromises.push(
            board.flipCard(
              `player${i}`,
              i % board.getRows(),
              i % board.getCols()
            )
          );
        }

        // At least some operations should complete successfully
        const results = await Promise.allSettled(flipPromises);
        const successfulFlips = results.filter(
          (result) => result.status === "fulfilled"
        ).length;

        assert(
          successfulFlips > 0,
          "at least some flip operations should succeed"
        );
      }
    });

    it("board maintains representation invariant after operations", async function () {
      if (board.checkRep && board.flipCard && board.mapCards) {
        // Test that RI is maintained after various operations
        assert.doesNotThrow(() => board.checkRep(), "RI should hold initially");

        await board.flipCard("testPlayer", 0, 0);
        assert.doesNotThrow(
          () => board.checkRep(),
          "RI should hold after flip"
        );

        await board.mapCards(async (card: string) => card);
        assert.doesNotThrow(() => board.checkRep(), "RI should hold after map");

        board.checkMatches();
        assert.doesNotThrow(
          () => board.checkRep(),
          "RI should hold after checkMatches"
        );
      }
    });
  });
});

// ========== ADDITIONAL TEST SUITES ==========

describe("Board - Edge Cases", function () {
  it("handles single card board", async function () {
    // Test with a minimal board
    const singleCardBoard = new Board(1, 1, [["X"]]);

    assert.strictEqual(singleCardBoard.getRows(), 1);
    assert.strictEqual(singleCardBoard.getCols(), 1);
    assert.deepStrictEqual(singleCardBoard.getCardValues(), [["X"]]);
  });

  it("handles rectangular boards correctly", function () {
    const wideBoard = new Board(2, 3, [
      ["A", "B", "C"],
      ["D", "E", "F"],
    ]);
    const tallBoard = new Board(3, 2, [
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
    ]);

    assert.strictEqual(wideBoard.getRows(), 2);
    assert.strictEqual(wideBoard.getCols(), 3);
    assert.strictEqual(tallBoard.getRows(), 3);
    assert.strictEqual(tallBoard.getCols(), 2);
  });
});

describe("Board - Error Conditions", function () {
  it("rejects invalid board files", async function () {
    await assert.rejects(
      () => Board.parseFromFile("nonexistent.txt"),
      /ENOENT|invalid board file/,
      "should reject non-existent files"
    );
  });

  it("rejects malformed dimension lines", async function () {
    // Create a temporary file with bad dimensions
    const badContent = "invalid-dimension-line\ncard1\ncard2";
    const tempFile = "test-malformed.txt";

    await fs.promises.writeFile(tempFile, badContent);

    await assert.rejects(
      () => Board.parseFromFile(tempFile),
      /invalid board dimension line/,
      "should reject malformed dimension line"
    );

    // Clean up
    await fs.promises.unlink(tempFile);
  });

  it("rejects incorrect number of cards", async function () {
    // Create a temporary file with wrong card count
    const badContent = "2x2\ncard1\ncard2\ncard3"; // 2x2 needs 4 cards, but only 3 provided
    const tempFile = "test-wrong-count.txt";

    await fs.promises.writeFile(tempFile, badContent);

    await assert.rejects(
      () => Board.parseFromFile(tempFile),
      /number of card lines does not match/,
      "should reject incorrect card count"
    );

    // Clean up
    await fs.promises.unlink(tempFile);
  });
});

describe("Board - State Transitions", function () {
  it("tracks card controllers correctly", async function () {
    const board = new Board(2, 2, [
      ["A", "B"],
      ["C", "D"],
    ]);

    if (board.flipCard && board.getBoardState) {
      // Player 1 flips a card
      await board.flipCard("player1", 0, 0);
      let state1 = board.getBoardState("player1");
      assert(state1.includes("A"), "player1 should see their controlled card");

      // Player 2 looks at board
      let state2 = board.getBoardState("player2");
      assert(
        state2.includes("*"),
        "player2 should see '*' for player1's controlled card"
      );

      // Player 1 flips card back down
      await board.flipCard("player1", 0, 0);
      state1 = board.getBoardState("player1");
      assert(state1.includes("-"), "card should be face down after flip down");
    }
  });

  it("prevents flipping cards controlled by other players", async function () {
    const board = new Board(2, 2, [
      ["A", "B"],
      ["C", "D"],
    ]);

    if (board.flipCard) {
      // Player 1 flips a card
      await board.flipCard("player1", 0, 0);

      // Player 2 tries to flip the same card
      await assert.rejects(
        () => board.flipCard("player2", 0, 0),
        /controlled by another player/,
        "should prevent flipping other player's cards"
      );
    }
  });
});
