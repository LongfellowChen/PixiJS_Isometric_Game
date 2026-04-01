import * as PIXI from 'pixi.js';
import { CoordConverter } from './engine/CoordConverter';
import { AssetManager } from './game/AssetManager';
import { Pathfinder } from './engine/Pathfinder';
import { WaveController } from './game/WaveController';
import type { Node } from './engine/Pathfinder';

// Initialize the constants
const WORLD_SIZE = 20;
const converter = new CoordConverter(64, 32);
const TILE_CENTER_OFFSET = {
    X: 32 - 32,   // 64 / 2
    Y: 32 - 8   // ← 關鍵！原本 16 改成 28（或 26~30 之間微調）
};

// Colors for Ghibli Forest style
const COLORS = {
    SKY: 0x051F10, // Forest Deep
    MOSS_LIGHT: 0x3E8E41,
    MOSS_DARK: 0x1E4620,
    STONE: 0x5D5D4D, // Mossy Stone
    MOUSE: 0xDDDDDD,
    MOUSE_EAR: 0xFFB6C1,
    SLIME: 0x88CC88, // Forest Slime
    MUSHROOM: 0xFF4D4D,
    GOD_RAY: 0xFFFFEE,
    FIREFLY: 0xFFFF88,
};

/**
 * Base class for all moving entities in the world.
 */
class BaseEntity extends PIXI.Container {
    protected path: Node[] = [];
    protected converter: CoordConverter;
    protected body: PIXI.Container;
    protected speed: number = 2;
    public hp: number = 10;
    public maxHp: number = 10;
    public isDead: boolean = false;
    protected flashTimer: number = 0;
    protected targetX: number = 0;
    protected targetY: number = 0;
    protected hasTarget: boolean = false;
    protected world: IsometricWorld;
    public isChasingPlayer: boolean = false;

    constructor(converter: CoordConverter, world: IsometricWorld) {
        super();
        this.converter = converter;
        this.world = world;

        // Shadow (semi-transparent black ellipse)
        const shadow = new PIXI.Graphics();
        shadow.ellipse(0, 0, 12, 6).fill({ color: 0x000000, alpha: 0.2 });
        this.addChild(shadow);

        this.body = new PIXI.Container();
        this.addChild(this.body);
    }

    public setPath(path: Node[]) {
        this.path = path;
    }

    public setTarget(x: number, y: number) {
        this.targetX = x;
        this.targetY = y;
        this.hasTarget = true;
    }

