// Board <-> map text. Each cell is a 2-char pair on newline-separated rows;
// short rows pad with Empty and the (even) max row width sets the board width:
//   "##"   wall
//   "  "   empty
//   ". "   pellet
//   "O "   power pellet
//   "P<D>" player, <D> is spawn dir U/D/L/R 
//   "G<D>" ghost; 
// toAscii2d renders walls only; CLASSIC is the shipped board.

import { Block, Board, Direction, type BlockValue } from "./board.ts";

export const CLASSIC = `
########################################################
##O PR. . . . . . . . . . ####. . . . . . . . . . . O ##
##. ########. ##########. ####. ##########. ########. ##
##. ########. ##########. ####. ##########. ########. ##
##. ########. ##########. ####. ##########. ########. ##
##. . . . . . . . . . . . . . . . . . . . . . . . . . ##
##. ########. ####. ################. ####. ########. ##
##. ########. ####. ################. ####. ########. ##
##. . . . . . ####. . . . ####. . . . ####. . . . . . ##
############. ##########. ####. ##########. ############
          ##. ##########. ####. ##########. ##
          ##. ####. . . . . . . . . . ####. ##
############. ####. ######    ######. ####. ############
. . . . . . . . . . ##GR  GUGR  GL##. . . . . . . . PR. 
############. ####. ################. ####. ############
          ##. ####. . . . PL. . . . . ####. ##
          ##. ####. ################. ####. ##
############. ####. ################. ####. ############
##. PU. . . . . . . . . . ####. . . . . . . . . . . . ##
##. ########. ##########. ####. ##########. ########. ##
##. ########. ##########. ####. ##########. ########. ##
##. . . ####. . . . . . . . . . . . . . . . ####. . . ##
######. ####. ####. ################. ####. ####. ######
######. ####. ####. ################. ####. ####. ######
##. . . . . . ####. . . . ####. . . . ####. . . . . . ##
##. ####################. ####. ####################. ##
##. ####################. ####. ####################. ##
##O . . . . . . . . . . . PR. . . . . . . . . . . . O ##
########################################################
`;

export function toAscii2d(board: Board): string {
  const size = (2 * board.width + 1) * board.height;
  let result = "";
  for (let j = 0; j < board.height; j++) {
    for (let i = 0; i < board.width; i++) {
      if (board.hasWall(i, j)) {
        result += "##";
      } else {
        result += "  ";
      }
    }
    result += "\n";
  }
  if (result.length !== size) {
    throw new Error(`ascii2d size mismatch: expected ${size}, got ${result.length}`);
  }
  return result;
}

export function fromAscii2d(text: string): Board {
  const blocks: BlockValue[] = [];
  let height = 0;
  const trimmed = text.replace(/^\n/, "");
  const lines = trimmed.split("\n").filter((line) => line.length > 0);

  const maxLineLen = Math.max(...lines.map((line) => line.length));
  if (maxLineLen % 2 !== 0) {
    throw new Error("Bad line length");
  }
  const width = maxLineLen / 2;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (line === undefined) {
      continue;
    }
    height += 1;
    const chars = [...line];
    let charIndex = 0;

    while (charIndex < chars.length) {
      const first = chars[charIndex];
      charIndex += 1;
      const second = chars[charIndex];
      charIndex += 1;

      if (first === undefined) {
        break;
      }
      if (second === undefined) {
        throw new Error(`Blocks should be in pairs: ${first}`);
      }

      const block = parseBlockPair(first, second, lineIndex);
      blocks.push(block);
    }

    while (blocks.length < height * width) {
      blocks.push({ kind: Block.Empty });
    }
  }

  return new Board(width, height, blocks);
}

type DirChar = "R" | "L" | "U" | "D";

function isDirChar(char: string): char is DirChar {
  return char === "R" || char === "L" || char === "U" || char === "D";
}

function char2dir(char: DirChar): Direction {
  switch (char) {
    case "R":
      return Direction.RIGHT;
    case "L":
      return Direction.LEFT;
    case "U":
      return Direction.UP;
    case "D":
      return Direction.DOWN;
  }
}

function parseBlockPair(
  first: string,
  second: string,
  lineIndex: number,
): BlockValue {
  if (first === " " && second === " ") {
    return { kind: Block.Empty };
  }
  if (first === "#" && second === "#") {
    return { kind: Block.Wall };
  }
  if (first === "P" && isDirChar(second)) {
    return { kind: Block.Player, direction: char2dir(second) };
  }
  if (first === "G" && isDirChar(second)) {
    return { kind: Block.Ghost, direction: char2dir(second) };
  }
  if (first === "." && second === " ") {
    return { kind: Block.Pellet };
  }
  if (first === "O" && second === " ") {
    return { kind: Block.PowerPellet };
  }
  throw new Error(`Bad block (${first}, ${second}) at line ${lineIndex}`);
}
