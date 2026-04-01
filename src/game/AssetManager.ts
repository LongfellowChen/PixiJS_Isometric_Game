import * as PIXI from 'pixi.js';

export class AssetManager {
    public static textures: Record<string, PIXI.Texture> = {};

    private static manifest = [
        // NPCs
        { alias: 'mouse', src: '/assets/NPCs/1x1/The Mouse Hero.png' },
        { alias: 'slime', src: '/assets/NPCs/1x1/Forest Slime.png' },
        
        // Tiles (Ground Floor)
        { alias: 'moss_floor', src: '/assets/Tiles/4x4/Mossy Forest Tile.png' },
        
        // Objects (Non-walkable obstacles)
        { alias: 'fern_object', src: '/assets/Objects/4x4/Mystical Ferns.png' },
        { alias: 'mushroom_object', src: '/assets/Objects/2x2/Glowing Mushrooms.png' },
    ];

    public static async load() {
        console.log('AssetManager: Starting load...');
        for (const item of this.manifest) {
            try {
                console.log(`AssetManager: Loading ${item.alias} from ${item.src}`);
                const texture = await PIXI.Assets.load(item.src);
                this.textures[item.alias] = texture;
            } catch (err) {
                console.error(`AssetManager: Failed to load ${item.alias}:`, err);
            }
        }
        console.log('AssetManager: Assets loaded:', Object.keys(this.textures));
    }

    public static get(alias: string): PIXI.Texture {
        const tex = this.textures[alias];
        if (!tex) throw new Error(`Texture ${alias} not found!`);
        return tex;
    }
}