    public update(delta: number) {
        // Free movement towards target (used by enemies)
        if (this.hasTarget) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 2) {
                const vx = (dx / distance) * this.speed * delta;
                const vy = (dy / distance) * this.speed * delta;

                // Check if the new position would be blocked
                const newX = this.x + vx;
                const newY = this.y + vy;

                if (this.world.canMoveToWithEntities(this.x, this.y, newX, newY, this)) {
                    this.x = newX;
                    this.y = newY;
                    // Flip the entire body container correctly
                    if (Math.abs(vx) > 0.1) this.body.scale.x = vx > 0 ? 1 : -1;
                } else {
                    // Only try to slide around obstacles if chasing player
                    if (this.isChasingPlayer && this.trySlideAroundObstacle(vx, vy, delta)) {
                        // Successfully slid around obstacle
                    } else {
                        // Can't move to target, clear target to stop trying
                        this.hasTarget = false;
                    }
                }
            } else {
                // Check if we can reach the exact target position
                if (this.world.canMoveToWithEntities(this.x, this.y, this.targetX, this.targetY, this)) {
                    this.x = this.targetX;
                    this.y = this.targetY;
                }
                this.hasTarget = false;
            }
        }

        this.zIndex = this.y;

        // Flash Effect
        if (this.flashTimer > 0) {
            this.flashTimer -= delta;
            this.body.alpha = 0.5 + Math.sin(Date.now() * 0.1) * 0.5;
            if (this.flashTimer <= 0) {
                this.body.alpha = 1;
                this.body.tint = 0xFFFFFF;
            }
        }
    }

    public takeDamage(amount: number) {
        if (this.isDead) return;
        this.hp -= amount;
        this.flashTimer = 15; // 0.25s at 60fps
        this.body.tint = 0xFF8888; // Reddish tint

        // Squash feedback
        this.body.scale.y = 0.8;
        setTimeout(() => { if (!this.isDead) this.body.scale.y = 1; }, 100);

        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    protected die() {
        this.isDead = true;
        this.alpha = 0; // Hide but keep for cleanup
    }

    protected trySlideAroundObstacle(vx: number, vy: number, delta: number): boolean {
        // Try to slide along obstacle boundaries by attempting multiple perpendicular movements
        const slideDistances = [10, 20, 30]; // Try different slide distances
        const slideAngles = [-90, -60, -30, 30, 60, 90]; // Try multiple angles around perpendicular

        // Calculate original movement direction
        const moveLength = Math.sqrt(vx * vx + vy * vy);
        if (moveLength === 0) return false;

        const moveDirX = vx / moveLength;
        const moveDirY = vy / moveLength;

        // Try different slide directions
        for (const angle of slideAngles) {
            const radAngle = (angle * Math.PI) / 180;

            // Rotate movement direction by angle to get slide direction
            const cos = Math.cos(radAngle);
            const sin = Math.sin(radAngle);
            const slideDirX = moveDirX * cos - moveDirY * sin;
            const slideDirY = moveDirX * sin + moveDirY * cos;

            // Try different distances for this direction
            for (const distance of slideDistances) {
                const slideX = this.x + slideDirX * distance * delta;
                const slideY = this.y + slideDirY * distance * delta;

                if (this.world.canMoveToWithEntities(this.x, this.y, slideX, slideY, this)) {
                    this.x = slideX;
                    this.y = slideY;
                    // Update facing direction based on slide direction
                    if (Math.abs(slideDirX) > 0.1) this.body.scale.x = slideDirX > 0 ? 1 : -1;
                    return true;
                }
            }
        }

        return false;
    }

    public getGridPos(): { x: number, y: number } {
        const cart = this.converter.isoToCartesian(this.x, this.y);
        const gx = Math.floor(cart.x + 0.1);
        const gy = Math.floor(cart.y + 0.1);
        return { x: gx, y: gy };
    }
}

class Player extends BaseEntity {
    constructor(converter: CoordConverter, world: IsometricWorld) {
        super(converter, world);
        this.speed = 3;

        this.body = new PIXI.Container();
        const sprite = new PIXI.Sprite(AssetManager.get('mouse'));
        sprite.anchor.set(0.5, 1.0); // Exact feet on ground
        this.addChild(this.body);
        this.body.addChild(sprite);

        this.zIndex = this.y;
        this.width = 64;
        this.scale.y = this.scale.x;
        this.label = 'player';
        this.hp = 100;
        this.maxHp = 100;
    }

    private attackCooldown: number = 0;

    public update(delta: number) {
        // Handle path-based movement for player
        if (this.path.length > 0) {
            const targetNode = this.path[0];
            const targetPos = this.converter.cartesianToIso(targetNode.x, targetNode.y);
            const tx = targetPos.x + TILE_CENTER_OFFSET.X;
            const ty = targetPos.y + TILE_CENTER_OFFSET.Y;

            const dx = tx - this.x;
            const dy = ty - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 2) {
                const vx = (dx / distance) * this.speed * delta;
                const vy = (dy / distance) * this.speed * delta;

                // Check if the new position would be blocked
                const newX = this.x + vx;
                const newY = this.y + vy;

                if (this.world.canMoveToWithEntities(this.x, this.y, newX, newY, this)) {
                    this.x = newX;
                    this.y = newY;
                    // Flip the entire body container correctly
                    if (Math.abs(vx) > 0.1) this.body.scale.x = vx > 0 ? 1 : -1;
                } else {
                    // Try to move around obstacles by sliding along boundaries
                    if (!this.trySlideAroundObstacle(vx, vy, delta)) {
                        // Can't move along path and can't slide around, clear path to stop
                        this.path = [];
                    }
                }
            } else {
                this.x = tx;
                this.y = ty;
                this.path.shift();
            }
        }

        this.zIndex = this.y;

