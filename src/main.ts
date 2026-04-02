import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { CoordConverter } from './engine/CoordConverter';
import { AssetManager } from './game/AssetManager';
import { WaveController } from './game/WaveController';

// Initialize the constants
const WORLD_SIZE = 20; // 世界大小（網格單位）
const converter = new CoordConverter(64, 32); // 坐標轉換器（網格寬度64像素，高32像素）

// Colors for Ghibli Forest style
const COLORS = {
    SKY: 0x051F10, // 天空顏色（深森林色）
    MOSS_LIGHT: 0x3E8E41, // 淺苔蘚色
    MOSS_DARK: 0x1E4620, // 深苔蘚色
    STONE: 0x5D5D4D, // 石頭顏色（苔蘚石）
    MOUSE: 0xDDDDDD, // 老鼠顏色
    MOUSE_EAR: 0xFFB6C1, // 老鼠耳朵顏色
    SLIME: 0x88CC88, // 史萊姆顏色（森林史萊姆）
    MUSHROOM: 0xFF4D4D, // 蘑菇顏色
    GOD_RAY: 0xFFFFEE, // 神光顏色
    FIREFLY: 0xFFFF88, // 螢火蟲顏色
};

/**
 * Base class for all moving entities in the world.
 */
class BaseEntity extends PIXI.Container {
    protected converter: CoordConverter;
    protected body: PIXI.Container;
    protected speed: number = 2; // 移動速度
    public hp: number = 10; // 當前生命值
    public maxHp: number = 10; // 最大生命值
    public isDead: boolean = false; // 是否死亡
    protected flashTimer: number = 0; // 閃爍效果計時器
    protected targetX: number = 0;
    protected targetY: number = 0;
    protected hasTarget: boolean = false;
    protected targetPosition: { x: number, y: number } | null = null;
    protected targetCartesian: { x: number, y: number } | null = null;
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

    public setTarget(x: number, y: number) {
        this.targetX = x;
        this.targetY = y;
        this.hasTarget = true;
        this.targetPosition = { x, y };
        // Convert to Cartesian pixels for physics
        const cart = this.converter.isoToCartesian(x, y);
        this.targetCartesian = { x: cart.x * 64 + 32, y: cart.y * 64 + 32 };
    }

    public update(delta: number) {
        // Handle movement towards target position using physics
        if (this.targetCartesian) {
            const body = this.world.getPhysicsBody(this);
            if (body) {
                const dx = this.targetCartesian.x - body.position.x;
                const dy = this.targetCartesian.y - body.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 8) { // Closer threshold for precision
                    // Close enough to target, stop moving
                    this.targetPosition = null;
                    this.targetCartesian = null;
                    this.hasTarget = false;
                    Matter.Body.setVelocity(body, { x: 0, y: 0 });
                } else {
                    // Set velocity directly towards target for precise control
                    const normalizedDx = dx / distance;
                    const normalizedDy = dy / distance;
                    const velocityMagnitude = Math.min(this.speed * 2, distance * 0.1); // Cap velocity, reduce near target
                    Matter.Body.setVelocity(body, {
                        x: normalizedDx * velocityMagnitude,
                        y: normalizedDy * velocityMagnitude
                    });
                }
            }
        }

        // Sync sprite position from physics body
        const body = this.world.getPhysicsBody(this);
        if (body) {
            const isoPos = converter.cartesianToIso(body.position.x / 64, body.position.y / 64);
            this.x = isoPos.x;
            this.y = isoPos.y;
            this.zIndex = this.y;
            // Flip the entire body container correctly
            if (Math.abs(body.velocity.x) > 0.1) this.body.scale.x = body.velocity.x > 0 ? 1 : -1;
        }

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
        this.speed = 3; // 玩家移動速度

        this.body = new PIXI.Container();
        const sprite = new PIXI.Sprite(AssetManager.get('mouse'));
        sprite.anchor.set(0.5, 1.0); // Exact feet on ground
        this.addChild(this.body);
        this.body.addChild(sprite);

