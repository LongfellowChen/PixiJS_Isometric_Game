# PixiJS 2.5D Isometric Engine

This project is a 2.5D (Isometric) game engine built with PixiJS v8, TypeScript, and Vite.

## Features
- **PixiJS v8 Implementation**: Uses the latest asynchronous `app.init()` and modern `GraphicsContext`.
- **Isometric Logic**: Standard 2:1 ratio (64x32px tiles) with Cartesian ↔ Isometric conversion.
- **Depth Sorting**: Automatic occlusion handling based on Y-coordinate.
- **Interactive Movement**: Click anywhere on the grid to move the zombie character.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

## Project Structure
- `/src/engine`: Core engine logic (Coordinate conversion, etc.)
- `/src/main.ts`: Application entry point and scene setup.
- `/public`: Static assets (textures, sounds).

## Controls
- **Left Click**: Set target destination for the character on the isometric grid.
