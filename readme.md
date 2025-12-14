![](./assets/website.png)

# Bracket Engineer

A website to generate 3D printable power supply / power brick brackets. Design custom mounting solutions for your devices and export them as 3MF files ready for slicing.

## Features

- **Real-time 3D Preview** — See your bracket design update live as you adjust parameters
- **Build Plate Presets** — Quick selection for popular 3D printers:
  - Bambu X1C (256 × 256 mm)
  - Bambu A1 Mini (180 × 180 mm)
  - Prusa MK4 (250 × 210 mm)
  - Ender 3 (220 × 220 mm)
  - Voron 350 (350 × 350 mm)
- **Custom Plate Sizes** — Manually enter any build plate dimensions
- **Smart Constraints** — Width automatically clamps to fit your selected plate
- **Parametric Design** — Adjust width, height, depth, thickness, ribbing, mounting holes, and more
- **URL State** — All parameters saved in URL for easy sharing
- **3MF Export** — Download print-ready files with one click

## Tech Stack

- [Manifold 3D](https://github.com/elalish/manifold) — Geometry kernel for CSG operations
- [Three.js](https://threejs.org/) — 3D rendering
- [Vite](https://vitejs.dev/) — Build tooling
- Deployed to Cloudflare Workers

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```
