/**
 * Represents a point in a 2D grid.
 */
export interface Node {
    x: number;
    y: number;
    g?: number; // Cost from start
    h?: number; // Heuristic cost to end
    f?: number; // Total cost (g + h)
    parent?: Node | null;
}

/**
 * A simple A* pathfinder for 2D grids.
 */
export class Pathfinder {
    private grid: boolean[][]; // [y][x] Walkable = true, Obstacle = false

    constructor(grid: boolean[][]) {
        this.grid = grid;
    }

    public updateGrid(grid: boolean[][]) {
        this.grid = grid;
    }

    /**
     * Finds a path from (startX, startY) to (endX, endY).
     * @returns Array of nodes from start to end, or null if no path found.
     */
    public findPath(startX: number, startY: number, endX: number, endY: number): Node[] | null {
        // Validation
        if (!this.isValid(startX, startY) || !this.isValid(endX, endY)) return null;
        if (!this.grid[startY][startX] || !this.grid[endY][endX]) return null;

        const openList: Node[] = [];
        const closedList: Set<string> = new Set();

        const startNode: Node = { x: startX, y: startY, g: 0, h: this.heuristic(startX, startY, endX, endY), f: 0, parent: null };
        startNode.f = startNode.g! + startNode.h!;
        openList.push(startNode);

        while (openList.length > 0) {
            // Get node with lowest f cost
            openList.sort((a, b) => a.f! - b.f!);
            const currentNode = openList.shift()!;

            // Target reached
            if (currentNode.x === endX && currentNode.y === endY) {
                return this.reconstructPath(currentNode);
            }

            const key = `${currentNode.x},${currentNode.y}`;
            closedList.add(key);

            // Explore neighbors
            const neighbors = this.getNeighbors(currentNode);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                if (closedList.has(neighborKey)) continue;

                // Move cost (1 for cardinal, 1.4 for diagonal)
                const isDiagonal = neighbor.x !== currentNode.x && neighbor.y !== currentNode.y;
                const moveCost = isDiagonal ? 1.4 : 1;
                const gScore = currentNode.g! + moveCost;

                let openNode = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);

                if (!openNode) {
                    neighbor.g = gScore;
                    neighbor.h = this.heuristic(neighbor.x, neighbor.y, endX, endY);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = currentNode;
                    openList.push(neighbor);
                } else if (gScore < openNode.g!) {
                    openNode.g = gScore;
                    openNode.f = openNode.g + openNode.h!;
                    openNode.parent = currentNode;
                }
            }
        }

        return null;
    }

    private heuristic(x1: number, y1: number, x2: number, y2: number): number {
        // Octile distance (better for 8-way movement)
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        const D = 1;
        const D2 = 1.4;
        return D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy);
    }

    private getNeighbors(node: Node): Node[] {
        const neighbors: Node[] = [];
        const x = node.x;
        const y = node.y;

        // 8-way neighbors
        for (let ix = -1; ix <= 1; ix++) {
            for (let iy = -1; iy <= 1; iy++) {
                if (ix === 0 && iy === 0) continue;

                const nx = x + ix;
                const ny = y + iy;

                if (this.isValid(nx, ny) && this.grid[ny][nx]) {
                    // Prevent cutting corners through diagonal gaps if corners are blocked
                    const isDiagonal = ix !== 0 && iy !== 0;
                    if (isDiagonal) {
                        if (!this.grid[y][x + ix] || !this.grid[y + iy][x]) continue;
                    }
                    neighbors.push({ x: nx, y: ny });
                }
            }
        }
        return neighbors;
    }

    private isValid(x: number, y: number): boolean {
        return y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[0].length;
    }

    private reconstructPath(node: Node): Node[] {
        const path: Node[] = [];
        let current: Node | null = node;
        while (current) {
            path.unshift({ x: current.x, y: current.y });
            current = current.parent || null;
        }
        return path;
    }
}
