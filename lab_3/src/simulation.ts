/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import { Board } from "./board";

/**
 * Simplified concurrent simulation similar to the first code
 */
async function simulationMain(): Promise<void> {
  const filename = "boards/ab.txt";

  console.log("=== Testing Board Initialization ===");
  try {
    const board: Board = await Board.parseFromFile(filename);
    console.log(`✓ Board loaded: ${board.getRows()}x${board.getCols()}`);

    // Run the main simulation
    await runConcurrentSimulation(board);
  } catch (error) {
    console.error("✗ Board initialization failed:", error);
    process.exit(1);
  }
}

async function runConcurrentSimulation(board: Board): Promise<void> {
  const size = 5;
  const players = 4; // 4 players as required
  const tries = 100; // 100 moves each as required
  const minDelayMilliseconds = 0.1; // 0.1ms minimum delay
  const maxDelayMilliseconds = 2; // 2ms maximum delay

  console.log(
    `Starting simulation with ${players} players, ${tries} moves each`
  );
  console.log(`Board size: ${board.getRows()}x${board.getCols()}`);
  console.log(
    `Delay range: ${minDelayMilliseconds}ms to ${maxDelayMilliseconds}ms`
  );

  // Track statistics - similar to first code
  const stats = {
    successfulFlips: 0,
    failedFlips: 0,
    matches: 0,
    emptySpaceErrors: 0,
    controlledCardErrors: 0,
    invalidCoordinateErrors: 0,
    otherErrors: 0,
  };

  // start up one or more players as concurrent asynchronous function calls
  const playerPromises: Array<Promise<void>> = [];
  for (let ii = 0; ii < players; ++ii) {
    playerPromises.push(
      player(
        ii,
        board,
        size,
        tries,
        minDelayMilliseconds,
        maxDelayMilliseconds,
        stats
      )
    );
  }

  // wait for all the players to finish (unless one throws an exception)
  await Promise.all(playerPromises);

  console.log("\n=== Simulation Results ===");
  console.log(`Successful flips: ${stats.successfulFlips}`);
  console.log(`Failed flips: ${stats.failedFlips}`);
  console.log(`Matches made: ${stats.matches}`);
  console.log(`Invalid coordinate errors: ${stats.invalidCoordinateErrors}`);
  console.log("Simulation completed without crashes!");
}

/** @param playerNumber player to simulate */
async function player(
  playerNumber: number,
  board: Board,
  size: number,
  tries: number,
  minDelay: number,
  maxDelay: number,
  stats: any
): Promise<void> {
  const playerId = `player${playerNumber}`;

  console.log(`Player ${playerId} starting with ${tries} moves`);

  for (let jj = 0; jj < tries; ++jj) {
    try {
      // Random delay between 0.1ms and 2ms
      await timeout(minDelay + Math.random() * (maxDelay - minDelay));

      // First card flip attempt
      const firstRow = randomInt(size);
      const firstCol = randomInt(size);

      try {
        await board.flip(playerId, firstRow, firstCol);
        stats.successfulFlips++;

        // Second card flip attempt after random delay
        await timeout(minDelay + Math.random() * (maxDelay - minDelay));

        const secondRow = randomInt(size);
        const secondCol = randomInt(size);

        try {
          await board.flip(playerId, secondRow, secondCol);
          stats.successfulFlips++;

          // Check if this was a match by looking at board state
          const currentView = board.look(playerId);
          const myCards = (currentView.match(/my/g) || []).length;
          if (myCards >= 2) {
            stats.matches++;
          }
        } catch (secondError: any) {
          stats.failedFlips++;
          const errorMsg = secondError.message || "Unknown error";

          if (errorMsg.includes("no card at")) {
            stats.emptySpaceErrors++;
          } else if (errorMsg.includes("controlled by another player")) {
            stats.controlledCardErrors++;
          } else if (errorMsg.includes("Invalid card coordinates")) {
            stats.invalidCoordinateErrors++;
          } else {
            stats.otherErrors++;
          }
        }
      } catch (firstError: any) {
        stats.failedFlips++;
        const errorMsg = firstError.message || "Unknown error";

        if (errorMsg.includes("no card at")) {
          stats.emptySpaceErrors++;
        } else if (errorMsg.includes("Invalid card coordinates")) {
          stats.invalidCoordinateErrors++;
        } else {
          stats.otherErrors++;
        }
      }
    } catch (err: any) {
      console.error(
        `Player ${playerId} attempt ${jj} failed:`,
        err.message || err
      );
      stats.failedFlips++;
      stats.otherErrors++;
    }

    // Optional: Print progress every 10 moves
    if ((jj + 1) % 10 === 0) {
      console.log(`Player ${playerId} completed ${jj + 1}/${tries} moves`);
    }
  }

  console.log(`Player ${playerId} finished all moves`);
}

/**
 * Random positive integer generator
 *
 * @param max a positive integer which is the upper bound of the generated number
 * @returns a random integer >= 0 and < max
 */
function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

/**
 * @param milliseconds duration to wait
 * @returns a promise that fulfills no less than `milliseconds` after timeout() was called
 */
async function timeout(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// Run the simulation
void simulationMain().catch((error) => {
  console.error("Simulation failed with error:", error);
  process.exit(1);
});