        this.zIndex = this.y;
        this.width = 64;
        this.scale.y = this.scale.x;
        this.label = 'player';
        this.hp = 100; // 玩家生命值
        this.maxHp = 100; // 玩家最大生命值
    }

    private attackCooldown: number = 0; // 攻擊冷卻時間
    public movementDirection: { x: number, y: number } | null = null;

    public update(delta: number) {
        // Handle movement towards target position using physics
        if (this.targetCartesian) {
            const body = this.world.getPhysicsBody(this);
            if (body) {
                const dx = this.targetCartesian.x - body.position.x;
                const dy = this.targetCartesian.y - body.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 8) {
                    // Close enough to target, stop moving
                    this.targetPosition = null;
                    this.targetCartesian = null;
                    this.movementDirection = null;
                    Matter.Body.setVelocity(body, { x: 0, y: 0 });
                } else {
                    // Set velocity directly towards target for precise control
                    const normalizedDx = dx / distance;
                    const normalizedDy = dy / distance;
                    const velocityMagnitude = Math.min(this.speed * 2.5, distance * 0.15); // Player faster, better control
                    Matter.Body.setVelocity(body, {
                        x: normalizedDx * velocityMagnitude,
                        y: normalizedDy * velocityMagnitude
                    });
                }
            }
        }

        // Sync sprite position from physics body
        const body = this.world.getPhysicsBody(this);
        if (body) {
            const isoPos = converter.cartesianToIso(body.position.x / 64, body.position.y / 64);
            this.x = isoPos.x;
            this.y = isoPos.y;
            this.zIndex = this.y;
            // Flip the entire body container correctly
            if (Math.abs(body.velocity.x) > 0.1) this.body.scale.x = body.velocity.x > 0 ? 1 : -1;
        }

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
        this.attackCooldown = 30; // 攻擊冷卻時間（0.5秒，60fps）

        // Swift Strike Dashing Effect
        const oldX = this.x;
        const oldY = this.y;
        const tx = target.x;
        const ty = target.y;

        // Visual dash (Teleport slightly closer)
        this.x = (this.x + tx) / 2;
        this.y = (this.y + ty) / 2;

        target.takeDamage(2); // 造成2點傷害

        // Smooth return (pseudo-animation)
        setTimeout(() => {
            this.x = oldX;
            this.y = oldY;
        }, 100);
    }

    public setTargetPosition(x: number, y: number) {
        this.targetPosition = { x, y };
        // Convert to Cartesian pixels for physics
        const cart = this.converter.isoToCartesian(x, y);
        this.targetCartesian = { x: cart.x * 64 + 32, y: cart.y * 64 + 32 };
    }

    public clearTargetPosition() {
        this.targetPosition = null;
        this.targetCartesian = null;
    }
}

type AIState = 'IDLE' | 'PATROL' | 'CHASE';
const AIState = {
    IDLE: 'IDLE' as AIState,
    PATROL: 'PATROL' as AIState,
    CHASE: 'CHASE' as AIState
};

class EnemyZombie extends BaseEntity {
    private state: AIState = AIState.IDLE; // AI狀態
    private stateTimer: number = 0; // 狀態計時器

    constructor(converter: CoordConverter, world: IsometricWorld) {
        super(converter, world);
        this.speed = 1 + Math.random() * 1; // 敵人移動速度（1-2之間隨機）

        // Use Ghibli Slime Sprite
        const sprite = new PIXI.Sprite(AssetManager.get('slime'));
        sprite.anchor.set(0.5, 0.85);
        sprite.scale.set(0.1);
        this.body.addChild(sprite);

        this.width = 64;
        this.scale.y = this.scale.x;

        this.hp = 5; // 敵人生命值
        this.maxHp = 5; // 敵人最大生命值
    }