        // Flash Effect
        if (this.flashTimer > 0) {
            this.flashTimer -= delta;
            this.body.alpha = 0.5 + Math.sin(Date.now() * 0.1) * 0.5;
            if (this.flashTimer <= 0) {
                this.body.alpha = 1;
                this.body.tint = 0xFFFFFF;
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown -= delta;
    }

    public attack(target: BaseEntity) {
        if (this.attackCooldown > 0 || this.isDead) return;
        this.attackCooldown = 30; // 0.5s cooldown

        // Swift Strike Dashing Effect
        const oldX = this.x;
        const oldY = this.y;
        const tx = target.x;
        const ty = target.y;

        // Visual dash (Teleport slightly closer)
        this.x = (this.x + tx) / 2;
        this.y = (this.y + ty) / 2;

        target.takeDamage(2);

        // Smooth return (pseudo-animation)
        setTimeout(() => {
            this.x = oldX;
            this.y = oldY;
        }, 100);
    }

    public clearPath() {
        this.path = [];
    }
}

type AIState = 'IDLE' | 'PATROL' | 'CHASE';
const AIState = {
    IDLE: 'IDLE' as AIState,
    PATROL: 'PATROL' as AIState,
    CHASE: 'CHASE' as AIState
};

class EnemyZombie extends BaseEntity {
    private state: AIState = AIState.IDLE;
    private stateTimer: number = 0;

    constructor(converter: CoordConverter, world: IsometricWorld) {
        super(converter, world);
        this.speed = 1 + Math.random() * 1;

        // Use Ghibli Slime Sprite
        const sprite = new PIXI.Sprite(AssetManager.get('slime'));
        sprite.anchor.set(0.5, 0.85);
        sprite.scale.set(0.1);
        this.body.addChild(sprite);

        this.width = 64;
        this.scale.y = this.scale.x;

        this.hp = 5;
        this.maxHp = 5;
    }

    public update(delta: number) {
        if (this.isDead) return;
        super.update(delta);
        this.stateTimer -= delta;

        if (this.stateTimer <= 0) {
            this.updateAI();
        }

        // Direct movement toward player when chasing (bypass target system)
        if (this.state === AIState.CHASE && this.world.player && !this.world.player.isDead) {
            const player = this.world.player;
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 25) { // Keep some minimum distance
                const moveSpeed = this.speed * delta * 0.8; // Slightly slower than normal
                const moveX = (dx / dist) * moveSpeed;
                const moveY = (dy / dist) * moveSpeed;

                // Try to move toward player, but respect obstacles
                const newX = this.x + moveX;
                const newY = this.y + moveY;

                if (this.world.canMoveToWithEntities(this.x, this.y, newX, newY, this)) {
                    this.x = newX;
                    this.y = newY;
                    // Update facing direction
                    if (Math.abs(moveX) > 0.1) this.body.scale.x = moveX > 0 ? 1 : -1;
                }
            }
        }
    }

    private updateAI() {
        const player = this.world.player;
        if (!player) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // CHASE if player is close (within 200 pixels)
        if (dist < 200) {
            if (this.state !== AIState.CHASE) {
                this.state = AIState.CHASE;
                console.log('Zombie: Spoted Player! Chasing...');
            }
            this.isChasingPlayer = true;
            // Don't set target when chasing - use direct movement in update()
            this.stateTimer = 60; // Check less frequently when chasing
        }
        // PATROL if player is far
        else {
            if (this.state === AIState.CHASE || !this.hasTarget) {
                this.state = AIState.PATROL;
                this.patrolRandomly();
            }
            this.isChasingPlayer = false;
            this.stateTimer = 120 + Math.random() * 120; // 2-4s
        }
    }

    private patrolRandomly() {
        // Generate random position within 200 pixels radius
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 200 + 50;
        const tx = this.x + Math.cos(angle) * distance;
        const ty = this.y + Math.sin(angle) * distance;
        this.setTarget(tx, ty);
    }


}

// Main Game World container
class IsometricWorld extends PIXI.Container {
    private worldContainer: PIXI.Container;
    private atmosphereLayer: PIXI.Container;
    private uiLayer: PIXI.Container;
    public player: Player | null = null;
    public navGrid: boolean[][] = [];
    public pathfinder: Pathfinder | null = null;
    public waveController: WaveController = new WaveController();
    private enemies: BaseEntity[] = [];
    private godRays: PIXI.Graphics[] = [];
    private fireflies: PIXI.Graphics[] = [];
    private hpContainer: PIXI.Container;

