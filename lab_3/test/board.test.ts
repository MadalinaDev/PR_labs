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

// Test suite for each board file
boardFiles.forEach((fileName) => {
  describe(`Board - ${fileName}`, function () {
    let board: Board;

    // Create fresh board instance before each test
    beforeEach(async function () {
      board = await Board.parseFromFile(`boards/${fileName}`);
    });

    // Test basic parsing functionality
    it("parses the board file correctly", function () {
      assert(board.getRows() > 0, "rows should be positive");
      assert(board.getCols() > 0, "cols should be positive");

      const cards = board.getCardValues(); // defensive copy
      assert(
        cards.length === board.getRows(),
        "cards row count should match board rows"
      );
      assert(
        cards[0]!.length === board.getCols(),
        "cards col count should match board cols"
      );
    });

    // Test representation invariant
    it("checkRep does not throw", function () {
      assert.doesNotThrow(() => board.checkRep());
    });

    // Test string representation
    it("toString works without error", function () {
      assert.doesNotThrow(() => board.toString());
    });

    // Test file reading
    it("reads the board file asynchronously", async function () {
      const content = (
        await fs.promises.readFile(`boards/${fileName}`)
      ).toString();
      assert(content.length > 0, "file should not be empty");
    });

    // ========== ADDITIONAL TESTS ==========

    // Test look method for different players
    it("look returns correct format for different players", function () {
      const player1State = board.look("player1");
      const player2State = board.look("player2");

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

      // First line should be dimensions
      assert.match(lines1[0]!, /^\d+x\d+$/, "first line should be dimensions");
      assert.match(lines2[0]!, /^\d+x\d+$/, "first line should be dimensions");
    });

    // Test flip operation changes card state
    it("flip operation changes card state", async function () {
      const initialState = board.look("testPlayer");

      // Try to flip first card
      await board.flip("testPlayer", 0, 0);
      const afterFlipState = board.look("testPlayer");

      // State should change after flip
      assert.notStrictEqual(
        initialState,
        afterFlipState,
        "board state should change after flip"
      );
    });

    // Test invalid coordinate handling
    it("flip rejects invalid coordinates", async function () {
      const invalidRow = board.getRows();
      const invalidCol = board.getCols();

      await assert.rejects(
        () => board.flip("testPlayer", invalidRow, 0),
        /Invalid card coordinates/,
        "should reject invalid row"
      );

      await assert.rejects(
        () => board.flip("testPlayer", 0, invalidCol),
        /Invalid card coordinates/,
        "should reject invalid column"
      );
    });

    // Test map function application
    it("map applies function to all cards", async function () {
      const originalValues = board.getCardValues();

      await board.map(async (card: string) => card + "-modified");

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
    });

    // Test watch functionality for board changes
    it("watch resolves when board changes", async function () {
      const changePromise = board.watch();

      // Trigger a change
      await board.flip("testPlayer", 0, 0);

      // watch should resolve
      await assert.doesNotReject(
        changePromise,
        "watch should resolve when board changes"
      );
    });

    // Test defensive copying
    it("getCardValues returns defensive copy", function () {
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
    });

    // Test concurrent flip operations
    it("concurrent flip operations don't cause errors", async function () {
      // Test that multiple flip operations can be initiated
      // without causing immediate errors (concurrency safety)
      const flipPromises = [];

      for (let i = 0; i < 3; i++) {
        flipPromises.push(
          board.flip(`player${i}`, i % board.getRows(), i % board.getCols())
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
    });

    // Test representation invariant maintenance
    it("board maintains representation invariant after operations", async function () {
      // Test that RI is maintained after various operations
      assert.doesNotThrow(() => board.checkRep(), "RI should hold initially");

      await board.flip("testPlayer", 0, 0);
      assert.doesNotThrow(() => board.checkRep(), "RI should hold after flip");

      await board.map(async (card: string) => card);
      assert.doesNotThrow(() => board.checkRep(), "RI should hold after map");
    });
  });
});

// Edge case tests
describe("Board - Edge Cases", function () {
  // Test minimal board configuration
  it("handles single card board", async function () {
    // Test with a minimal board
    const singleCardBoard = new Board(1, 1, [["X"]]);

    assert.strictEqual(singleCardBoard.getRows(), 1);
    assert.strictEqual(singleCardBoard.getCols(), 1);
    assert.deepStrictEqual(singleCardBoard.getCardValues(), [["X"]]);
  });

  // Test non-square board configurations
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

// Error condition tests
describe("Board - Error Conditions", function () {
  // Test file not found handling
  it("rejects invalid board files", async function () {
    await assert.rejects(
      () => Board.parseFromFile("nonexistent.txt"),
      /ENOENT|invalid board file/,
      "should reject non-existent files"
    );
  });

  // Test malformed dimension line
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

  // Test incorrect card count
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

// File parsing tests
describe("Board - parseFromFile", function () {
  // Test simplest possible board
  it("should parse a simple 1x1 board", async function () {
    const filename = "test-boards/simple.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "1x1\nA\n");

    const board = await Board.parseFromFile(filename);

    assert.strictEqual(board.getRows(), 1);
    assert.strictEqual(board.getCols(), 1);

    // Clean up
    await fs.promises.unlink(filename);
  });

  // Test board with emoji characters
  it("should parse a 3x3 board with emoji", async function () {
    const board = await Board.parseFromFile("boards/perfect.txt");

    assert.strictEqual(board.getRows(), 3);
    assert.strictEqual(board.getCols(), 3);
  });

  // Test larger board
  it("should parse a 5x5 board", async function () {
    const board = await Board.parseFromFile("boards/ab.txt");

    assert.strictEqual(board.getRows(), 5);
    assert.strictEqual(board.getCols(), 5);
  });

  // Test incorrect card count error
  it("should reject file with wrong card count", async function () {
    const filename = "test-boards/wrong-count.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nC\n"); // Only 3 cards for 2x2

    await assert.rejects(
      async () => await Board.parseFromFile(filename),
      /Expected 4 cards|number of card lines does not match/
    );

    await fs.promises.unlink(filename);
  });

  // Test invalid dimension handling
  it("should reject file with invalid dimensions", async function () {
    const filename = "test-boards/bad-dims.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "0x0\n");

    await assert.rejects(
      async () => await Board.parseFromFile(filename),
      /Invalid dimensions/
    );

    await fs.promises.unlink(filename);
  });

  // Test malformed first line
  it("should reject file with malformed first line", async function () {
    const filename = "test-boards/malformed.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "not-a-board\n");

    await assert.rejects(
      async () => await Board.parseFromFile(filename),
      /Invalid board format|invalid board dimension line/
    );

    await fs.promises.unlink(filename);
  });
});

// Board viewing tests
describe("Board - look", function () {
  // Test initial board state (all cards face down)
  it("should show all cards face down initially", async function () {
    const filename = "test-boards/look1.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);
    const view = board.look("alice");

    const lines = view.split("\n");
    assert.strictEqual(lines[0], "2x2");
    // All cards should be face down
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] && lines[i] !== "") {
        assert.strictEqual(lines[i], "down");
      }
    }

    await fs.promises.unlink(filename);
  });

  // Test player's view of their own controlled cards
  it("should show controlled cards as player's own", async function () {
    const filename = "test-boards/look2.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice flips first card
    await board.flip("alice", 0, 0);

    const view = board.look("alice");
    const lines = view.split("\n");
    assert(
      lines[1]!.includes("A") && lines[1]!.includes("my"),
      "Alice should see her controlled card"
    );

    await fs.promises.unlink(filename);
  });

  // Test player's view of other players' controlled cards
  it("should show others controlled cards as face up", async function () {
    const filename = "test-boards/look3.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice flips first card
    await board.flip("alice", 0, 0);

    // Bob's view
    const view = board.look("bob");
    const lines = view.split("\n");
    assert(
      lines[1]!.includes("A") && !lines[1]!.includes("my"),
      "Bob should see Alice's card as face up but not his"
    );

    await fs.promises.unlink(filename);
  });

  // Test view after card removal (matches)
  it("should show empty spaces after matches", async function () {
    const filename = "test-boards/look4.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice makes a match
    await board.flip("alice", 0, 0); // First A
    await board.flip("alice", 1, 0); // Second A

    // Start new move - matched cards should be removed
    await board.flip("alice", 0, 1);

    const view = board.look("alice");
    assert(view.includes("none"), "Should show empty spaces after matches");

    await fs.promises.unlink(filename);
  });
});

// First card flip tests
describe("Board - flip - first card", function () {
  // Test basic flip operation
  it("should flip face-down card and give control", async function () {
    const filename = "test-boards/flip1.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    await board.flip("alice", 0, 0);

    const view = board.look("alice");
    assert(view.includes("my A"), "Alice should control the flipped card");

    await fs.promises.unlink(filename);
  });

  // Test taking control of face-up uncontrolled card
  it("should give control of face-up uncontrolled card", async function () {
    const filename = "test-boards/flip2.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice flips and doesn't match
    await board.flip("alice", 0, 0);
    await board.flip("alice", 0, 1);

    // Bob can now take control of the face-up card
    await board.flip("bob", 0, 0);

    const view = board.look("bob");
    assert(view.includes("my A"), "Bob should control the face-up card");

    await fs.promises.unlink(filename);
  });

  // Test flipping empty space (after removal)
  it("should throw error for empty space", async function () {
    const filename = "test-boards/flip3.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice makes a match and removes cards
    await board.flip("alice", 0, 0);
    await board.flip("alice", 1, 0);
    await board.flip("alice", 0, 1);

    // Bob tries to flip empty space
    await assert.rejects(
      async () => await board.flip("bob", 0, 0),
      /no card at|Invalid card coordinates/
    );

    await fs.promises.unlink(filename);
  });

  // Test waiting for controlled card
  it("should wait for controlled card", async function () {
    const filename = "test-boards/flip4.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice flips first card
    await board.flip("alice", 0, 0);

    // Bob tries to flip same card - should wait
    let bobDone = false;
    const bobPromise = board.flip("bob", 0, 0).then(() => {
      bobDone = true;
    });

    // Give Bob a moment to start waiting
    await timeout(10);
    assert.strictEqual(bobDone, false, "Bob should still be waiting");

    // Alice flips second card - relinquishes first card
    await board.flip("alice", 0, 1);

    // Now Bob's flip should complete
    await bobPromise;
    assert.strictEqual(bobDone, true);

    await fs.promises.unlink(filename);
  });
});

// Second card flip tests (completing moves)
describe("Board - flip - second card", function () {
  // Test successful match
  it("should match and keep control of both cards", async function () {
    const filename = "test-boards/flip-2nd-1.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    await board.flip("alice", 0, 0);
    await board.flip("alice", 1, 0);

    const view = board.look("alice");
    // Both matched cards should be controlled by Alice
    const lines = view.split("\n");
    let myACount = 0;
    for (const line of lines) {
      if (line.includes("my A")) myACount++;
    }
    assert(myACount >= 2, "Alice should control both matched cards");

    await fs.promises.unlink(filename);
  });

  // Test failed match
  it("should not match and relinquish control", async function () {
    const filename = "test-boards/flip-2nd-2.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    await board.flip("alice", 0, 0);
    await board.flip("alice", 0, 1);

    const view = board.look("alice");
    // Cards should be face up but not controlled
    assert(
      view.includes("up A") && view.includes("up B"),
      "Cards should be face up but not controlled"
    );

    await fs.promises.unlink(filename);
  });
  
});

// Move completion tests
describe("Board - flip - finishing previous play", function () {
  // Test card removal after match
  it("should remove matched cards on next move", async function () {
    const filename = "test-boards/finish1.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice matches A cards
    await board.flip("alice", 0, 0);
    await board.flip("alice", 1, 0);

    // Alice starts new move - should remove As
    await board.flip("alice", 0, 1);

    const view = board.look("alice");
    assert(view.includes("none"), "Matched cards should be removed");

    await fs.promises.unlink(filename);
  });

  // Test turning down non-matching cards
  it("should turn down non-matching uncontrolled cards", async function () {
    const filename = "test-boards/finish2.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice flips non-matching cards
    await board.flip("alice", 0, 0);
    await board.flip("alice", 0, 1);

    // Alice starts new move - should turn them down
    await board.flip("alice", 1, 0);

    const view = board.look("alice");
    // Previous cards should be face down
    const lines = view.split("\n");
    let downCount = 0;
    for (const line of lines) {
      if (line === "down") downCount++;
    }
    assert(downCount >= 2, "Non-matching cards should be turned face down");

    await fs.promises.unlink(filename);
  });
});

// Basic concurrency tests
describe("Board - Concurrency", function () {
  // Test multiple players flipping different cards simultaneously
  it("should handle multiple players flipping different cards", async function () {
    const filename = "test-boards/concurrent1.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "3x3\nA\nB\nC\nA\nB\nC\nD\nD\nE\n");

    const board = await Board.parseFromFile(filename);

    // Alice and Bob flip simultaneously
    await Promise.all([board.flip("alice", 0, 0), board.flip("bob", 0, 1)]);

    const aliceView = board.look("alice");
    const bobView = board.look("bob");

    assert(aliceView.includes("my A"), "Alice should control her card");
    assert(bobView.includes("my B"), "Bob should control his card");

    await fs.promises.unlink(filename);
  });

  // Test multiple players waiting for same card
  it("should handle multiple waiters for same card", async function () {
    const filename = "test-boards/concurrent2.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice controls a card
    await board.flip("alice", 0, 0);

    // Bob and Charlie both wait for it
    const bobPromise = board.flip("bob", 0, 0);
    const charliePromise = board.flip("charlie", 0, 0);

    await timeout(10);

    // Alice releases the card
    await board.flip("alice", 0, 1);

    // One of them should get it
    await Promise.race([bobPromise, charliePromise]);

    await fs.promises.unlink(filename);
  });

  // Test concurrent operations with mixed types
  it("should handle player making move while another waits", async function () {
    const filename = "test-boards/concurrent3.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice controls a card
    await board.flip("alice", 0, 0);

    // Bob waits for it
    const bobPromise = board.flip("bob", 0, 0);

    await timeout(10);

    // Charlie makes a completely different move
    await board.flip("charlie", 1, 1);

    // Alice releases, Bob gets it
    await board.flip("alice", 0, 1);
    await bobPromise;

    const bobView = board.look("bob");
    assert(bobView.includes("my A"));

    await fs.promises.unlink(filename);
  });
});

// Advanced concurrency tests
describe("Board - Advanced Concurrency", function () {
  // Test multiple concurrent flips
  it("should handle multiple players flipping different cards concurrently", async function () {
    const filename = "test-boards/concurrent-multi.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "3x3\nA\nB\nC\nA\nB\nC\nD\nD\nE\n");

    const board = await Board.parseFromFile(filename);

    // Multiple players flip different cards
    await Promise.all([
      board.flip("player1", 0, 0),
      board.flip("player2", 0, 1),
      board.flip("player3", 0, 2),
    ]);

    // All should have their cards
    const view1 = board.look("player1");
    const view2 = board.look("player2");
    const view3 = board.look("player3");

    assert(view1.includes("my A"));
    assert(view2.includes("my B"));
    assert(view3.includes("my C"));

    await fs.promises.unlink(filename);
  });

  // Test deadlock prevention
  it("should not deadlock when players contend for cards", async function () {
    const filename = "test-boards/no-deadlock.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Alice and Bob control different cards
    await board.flip("alice", 0, 0);
    await board.flip("bob", 0, 1);

    // Both try to flip each other's cards
    const [aliceResult, bobResult] = await Promise.allSettled([
      board.flip("alice", 0, 1),
      board.flip("bob", 0, 0),
    ]);

    // At least one should fail (no deadlock)
    const aliceFailed = aliceResult.status === "rejected";
    const bobFailed = bobResult.status === "rejected";

    assert(
      aliceFailed || bobFailed,
      "At least one flip should fail to avoid deadlock"
    );

    await fs.promises.unlink(filename);
  });
});

// Map function tests
describe("Board - map() extended tests", function () {
  // Test card transformation
  it("should transform all cards on the board", async function () {
    const filename = "test-boards/map-simple.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Transform A->X, B->Y
    await board.map(async (card) => {
      if (card === "A") return "X";
      if (card === "B") return "Y";
      return card;
    });

    // Verify transformation
    const cards = board.getCardValues();
    for (let r = 0; r < board.getRows(); r++) {
      for (let c = 0; c < board.getCols(); c++) {
        const card = cards[r]![c];
        assert(
          card === "X" || card === "Y",
          `Card should be transformed: ${card}`
        );
      }
    }

    await fs.promises.unlink(filename);
  });

  // Test that map preserves card state
  it("should not affect card face-up/down state", async function () {
    const filename = "test-boards/map-facestate.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Flip one card face up
    await board.flip("player1", 0, 0);

    const beforeView = board.look("player1");

    // Transform cards
    await board.map(async (card) => `${card}+`);

    const afterView = board.look("player1");

    // The pattern of face-up/down should be the same
    const beforeLines = beforeView
      .split("\n")
      .filter((line) => line && line !== "2x2");
    const afterLines = afterView
      .split("\n")
      .filter((line) => line && line !== "2x2");

    for (let i = 0; i < beforeLines.length; i++) {
      const before = beforeLines[i]!;
      const after = afterLines[i]!;

      // Check if face state is preserved (my/up/down/none)
      if (before.startsWith("my")) {
        assert(
          after.startsWith("my"),
          "Face-up controlled cards should remain controlled"
        );
      } else if (before.startsWith("up")) {
        assert(
          after.startsWith("up"),
          "Face-up uncontrolled cards should remain face-up"
        );
      } else if (before === "down") {
        assert(after === "down", "Face-down cards should remain face-down");
      } else if (before === "none") {
        assert(after === "none", "Empty spaces should remain empty");
      }
    }

    await fs.promises.unlink(filename);
  });
});

// Watch functionality tests
describe("Board - watch() extended tests", function () {
  // Test watch notification on flip
  it("should wait for and notify on card flip", async function () {
    const filename = "test-boards/watch-flip.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Start watching for changes
    let watchResolved = false;
    const watchPromise = board.watch().then(() => {
      watchResolved = true;
    });

    // Verify watch hasn't resolved yet
    await timeout(10);
    assert(!watchResolved, "Watch should not resolve before change");

    // Make a change: flip a card
    await board.flip("player1", 0, 0);

    // Watch should now resolve
    await watchPromise;
    assert(watchResolved, "Watch should resolve after flip");

    await fs.promises.unlink(filename);
  });

  // Test watch notification on card removal
  it("should notify on card removal", async function () {
    const filename = "test-boards/watch-remove.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Set up a match
    await board.flip("player1", 0, 0);
    await board.flip("player1", 1, 0);

    // Start watching
    let watchResolved = false;
    const watchPromise = board.watch().then(() => {
      watchResolved = true;
    });

    await timeout(10);
    assert(!watchResolved);

    // Remove the matched cards by making another move
    await board.flip("player1", 0, 1);

    // Watch should resolve
    await watchPromise;
    assert(watchResolved);

    await fs.promises.unlink(filename);
  });

  // Test multiple concurrent watchers
  it("should handle multiple concurrent watchers", async function () {
    const filename = "test-boards/watch-multiple.txt";
    await fs.promises.mkdir("test-boards", { recursive: true });
    await fs.promises.writeFile(filename, "2x2\nA\nB\nA\nB\n");

    const board = await Board.parseFromFile(filename);

    // Start multiple watchers
    let watcher1Resolved = false;
    let watcher2Resolved = false;

    const watch1 = board.watch().then(() => {
      watcher1Resolved = true;
    });
    const watch2 = board.watch().then(() => {
      watcher2Resolved = true;
    });

    await timeout(10);
    assert(!watcher1Resolved && !watcher2Resolved);

    // Make one change
    await board.flip("player1", 0, 0);

    // All watchers should resolve
    await Promise.all([watch1, watch2]);
    assert(watcher1Resolved && watcher2Resolved);

    await fs.promises.unlink(filename);
  });
});

// Cleanup test-boards directory after all tests
after(async function () {
  try {
    const files = await fs.promises.readdir("test-boards");
    for (const file of files) {
      await fs.promises.unlink(`test-boards/${file}`);
    }
    await fs.promises.rmdir("test-boards");
  } catch (err) {
    // Directory might not exist, that's okay
  }
});

/**
 * Helper function to create a delay
 * @param ms milliseconds to wait
 */
async function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