    public update(delta: number) {
        if (this.isDead) return;
        super.update(delta);
        this.stateTimer -= delta;

        if (this.stateTimer <= 0) {
            this.updateAI();
        }

        // Direct movement toward player when chasing (set target position)
        if (this.state === AIState.CHASE && this.world.player && !this.world.player.isDead) {
            const player = this.world.player;
            const dist = Math.sqrt(Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2));

            if (dist > 35) { // 停止追蹤距離閾值（35像素）
                // Always set target position towards player when chasing
                this.setTarget(player.x, player.y);
            } else {
                // Close enough, stop chasing
                this.hasTarget = false;
                this.targetPosition = null;
                this.targetCartesian = null;
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
        if (dist < 200) { // 追蹤玩家距離閾值（200像素）
            if (this.state !== AIState.CHASE) {
                this.state = AIState.CHASE;
                console.log('Zombie: Spoted Player! Chasing...');
            }
            this.isChasingPlayer = true;
            // Don't set target when chasing - use direct movement in update()
            this.stateTimer = 60; // Check less frequently when chasing - 追蹤狀態檢查間隔（60幀）
        }
        // PATROL if player is far
        else {
            if (this.state === AIState.CHASE || !this.hasTarget) {
                this.state = AIState.PATROL;
                this.patrolRandomly();
            }
            this.isChasingPlayer = false;
            this.stateTimer = 120 + Math.random() * 120; // 2-4s - 巡邏狀態檢查間隔（2-4秒）
        }
    }

    private patrolRandomly() {
        // Generate random position within 200 pixels radius - 在200像素半徑內生成隨機位置
        const angle = Math.random() * Math.PI * 2; // 隨機角度
        const distance = Math.random() * 200 + 50; // 隨機距離（50-250像素）
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
    public waveController: WaveController = new WaveController();
    private enemies: BaseEntity[] = [];
    private godRays: PIXI.Graphics[] = [];
    private fireflies: PIXI.Graphics[] = [];
    private hpContainer: PIXI.Container;

    // Physics
    private engine: Matter.Engine;
    private physicsBodies: Map<BaseEntity, Matter.Body> = new Map();

    // Mouse interaction state
    private isMouseDown: boolean = false;
    private mouseTargetX: number = 0;
    private mouseTargetY: number = 0;
    private mouseTargetEnemy: BaseEntity | null = null;

    // HUD Text
    private hudText: PIXI.Text | null = null;
    private globalUI: PIXI.Container;

    public getPhysicsBody(entity: BaseEntity): Matter.Body | undefined {
        return this.physicsBodies.get(entity);
    }

    constructor(globalUI: PIXI.Container) {
        super();
        this.globalUI = globalUI;
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

        // Initialize Physics Engine
        this.engine = Matter.Engine.create();
        this.engine.world.gravity.y = 0; // 禁用重力（2D俯視遊戲）
    }

    public async init() {
        this.x = window.innerWidth / 2;
        this.y = 200; // 世界初始垂直偏移
        this.generateWorldGrid();
        this.initAtmosphere();
        this.initHUD();

        // Spawn Player at grid center
        this.player = new Player(converter, this);
        const playerPos = converter.cartesianToIso(Math.floor(WORLD_SIZE / 2), Math.floor(WORLD_SIZE / 2));
        this.player.x = playerPos.x;
        this.player.y = playerPos.y;
        this.player.zIndex = this.player.y;
        this.worldContainer.addChild(this.player);

        // Create physics body for player
        const playerBody = Matter.Bodies.circle(
            Math.floor(WORLD_SIZE / 2) * 64 + 32, // Cartesian X
            Math.floor(WORLD_SIZE / 2) * 64 + 32, // Cartesian Y
            32, // 物理碰撞半徑
            {
                friction: 1.0, // 增加摩擦力，讓玩家更難被推動
                frictionAir: 0.1, // 增加空氣阻力
                restitution: 0, // 無彈性
                density: 0.01 // 增加密度，讓實體更重更穩定
            }
        );
        Matter.World.add(this.engine.world, playerBody);
        this.physicsBodies.set(this.player, playerBody);

        // Initial Horde
        this.spawnHorde(this.waveController.totalEnemiesToSpawn);

        window.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    private initAtmosphere() {
        // Init 10 God Rays for larger map - 初始化10個神光效果
        for (let i = 0; i < 10; i++) {
            const ray = new PIXI.Graphics();
            ray.poly([0, 0, 100, 600, 250, 600]).fill({ color: COLORS.GOD_RAY, alpha: 0.08 });
            ray.x = -2000 + i * 500; // 神光間距
            ray.y = -300;
            ray.rotation = 0.2;
            this.atmosphereLayer.addChild(ray);
            this.godRays.push(ray);
        }

        // Init 50 Fireflies for larger map - 初始化50個螢火蟲
        for (let i = 0; i < 50; i++) {
            const ff = new PIXI.Graphics();
            ff.circle(0, 0, 1.5).fill(COLORS.FIREFLY);
            ff.x = (Math.random() - 0.5) * 2560; // 螢火蟲分佈範圍
            ff.y = (Math.random() - 0.5) * 1600;
            ff.alpha = Math.random();
            this.atmosphereLayer.addChild(ff);
            this.fireflies.push(ff);
        }
    }

    private initHUD() {
        console.log('Initializing HUD...');

        // Glassmorphism HUD Background (Deep Green Tint)
        const hudBg = new PIXI.Graphics();
        hudBg.roundRect(0, 0, 250, 100, 15).fill(0x112211, 0.8);
        hudBg.x = 10;
        hudBg.y = 10;
        this.globalUI.addChild(hudBg);
        console.log('Added HUD background to globalUI');

        this.hudText = new PIXI.Text({
            text: 'Wave: 1\nEnemies: 0\nHUD Test',
            style: {
                fontFamily: 'Arial, sans-serif',
                fontSize: 22,
                fill: 0xffffff,
                align: 'left',
                dropShadow: { color: 0x000000, blur: 2, distance: 1 }
            }
        });
        this.hudText.x = hudBg.x + 15;
        this.hudText.y = hudBg.y + 15;
        this.globalUI.addChild(this.hudText);
        console.log('Added HUD text to globalUI');
    }

    private spawnHorde(count: number) {
        for (let i = 0; i < count; i++) {
            const zombie = new EnemyZombie(converter, this);
            // Spawn from edges
            const spawnPos = this.waveController.getEdgeSpawnPos(WORLD_SIZE);

            const pos = converter.cartesianToIso(spawnPos.x, spawnPos.y);
            zombie.x = pos.x;
            zombie.y = pos.y;
            zombie.zIndex = zombie.y;
            this.enemies.push(zombie);
            this.worldContainer.addChild(zombie);

            // Create physics body for enemy
            const enemyBody = Matter.Bodies.circle(
                spawnPos.x * 64 + 32,
                spawnPos.y * 64 + 32,
                32, // 物理碰撞半徑
                {
                    friction: 1.0, // 增加摩擦力，讓敵人更難被推動
                    frictionAir: 0.5, // 增加空氣阻力
                    restitution: 0, // 無彈性
                    density: 0.01 // 增加密度，讓實體更重更穩定
                }
            );
            Matter.World.add(this.engine.world, enemyBody);
            this.physicsBodies.set(zombie, enemyBody);
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
                if (Math.random() < 0.25) { // 蕨類生成機率（25%）
                    const fernObj = new StaticProp('Object', 'fern_object', 4);
                    fernObj.x = pos.x;
                    fernObj.y = pos.y;
                    fernObj.zIndex = pos.y; // Standard depth
                    this.worldContainer.addChild(fernObj);

                    // Create physics body for obstacle
                    const obstacleBody = Matter.Bodies.rectangle(
                        x * 64 + 128, // Center X (4*64/2 + x*64)
                        y * 64 + 128, // Center Y
                        256, 256, // Size (4*64)
                        { isStatic: true }
                    );
                    Matter.World.add(this.engine.world, obstacleBody);
                } else if (Math.random() < 0.15) { // 蘑菇生成機率（15%）
                    // Mushrooms (2x2)
                    const mx = x + (Math.random() < 0.5 ? 0 : 2);
                    const my = y + (Math.random() < 0.5 ? 0 : 2);
                    const mushroom = new StaticProp('Object', 'mushroom_object', 2);
                    const mPos = converter.cartesianToIso(mx, my);
                    mushroom.x = mPos.x;
                    mushroom.y = mPos.y;
                    mushroom.zIndex = mPos.y;
                    this.worldContainer.addChild(mushroom);

                    // Create physics body for obstacle
                    const obstacleBody = Matter.Bodies.rectangle(
                        mx * 64 + 64, // Center X (2*64/2 + mx*64)
                        my * 64 + 64, // Center Y
                        128, 128, // Size (2*64)
                        { isStatic: true }
                    );
                    Matter.World.add(this.engine.world, obstacleBody);
                }
            }
        }
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

        // Stop movement when mouse is released
        if (this.player) {
            this.player.clearTargetPosition();
            this.player.movementDirection = null;
        }
    }

    private performActionAtTarget() {
        if (!this.player || this.player.isDead) return;

        if (this.mouseTargetEnemy && !this.mouseTargetEnemy.isDead) {
            // Handle movement towards enemy (attack is handled by timer in update())
            const dist = Math.sqrt(Math.pow(this.mouseTargetEnemy.x - this.player.x, 2) + Math.pow(this.mouseTargetEnemy.y - this.player.y, 2));
            if (dist < 60) { // 停止移動的攻擊範圍（60像素）
                // Close enough - stop moving (attack handled by timer)
                this.player.clearTargetPosition();
                this.player.movementDirection = null;
            } else {
                // Set target position towards enemy
                this.player.setTargetPosition(this.mouseTargetEnemy.x, this.mouseTargetEnemy.y);
            }
        } else {
            // Set target position towards mouse position
            this.player.setTargetPosition(this.mouseTargetX, this.mouseTargetY);
        }
    }

    public update(delta: number) {
        // Update physics engine
        Matter.Engine.update(this.engine, delta * 16.67); // Convert delta to milliseconds

        if (this.player) this.player.update(delta);

        // Camera follow player smoothly
        if (this.player) {
            const targetWorldX = window.innerWidth / 2 - this.player.x;
            const targetWorldY = window.innerHeight / 2 - this.player.y + 100; // 垂直偏移量
            this.x += (targetWorldX - this.x) * 0.05; // 相機跟隨平滑度
            this.y += (targetWorldY - this.y) * 0.05;
        }

        // Keep atmosphere effects in world coordinates (compensate for camera movement)
        this.atmosphereLayer.x = -this.x * 0.1; // 視差效果強度
        this.atmosphereLayer.y = -this.y * 0.1;

        // Handle continuous attack when mouse is held down over enemy
        if (this.isMouseDown && this.mouseTargetEnemy && !this.mouseTargetEnemy.isDead && this.player && !this.player.isDead) {
            const dist = Math.sqrt(Math.pow(this.mouseTargetEnemy.x - this.player.x, 2) + Math.pow(this.mouseTargetEnemy.y - this.player.y, 2));
            if (dist < 60) { // 攻擊範圍（60像素）
                this.player.attack(this.mouseTargetEnemy);
            }
        }

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

        const globalUI = new PIXI.Container();
        // app.stage.addChild(globalUI); // Move after world

        const world = new IsometricWorld(globalUI);
        console.log('Main: Initializing World...');
        await world.init();
        app.stage.addChild(world);
        console.log('Main: World added to stage.');

        app.stage.addChild(globalUI); // Add globalUI after world so it's on top

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