    // Mouse interaction state
    private isMouseDown: boolean = false;
    private mouseTargetX: number = 0;
    private mouseTargetY: number = 0;
    private mouseTargetEnemy: BaseEntity | null = null;

    // HUD Text
    private hudText: PIXI.Text | null = null;

    constructor() {
        super();
        this.sortableChildren = true;
        this.worldContainer = new PIXI.Container();
        this.worldContainer.sortableChildren = true;
        this.atmosphereLayer = new PIXI.Container();
        this.uiLayer = new PIXI.Container();

        this.addChild(this.worldContainer);
        this.addChild(this.atmosphereLayer);
        this.addChild(this.uiLayer);

        // Setup Health Bar Layer (Background)
        this.hpContainer = new PIXI.Container();
        this.addChild(this.hpContainer);

        for (let y = 0; y < WORLD_SIZE; y++) {
            this.navGrid[y] = [];
            for (let x = 0; x < WORLD_SIZE; x++) {
                this.navGrid[y][x] = true;
            }
        }
        this.pathfinder = new Pathfinder(this.navGrid);
    }

    public async init() {
        this.x = window.innerWidth / 2;
        this.y = 200; // Shifting down for 20x20
        this.generateWorldGrid();
        this.initAtmosphere();
        this.initHUD();

        // Spawn Player at grid center
        this.player = new Player(converter, this);
        const playerPos = converter.cartesianToIso(Math.floor(WORLD_SIZE / 2), Math.floor(WORLD_SIZE / 2));
        this.player.x = playerPos.x + TILE_CENTER_OFFSET.X;
        this.player.y = playerPos.y + TILE_CENTER_OFFSET.Y;
        this.player.zIndex = this.player.y;
        this.worldContainer.addChild(this.player);

        // Initial Horde
        this.spawnHorde(this.waveController.totalEnemiesToSpawn);

        window.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    private initAtmosphere() {
        // Init 3 God Rays
        for (let i = 0; i < 3; i++) {
            const ray = new PIXI.Graphics();
            ray.poly([0, 0, 100, 600, 250, 600]).fill({ color: COLORS.GOD_RAY, alpha: 0.08 });
            ray.x = -800 + i * 400;
            ray.y = -300;
            ray.rotation = 0.2;
            this.atmosphereLayer.addChild(ray);
            this.godRays.push(ray);
        }

        // Init Fireflies
        for (let i = 0; i < 20; i++) {
            const ff = new PIXI.Graphics();
            ff.circle(0, 0, 1.5).fill(COLORS.FIREFLY);
            ff.x = (Math.random() - 0.5) * 1280;
            ff.y = (Math.random() - 0.5) * 800;
            ff.alpha = Math.random();
            this.atmosphereLayer.addChild(ff);
            this.fireflies.push(ff);
        }
    }

    private initHUD() {
        // Glassmorphism HUD Background (Deep Green Tint)
        const hudBg = new PIXI.Graphics();
        hudBg.roundRect(0, 0, 250, 100, 15).fill({ color: 0x112211, alpha: 0.6 });
        hudBg.stroke({ color: 0xFFFFFF, width: 0.5, alpha: 0.2 });
        hudBg.x = -window.innerWidth / 2 + 10;
        hudBg.y = -190;
        this.uiLayer.addChild(hudBg);

        this.hudText = new PIXI.Text({
            text: 'Wave: 1\nEnemies: 0',
            style: {
                fontFamily: 'Comic Sans MS, cursive, sans-serif',
                fontSize: 22,
                fill: 0xffffff,
                align: 'left',
                dropShadow: { color: COLORS.SLIME, blur: 2, distance: 1 }
            }
        });
        this.hudText.x = hudBg.x + 15;
        this.hudText.y = hudBg.y + 15;
        this.uiLayer.addChild(this.hudText);
    }

    private spawnHorde(count: number) {
        for (let i = 0; i < count; i++) {
            const zombie = new EnemyZombie(converter, this);
            // Spawn from edges
            let spawnPos;
            let attempts = 0;
            do {
                spawnPos = this.waveController.getEdgeSpawnPos(WORLD_SIZE);
                attempts++;
            } while (!this.navGrid[spawnPos.y][spawnPos.x] && attempts < 10);

            const pos = converter.cartesianToIso(spawnPos.x, spawnPos.y);
            zombie.x = pos.x + TILE_CENTER_OFFSET.X;
            zombie.y = pos.y + TILE_CENTER_OFFSET.Y;
            zombie.zIndex = zombie.y;
            this.enemies.push(zombie);
            this.worldContainer.addChild(zombie);
        }
        this.updateHUD();
    }

    private generateWorldGrid() {
        // First Pass: Lay all ground tiles
        for (let x = 0; x < WORLD_SIZE; x += 4) {
            for (let y = 0; y < WORLD_SIZE; y += 4) {
                const pos = converter.cartesianToIso(x, y);
                const tile = new StaticProp('Tile', 'moss_floor', 4);
                tile.x = pos.x;
                tile.y = pos.y;
                tile.zIndex = pos.y - 1; // Ensure terrain is always below objects/NPCs at same Y
                this.worldContainer.addChild(tile);
            }
        }

        // Second Pass: Place objects and obstacles
        for (let x = 0; x < WORLD_SIZE; x += 4) {
            for (let y = 0; y < WORLD_SIZE; y += 4) {
                const isCenter = (x >= 8 && x <= 12 && y >= 8 && y <= 12);
                if (isCenter) continue;

                const pos = converter.cartesianToIso(x, y);

                // Ferns (4x4)
                if (Math.random() < 0.25) {
                    const fernObj = new StaticProp('Object', 'fern_object', 4);
                    fernObj.x = pos.x;
                    fernObj.y = pos.y;
                    fernObj.zIndex = pos.y; // Standard depth
                    this.markAreaBlocked(x, y, 4, 4);
                    this.worldContainer.addChild(fernObj);
                } else if (Math.random() < 0.15) {
                    // Mushrooms (2x2)
                    const mx = x + (Math.random() < 0.5 ? 0 : 2);
                    const my = y + (Math.random() < 0.5 ? 0 : 2);
                    const mushroom = new StaticProp('Object', 'mushroom_object', 2);
                    const mPos = converter.cartesianToIso(mx, my);
                    mushroom.x = mPos.x;
                    mushroom.y = mPos.y;
                    mushroom.zIndex = mPos.y;
                    this.markAreaBlocked(mx, my, 2, 2);
                    this.worldContainer.addChild(mushroom);
                }
            }
        }
        if (this.pathfinder) this.pathfinder.updateGrid(this.navGrid);
    }

    private handleMouseDown(e: MouseEvent) {
        if (!this.player || this.player.isDead) return;

        this.isMouseDown = true;
        this.mouseTargetX = e.clientX - this.x;
        this.mouseTargetY = e.clientY - this.y;

        // Check if clicking an enemy
        const clickedEnemy = this.enemies.find(enemy => {
            const dx = enemy.x - this.mouseTargetX;
            const dy = enemy.y - this.mouseTargetY;
            return Math.sqrt(dx * dx + dy * dy) < 40 && !enemy.isDead;
        });

        if (clickedEnemy) {
            this.mouseTargetEnemy = clickedEnemy;
        } else {
            this.mouseTargetEnemy = null;
        }

        // Start action immediately
        this.performActionAtTarget();
    }

    private handleMouseMove(e: MouseEvent) {
        if (!this.isMouseDown || !this.player || this.player.isDead) return;

        // Update target position while mouse is held down
        this.mouseTargetX = e.clientX - this.x;
        this.mouseTargetY = e.clientY - this.y;

        // Check if now hovering over an enemy
        const hoveredEnemy = this.enemies.find(enemy => {
            const dx = enemy.x - this.mouseTargetX;
            const dy = enemy.y - this.mouseTargetY;
            return Math.sqrt(dx * dx + dy * dy) < 40 && !enemy.isDead;
        });

        this.mouseTargetEnemy = hoveredEnemy || null;

        // Update action based on new target
        this.performActionAtTarget();
    }

    private handleMouseUp(e: MouseEvent) {
        if (!this.isMouseDown) return;

        this.isMouseDown = false;

        // Final target position when mouse is released
        this.mouseTargetX = e.clientX - this.x;
        this.mouseTargetY = e.clientY - this.y;

        // Check final enemy target
        const finalEnemy = this.enemies.find(enemy => {
            const dx = enemy.x - this.mouseTargetX;
            const dy = enemy.y - this.mouseTargetY;
            return Math.sqrt(dx * dx + dy * dy) < 40 && !enemy.isDead;
        });

        this.mouseTargetEnemy = finalEnemy || null;

        // Set final path to the release position
        this.performActionAtTarget();
    }

    private performActionAtTarget() {
        if (!this.player || this.player.isDead) return;

        if (this.mouseTargetEnemy && !this.mouseTargetEnemy.isDead) {
            // Always move towards enemy, attack when close enough
            const dist = Math.sqrt(Math.pow(this.mouseTargetEnemy.x - this.player.x, 2) + Math.pow(this.mouseTargetEnemy.y - this.player.y, 2));
            if (dist < 50) {
                // Very close - stop moving and attack if mouse is held down
                this.player.clearPath(); // Stop moving
                if (this.isMouseDown) {
                    // Only attack while mouse is held down
                    this.player.attack(this.mouseTargetEnemy);
                }
            } else {
                // Move towards enemy using pathfinding
                if (this.pathfinder) {
                    const enemyGridPos = this.mouseTargetEnemy.getGridPos();
                    const start = this.player.getGridPos();
                    const rawPath = this.pathfinder.findPath(start.x, start.y, enemyGridPos.x, enemyGridPos.y);
                    if (rawPath && rawPath.length > 0) {
                        // Smooth the path to avoid sharp corners
                        const smoothedPath = this.smoothPath(rawPath);
                        // Offset path points to centers and convert to screen coordinates
                        const path = smoothedPath.map(p => ({
                            x: p.x,
                            y: p.y,
                            screenX: converter.cartesianToIso(p.x, p.y).x + TILE_CENTER_OFFSET.X,
                            screenY: converter.cartesianToIso(p.x, p.y).y + TILE_CENTER_OFFSET.Y
                        }));
                        this.player.setPath(path as any);
                    }
                }
            }
        } else {
            // Move directly to target position (no pathfinding for player)
            const cart = converter.isoToCartesian(this.mouseTargetX, this.mouseTargetY);
            const gx = Math.round(cart.x);
            const gy = Math.round(cart.y);

            if (gx >= 0 && gx < WORLD_SIZE && gy >= 0 && gy < WORLD_SIZE && this.navGrid[gy][gx]) {
                // Create a direct path to the target
                const directPath = [{
                    x: gx,
                    y: gy,
                    screenX: this.mouseTargetX,
                    screenY: this.mouseTargetY
                }];
                this.player.setPath(directPath as any);
            }
        }
    }

    private markAreaBlocked(x: number, y: number, w: number, h: number) {
        for (let i = x; i < x + w; i++) {
            for (let j = y; j < y + h; j++) {
                this.navGrid[j][i] = false;
            }
        }
    }

    private isPositionBlocked(screenX: number, screenY: number): boolean {
        // Convert screen coordinates to grid coordinates
        const cart = converter.isoToCartesian(screenX, screenY);
        const gx = Math.floor(cart.x);
        const gy = Math.floor(cart.y);

        // Check bounds
        if (gx < 0 || gy < 0 || gx >= WORLD_SIZE || gy >= WORLD_SIZE) {
            return true; // Out of bounds is blocked
        }

        // Check if grid position is blocked - use circular collision for smoother movement
        if (!this.navGrid[gy][gx]) {
            return true; // Center grid is blocked
        }

        // Check adjacent grids in a small radius for smoother collision
        const checkRadius = 0.7; // Check within 0.7 grid units
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip center, already checked

                const checkGx = gx + dx;
                const checkGy = gy + dy;

                if (checkGx >= 0 && checkGx < WORLD_SIZE && checkGy >= 0 && checkGy < WORLD_SIZE) {
                    // Calculate distance from center of checked grid to our position
                    const gridCenterX = checkGx + 0.5;
                    const gridCenterY = checkGy + 0.5;
                    const distance = Math.sqrt((cart.x - gridCenterX) ** 2 + (cart.y - gridCenterY) ** 2);

                    // If blocked grid is close enough and we're near its edge, consider it blocked
                    if (!this.navGrid[checkGy][checkGx] && distance < checkRadius) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    public canMoveTo(fromX: number, fromY: number, toX: number, toY: number): boolean {
        // Check if the target position is blocked
        if (this.isPositionBlocked(toX, toY)) {
            return false;
        }

        // For more precise collision, check intermediate points along the path
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) { // Only check if moving more than 5 pixels
            const steps = Math.ceil(distance / 5);
            for (let i = 1; i <= steps; i++) {
                const ratio = i / steps;
                const checkX = fromX + dx * ratio;
                const checkY = fromY + dy * ratio;
                if (this.isPositionBlocked(checkX, checkY)) {
                    return false;
                }
            }
        }

        return true;
    }

    private smoothPath(rawPath: Node[]): Node[] {
        if (rawPath.length <= 2) return rawPath;

        const smoothedPath: Node[] = [rawPath[0]];

        for (let i = 1; i < rawPath.length - 1; i++) {
            const prev = rawPath[i - 1];
            const curr = rawPath[i];
            const next = rawPath[i + 1];

            // Check if this is a corner (direction change)
            const prevDirX = curr.x - prev.x;
            const prevDirY = curr.y - prev.y;
            const nextDirX = next.x - curr.x;
            const nextDirY = next.y - curr.y;

            // If direction changed, add intermediate points for smoother turning
            if ((prevDirX !== nextDirX || prevDirY !== nextDirY) && (prevDirX !== 0 || prevDirY !== 0) && (nextDirX !== 0 || nextDirY !== 0)) {
                // Add intermediate point at 0.5 distance
                const midX = prev.x + (curr.x - prev.x) * 0.5;
                const midY = prev.y + (curr.y - prev.y) * 0.5;
                smoothedPath.push({ x: midX, y: midY });
            }

            smoothedPath.push(curr);
        }

        // Add the last point
        smoothedPath.push(rawPath[rawPath.length - 1]);

        return smoothedPath;
    }

    private isPositionOccupiedByEntity(screenX: number, screenY: number, excludeEntity?: BaseEntity): boolean {
        const entities = [...this.enemies];
        if (this.player && this.player !== excludeEntity) entities.push(this.player);

        // Check if any entity is close to the target position
        for (const entity of entities) {
            if (entity === excludeEntity || entity.isDead) continue;

            const dx = entity.x - screenX;
            const dy = entity.y - screenY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Consider entities as occupying a 32-pixel radius around their center
            if (distance < 32) {
                return true;
            }
        }

        return false;
    }

    public canMoveToWithEntities(fromX: number, fromY: number, toX: number, toY: number, excludeEntity?: BaseEntity): boolean {
        // First check terrain collision
        if (!this.canMoveTo(fromX, fromY, toX, toY)) {
            return false;
        }

        // Then check entity collision
        return !this.isPositionOccupiedByEntity(toX, toY, excludeEntity);
    }

    public update(delta: number) {
        if (this.player) this.player.update(delta);

        // Handle wave progression
        if (this.waveController.update(delta)) {
            this.spawnHorde(this.waveController.totalEnemiesToSpawn);
        }

        // Atmosphere update (Ghibli Shimmer)
        this.godRays.forEach(ray => {
            ray.alpha = 0.05 + Math.sin(Date.now() * 0.001 + ray.x) * 0.03;
        });
        this.fireflies.forEach((ff, i) => {
            ff.y += Math.sin(Date.now() * 0.001 + i) * 0.2;
            ff.alpha = 0.4 + Math.sin(Date.now() * 0.002 + i) * 0.4;
        });

        // Cleanup Dead Enemies
        this.enemies = this.enemies.filter(enemy => {
            if (enemy.isDead) {
                this.spawnDeathEffect(enemy.x, enemy.y);
                this.worldContainer.removeChild(enemy);
                return false;
            }
            enemy.update(delta);
            return true;
        });

        this.updateHUD();
        this.updateHealthBars();
    }

    private updateHealthBars() {
        this.hpContainer.removeChildren();
        const entities = [...this.enemies];
        if (this.player && !this.player.isDead) entities.push(this.player as any);

        entities.forEach(entity => {
            if (entity.hp >= entity.maxHp) return;
            const bar = new PIXI.Graphics();
            const barWidth = 40;
            const barHeight = 4;
            const ratio = entity.hp / entity.maxHp;

            // BG
            bar.rect(-barWidth / 2, -50, barWidth, barHeight).fill({ color: 0x000000, alpha: 0.3 });
            // Fill (Forest Green)
            bar.rect(-barWidth / 2, -50, barWidth * ratio, barHeight).fill(0x32CD32);

            bar.x = entity.x;
            bar.y = entity.y;
            this.hpContainer.addChild(bar);
        });
    }

    private spawnDeathEffect(x: number, y: number) {
        const smoke = new PIXI.Graphics();
        smoke.circle(0, 0, 10).fill({ color: 0xFFFFFF, alpha: 0.6 });
        smoke.x = x; smoke.y = y - 10;
        this.atmosphereLayer.addChild(smoke);

        let life = 30;
        const tick = (delta: PIXI.Ticker) => {
            life -= delta.deltaTime;
            smoke.alpha = life / 30;
            smoke.scale.set(1 + (30 - life) * 0.05);
            if (life <= 0) {
                this.atmosphereLayer.removeChild(smoke);
                PIXI.Ticker.shared.remove(tick);
            }
        };
        PIXI.Ticker.shared.add(tick);
    }

    private updateHUD() {
        if (this.hudText) {
            this.hudText.text = `Wave: ${this.waveController.currentWave}\nEnemies: ${this.enemies.length}\nNext wave in: ${Math.ceil(this.waveController.timerRemaining / 60)}s`;
        }
    }
}

class StaticProp extends PIXI.Container {
    constructor(category: 'Tile' | 'Object', alias: string, gridSize: number) {
        super();

        const tex = AssetManager.get(alias);
        const sprite = new PIXI.Sprite(tex);

        // Base Normalization: width = 64px * gridSize
        sprite.width = gridSize * 64;
        sprite.scale.y = sprite.scale.x;

        // Align Grass Diamond surface to (0,0) coordinate
        if (category === 'Tile') {
            // Keep very slight offset to prevent Z-fighting, but lower than entity anchors
            sprite.anchor.set(0.5, 0.05);
        } else {
            // Objects are plants/props sitting ON the tiles
            // Use the same alignment as Tiles for better isometric consistency
            // but Objects might need specific anchor.y if they are taller
            if (alias === 'fern_object') {
                sprite.anchor.set(0.5, 0.325); // Refined from previous step
            } else if (alias === 'mushroom_object') {
                // Mushroom 2x2 logic
                sprite.anchor.set(0.5, 0.5); // Start with center for mushrooms
            } else {
                sprite.anchor.set(0.5, 0.9);
            }
        }

        this.addChild(sprite);
    }
}

// PixiJS v8 Application Initialization
async function init() {
    try {
        console.log('Main: Initializing PIXI Application...');
        const app = new PIXI.Application();
        await app.init({
            width: window.innerWidth, height: window.innerHeight,
            backgroundColor: COLORS.SKY, resizeTo: window,
        });
        document.body.appendChild(app.canvas);
        console.log('Main: PIXI Canvas appended.');

        await AssetManager.load();
        console.log('Main: Assets Loaded.');

        const world = new IsometricWorld();
        console.log('Main: Initializing World...');
        await world.init();
        app.stage.addChild(world);
        console.log('Main: World added to stage.');

        app.ticker.add((ticker: PIXI.Ticker) => { world.update(ticker.deltaTime); });
        window.addEventListener('resize', () => {
            world.x = window.innerWidth / 2;
            // HUD repositioning could be handled here too if not relative to world center
        });
    } catch (err) {
        console.error('Main: Critical initialization error:', err);
    }
}

init().catch(err => {
    console.error('Main: Final Init error handler caught:', err);
});
