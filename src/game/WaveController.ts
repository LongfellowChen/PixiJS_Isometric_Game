export interface WaveData {
    waveNumber: number;
    enemyCount: number;
    spawnRate: number; // Enemies per wave
}

/**
 * Manages the difficulty progression and enemy spawning waves over time.
 */
export class WaveController {
    public currentWave: number = 0;
    public totalEnemiesToSpawn: number = 0;
    public spawnedInCurrentWave: number = 0;
    public waveTimer: number = 30 * 60; // 30 seconds (assuming 60 FPS)
    public timerRemaining: number = 0;

    constructor() {
        this.nextWave();
    }

    /**
     * Advances to the next wave and updates spawn parameters.
     */
    public nextWave(): WaveData {
        this.currentWave++;
        this.spawnedInCurrentWave = 0;
        this.totalEnemiesToSpawn = 5 + (this.currentWave - 1) * 3;
        this.timerRemaining = this.waveTimer;

        console.log(`WaveController: Starting Wave ${this.currentWave} - Spawning ${this.totalEnemiesToSpawn} enemies.`);
        
        return {
            waveNumber: this.currentWave,
            enemyCount: this.totalEnemiesToSpawn,
            spawnRate: 1 // For now, spawn all at once or handle elsewhere
        };
    }

    /**
     * Updates the internal timer to trigger the next wave.
     */
    public update(delta: number): boolean {
        this.timerRemaining -= delta;
        if (this.timerRemaining <= 0) {
            this.nextWave();
            return true; // New wave started
        }
        return false;
    }

    /**
     * Picks a random edge tile on the grid for spawning.
     */
    public getEdgeSpawnPos(worldSize: number): { x: number, y: number } {
        const edge = Math.floor(Math.random() * 4);
        let x = 0, y = 0;

        switch (edge) {
            case 0: // Top edge
                x = Math.floor(Math.random() * worldSize);
                y = 0;
                break;
            case 1: // Bottom edge
                x = Math.floor(Math.random() * worldSize);
                y = worldSize - 1;
                break;
            case 2: // Left edge
                x = 0;
                y = Math.floor(Math.random() * worldSize);
                break;
            case 3: // Right edge
                x = worldSize - 1;
                y = Math.floor(Math.random() * worldSize);
                break;
        }

        return { x, y };
    }
}
