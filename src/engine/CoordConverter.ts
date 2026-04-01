export class CoordConverter {
    private halfWidth: number;
    private halfHeight: number;

    constructor(tileWidth: number = 64, tileHeight: number = 32) {
        this.halfWidth = tileWidth / 2;
        this.halfHeight = tileHeight / 2;
    }

    /**
     * Converts grid (Cartesian) coordinates to screen (Isometric) coordinates.
     * @param gridX Logical X position in the grid
     * @param gridY Logical Y position in the grid
     * @returns { x: number, y: number } Screen coordinates
     */
    public cartesianToIso(gridX: number, gridY: number): { x: number, y: number } {
        return {
            x: (gridX - gridY) * this.halfWidth,
            y: (gridX + gridY) * this.halfHeight
        };
    }

    /**
     * Converts screen (Isometric) coordinates back to grid (Cartesian) coordinates.
     * @param screenX Screen space X coordinate
     * @param screenY Screen space Y coordinate
     * @returns { x: number, y: number } Logical grid coordinates
     */
    public isoToCartesian(screenX: number, screenY: number): { x: number, y: number } {
        const x = (screenX / this.halfWidth + screenY / this.halfHeight) / 2;
        const y = (screenY / this.halfHeight - screenX / this.halfWidth) / 2;
        return { x, y };
    }

    /**
     * Snaps screen coordinates to the nearest grid center.
     */
    public snapToGrid(screenX: number, screenY: number): { x: number, y: number } {
        const cart = this.isoToCartesian(screenX, screenY);
        return this.cartesianToIso(Math.floor(cart.x), Math.floor(cart.y));
    }
}
