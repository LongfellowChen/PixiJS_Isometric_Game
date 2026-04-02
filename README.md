# PixiJS Isometric Game

An isometric 2D game built with PixiJS v8, featuring intelligent player movement, enemy AI, and dynamic obstacle avoidance.

## Features

- **PixiJS v8 Implementation**: Modern asynchronous rendering with `app.init()` and `GraphicsContext`
- **Isometric Projection**: 2:1 ratio isometric view with Cartesian ↔ Isometric coordinate conversion
- **Intelligent Movement System**:
  - Player: Direct movement to clicked positions with obstacle avoidance
  - Enemies: AI-driven pursuit with smart pathfinding around obstacles
- **Collision Detection**: Terrain and entity collision with smooth boundary sliding
- **Enemy AI States**: Patrol mode (random movement) and Chase mode (player pursuit)
- **Visual Effects**: Atmospheric elements including god rays and fireflies
- **TypeScript**: Full type safety and modern development practices

## Game Mechanics

- **Player Controls**:
  - Left Click: Move to position with automatic obstacle navigation
  - Hold Left Click: Attack enemies when in range
- **Enemy Behavior**:
  - Patrol: Random movement when player is distant
  - Chase: Intelligent pursuit when player is nearby
  - Obstacle Avoidance: Smart navigation around terrain and other entities
- **Combat System**: Player can attack enemies, enemies follow player (attack system pending implementation)

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production
```bash
npm run build
```

## Project Structure

```
src/
├── main.ts              # Game initialization and main loop
├── engine/
│   └── CoordConverter.ts # Isometric coordinate conversion
├── game/
│   ├── AssetManager.ts   # Texture and asset loading
│   └── WaveController.ts # Enemy spawning system
└── assets/               # Game assets (moved to public/)

public/
├── assets/               # Game sprites and textures
│   ├── NPCs/            # Character sprites
│   ├── Objects/         # Environmental objects
│   └── Tiles/           # Terrain tiles
└── ...
```

## Technologies Used

- **PixiJS v8**: WebGL-based 2D rendering engine
- **TypeScript**: Type-safe JavaScript development
- **Vite**: Fast build tool and development server
- **Isometric Projection**: 2.5D game rendering technique

## Development Notes

This project demonstrates advanced game development concepts including:
- Isometric coordinate systems
- Entity-component architecture
- Physics-based movement and collision detection
- State-based AI systems

## License

This project is open source and available under the [MIT License](LICENSE).
