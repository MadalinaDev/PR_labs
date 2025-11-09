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

      const cards = board.getCards(); // defensive copy
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
  });
});
