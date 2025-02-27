import React, { useState } from "react";

const BOARD_ROWS = 9;
const BOARD_COLS = 7;

const INITIAL_POSITIONS = {
  red: [
    { type: "Elephant", rank: 8, position: [0, 6] },
    { type: "Lion", rank: 7, position: [0, 0] },
    { type: "Tiger", rank: 6, position: [0, 5] },
    { type: "Leopard", rank: 5, position: [2, 2] },
    { type: "Wolf", rank: 4, position: [2, 4] },
    { type: "Dog", rank: 3, position: [2, 6] },
    { type: "Cat", rank: 2, position: [2, 0] },
    { type: "Rat", rank: 1, position: [1, 1] },
  ],
  blue: [
    { type: "Elephant", rank: 8, position: [8, 0] },
    { type: "Lion", rank: 7, position: [8, 6] },
    { type: "Tiger", rank: 6, position: [8, 1] },
    { type: "Leopard", rank: 5, position: [6, 4] },
    { type: "Wolf", rank: 4, position: [6, 2] },
    { type: "Dog", rank: 3, position: [6, 0] },
    { type: "Cat", rank: 2, position: [6, 6] },
    { type: "Rat", rank: 1, position: [7, 5] },
  ],
};

const RANK_TO_ANIMAL = {
  8: "🐘",
  7: "🦁",
  6: "🐅",
  5: "🐆",
  4: "🐺",
  3: "🐕",
  2: "🐈",
  1: "🐀",
};

export default function JungleGame() {
  const [board, setBoard] = useState(createInitialBoard());
  const [turn, setTurn] = useState("red");
  const [selected, setSelected] = useState(null);

  function createInitialBoard() {
    const board = Array.from({ length: BOARD_ROWS }, () =>
      Array(BOARD_COLS).fill(null)
    );

    for (const color of ["red", "blue"]) {
      INITIAL_POSITIONS[color].forEach((piece) => {
        const [row, col] = piece.position;
        board[row][col] = { ...piece, color };
      });
    }

    return board;
  }

  function handleCellClick(row, col) {
    const piece = board[row][col];
    if (piece && piece.color === turn) {
      setSelected({ ...piece, row, col });
    } else if (selected) {
      const newBoard = board.map((r) => r.slice());
      const isValidMove =
        Math.abs(row - selected.row) + Math.abs(col - selected.col) === 1;

      if (isValidMove) {
        newBoard[selected.row][selected.col] = null;
        newBoard[row][col] = { ...selected };
        setBoard(newBoard);

        if (piece && piece.color !== turn) {
          if (selected.rank >= piece.rank) {
            newBoard[row][col] = { ...selected };
          } else {
            return;
          }
        }
        setSelected(null);
        setTurn(turn === "red" ? "blue" : "red");
      }
    }
  }

  function renderCell(row, col) {
    const piece = board[row][col];
    return (
      <div
        key={`${row}-${col}`}
        className="cell"
        onClick={() => handleCellClick(row, col)}
      >
        {piece ? (
          <span className={`piece ${piece.color}`}>
            {RANK_TO_ANIMAL[piece.rank]}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="game-container">
      <h1>Jungle (Dou Shou Qi)</h1>
      <p>Turn: {turn === "red" ? "🔴 Red" : "🔵 Blue"}</p>
      <div className="board">
        {board.map((row, rowIndex) =>
          row.map((_, colIndex) => renderCell(rowIndex, colIndex))
        )}
      </div>
      <style>
        {`
          .game-container {
            text-align: center;
            margin: 20px;
          }
          .board {
            display: grid;
            grid-template-columns: repeat(7, 64px);
            grid-auto-rows: 64px;
            gap: 0;
            margin: 20px auto;
          }
          .cell {
            display: flex;
            justify-content: center;
            align-items: center;
            border: 1px solid black;
            background-color: lightgreen;
          }
          .cell:nth-child(odd) {
            background-color: darkseagreen;
          }
          .piece {
            font-size: 24px;
          }
          .piece.red {
            color: red;
          }
          .piece.blue {
            color: blue;
          }
        `}
      </style>
    </div>
  );
}