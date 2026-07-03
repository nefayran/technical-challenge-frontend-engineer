"""Deterministic Pac-Man-style board generation from ``(seed, size)``.

Output is ascii2d text (see ``ascii2d.py``) that the game engine parses and
plays directly. Generation is fully deterministic: identical ``(seed, size)``
yields byte-identical output regardless of the Python build, because it relies
on an explicit LCG rather than the stdlib RNG (whose stream is not contractually
stable across versions/platforms).

``size`` is the board dimension in cells: the result is a ``size`` x ``size``
grid (so the engine reports it as ``size``x``size``). Corridors are carved by a
randomized-DFS perfect maze on the odd-indexed cells, surrounded by a wall
border. Corridors are filled with pellets; a player spawn sits nearest the
center, power pellets nearest the four corners, and ghost spawns nearest the
four edge midpoints.
"""

from . import ascii2d

# Smallest board that yields a reasonable maze with room for spawns.
MIN_SIZE = 15
MAX_SIZE = 1000

GHOST_DIRECTIONS = (ascii2d.LEFT, ascii2d.RIGHT, ascii2d.UP, ascii2d.DOWN)


class _Lcg:
    """Numerical Recipes LCG; deterministic and dependency-free."""

    def __init__(self, seed: int) -> None:
        self._state = seed & 0xFFFFFFFF

    def _next(self) -> int:
        self._state = (self._state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self._state

    def below(self, bound: int) -> int:
        return self._next() % bound

    def shuffled(self, items: list[tuple[int, int]]) -> list[tuple[int, int]]:
        result = list(items)
        for i in range(len(result) - 1, 0, -1):
            j = self.below(i + 1)
            result[i], result[j] = result[j], result[i]
        return result


def generate(seed: int, size: int) -> str:
    """Build a deterministic playable board as ascii2d text."""
    if size < MIN_SIZE or size > MAX_SIZE:
        raise ValueError(f"size must be in [{MIN_SIZE}, {MAX_SIZE}], got {size}")

    dim = size
    # grid[y][x] holds an ascii2d token; start fully walled, carve passages out.
    grid = [[ascii2d.WALL for _ in range(dim)] for _ in range(dim)]
    passages = _carve(grid, dim, _Lcg(seed))

    used: set[tuple[int, int]] = set()
    center = (dim // 2, dim // 2)
    player = _nearest(passages, center, used)
    grid[player[1]][player[0]] = ascii2d.player(ascii2d.RIGHT)

    corners = [(0, 0), (dim - 1, 0), (0, dim - 1), (dim - 1, dim - 1)]
    for corner in corners:
        cell = _nearest(passages, corner, used)
        if cell is not None:
            grid[cell[1]][cell[0]] = ascii2d.POWER

    mids = [(dim // 2, 0), (dim // 2, dim - 1), (0, dim // 2), (dim - 1, dim // 2)]
    for direction, mid in zip(GHOST_DIRECTIONS, mids):
        cell = _nearest(passages, mid, used)
        if cell is not None:
            grid[cell[1]][cell[0]] = ascii2d.ghost(direction)

    return "\n".join("".join(row) for row in grid) + "\n"


def _carve(
    grid: list[list[str]], dim: int, rng: _Lcg
) -> list[tuple[int, int]]:
    """Randomized-DFS perfect maze; returns carved passage cells as pellets.

    Passages live on odd-indexed cells in ``[1, dim-2]`` so a wall border always
    remains; with an even ``dim`` the far edge is simply one cell thicker.
    """
    start = (1, 1)
    grid[start[1]][start[0]] = ascii2d.PELLET
    visited = {start}
    stack = [start]

    while stack:
        x, y = stack[-1]
        unvisited = [
            (nx, ny)
            for nx, ny in ((x + 2, y), (x - 2, y), (x, y + 2), (x, y - 2))
            if 1 <= nx <= dim - 2
            and 1 <= ny <= dim - 2
            and (nx, ny) not in visited
        ]
        if not unvisited:
            stack.pop()
            continue
        nx, ny = rng.shuffled(unvisited)[0]
        # Knock down the wall between current and chosen neighbor.
        grid[(y + ny) // 2][(x + nx) // 2] = ascii2d.PELLET
        grid[ny][nx] = ascii2d.PELLET
        visited.add((nx, ny))
        stack.append((nx, ny))

    return sorted(visited)


def _nearest(
    passages: list[tuple[int, int]],
    target: tuple[int, int],
    used: set[tuple[int, int]],
) -> tuple[int, int] | None:
    """Closest (Manhattan) unused passage cell to ``target``, marking it used."""
    best: tuple[int, int] | None = None
    best_distance = -1
    for cell in passages:
        if cell in used:
            continue
        distance = abs(cell[0] - target[0]) + abs(cell[1] - target[1])
        if best is None or distance < best_distance:
            best = cell
            best_distance = distance
    if best is not None:
        used.add(best)
    return best
