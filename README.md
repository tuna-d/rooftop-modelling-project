# Rooftop Modelling Tool

A web-based rooftop modeling application built with Next.js and Babylon.js.
The tool enables users to design, manipulate, and visualize rooftop structures on top of roof plan images, using a synchronized 2D–3D interface.

## Live Demo

🔗 [View Live Demo](https://rooftop-modelling-project.vercel.app)

## Features

### Roof Image Selection

Users can begin a project by selecting a roof plan image from a built-in gallery.

### Dual-Canvas Interface

- **Plan Canvas (2D):**
  Orthographic top-down editor where users place, move, rotate, and resize roof footprints.
- **Model Canvas (3D):**
  Real-time 3D representation of each roof footprint, automatically synchronized with the plan view.

### Roof Types

Currently supports:

- Flat roofs
- Dual pitch (gable) roofs

Each roof type has distinct geometry and interaction behavior.

### Interactive Editing

The plan canvas allows:

- Movement (drag)
- Rotation (using rotation disc)
- Resizing (corner and edge handles)
- Selection (one selected marker at a time)
- Deletion (via the roof list panel)

### Roof Management Panel

Displays:

- All placed roofs
- Roof type
- Live dimensions (width × height in meters)
- Selection and deletion controls

### Real-Time Synchronization

All edits performed in the 2D canvas are immediately reflected in the 3D model canvas through a custom synchronization system.

## Tech Stack

| Category         | Technologies             |
| ---------------- | ------------------------ |
| Framework        | Next.js 16.0.3           |
| UI Library       | React 19                 |
| 3D Engine        | Babylon.js 8.37.0        |
| Styling          | Tailwind CSS 4           |
| Language         | TypeScript 5             |
| State Management | Custom MarkerSync system |

## Project Structure

```
rooftop-modelling-project/
├── app/
│   ├── create-project/        # Main modeling interface
│   ├── page.tsx               # Roof image selection page
│   └── layout.tsx             # Root layout
│
├── canvases/
│   ├── PlanCanvas.tsx         # 2D top-down editor
│   └── ModelCanvas.tsx        # 3D visualization
│
├── behaviours/
│   ├── MovementBehaviour.ts   # Dragging interactions
│   ├── RotationBehaviour.ts   # Rotation interactions
│   └── ResizeBehaviour.ts     # Corner and edge resizing
│
├── state/
│   └── MarkerSync.ts          # Centralized marker state and subscriptions
│
├── types/
│   ├── marker.ts              # Marker transform type definitions
│   └── roof.ts                # Roof type definitions
│
└── public/
    ├── images/                # Roof plan assets
    └── textures/              # UI textures
```

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/tuna-d/rooftop-modelling-project.git
   cd rooftop-modelling-project
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

## Usage

### Creating a Project

1. Select a roof plan image on the home page.
2. Click "Create Project" to open the modeling view.

### Adding Roofs

1. Choose either "Add Flat Roof" or "Add Dual Pitch Roof".
2. Position the preview on the plan canvas.
3. Click to place the roof marker.

### Manipulating Roofs

- **Move:** drag the selected marker.
- **Rotate:** drag the rotation disc.
- **Resize:**

  - Drag corner handles to resize both dimensions.
  - Drag edge handles to resize a single axis.

- **Select:** click the roof marker.
- **Delete:** use the delete button in the right-hand roof list.

### Viewing Roof Information

The right panel shows:

- Roof index
- Roof type
- Dimensions in meters (width and height)

## Architecture

### State Synchronization (MarkerSync)

A centralized system that:

- Maintains all marker data
- Propagates changes to both canvases
- Ensures consistent selection and editing behavior
- Handles create, update, and delete operations

### PlanCanvas

- Orthographic camera
- Renders and manages interactive markers
- Implements movement, rotation, and resizing tools
- Publishes marker updates to the MarkerSync store

### ModelCanvas

- Perspective camera
- Subscribes to marker updates
- Builds appropriate 3D geometry for each roof type
- Rebuilds or updates models as transforms change

### Behaviours

Separated interactive modules:

- MovementBehaviour (dragging)
- RotationBehaviour (handle-based rotation)
- ResizeBehaviour (corner and edge resizing)

## Key Concepts

- **Markers:** 2D footprints representing roof shapes.
- **MarkerTransform:** Contains transform data synchronized across views.
- **Roof Types:** Flat and dual pitch models.
- **Coordinate System:** Babylon.js Y-up coordinate system.

## License

This project is private and proprietary. Redistribution or commercial use is not permitted.
