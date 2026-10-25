/**
 * Project Duck — parallax backdrop (V0.6, themeable).
 *
 * Deliberate depth layering so gameplay islands always read cleanly:
 *   z -34  soft sun (slow parallax)
 *   z -22  very pale far hills, melting into the horizon haze
 *   z -12  mid hills, still desaturated and quiet
 *   z -6..-11  cloud sea below the gaps (falling reads as diving into clouds)
 *   z -8+  drifting clouds
 * Gameplay platforms sit at z 0 with saturated colors and dark outlines —
 * they never share a color or silhouette with the scenery behind them.
 *
 * Each level applies its own palette (applyTheme) without touching layer
 * structure: meadow = sunny greens, isles = airy mints, canyon = warm dusk,
 * garden = dusk-magic lavender over a pink cloud sea.
 */

import * as THREE from 'three'

interface Cloud {
  group: THREE.Group
  speed: number
}

export type BgTheme = 'meadow' | 'isles' | 'canyon' | 'garden'

interface BgPalette {
  sky: [string, string, string, string]
  fog: number
  sun: number
  sunY: number
  rings: { color: number; y: number; z: number; spread: number; r: number; sy: number; n: number }[]
  cloudSeaColor: [number, number]
  cloudTint: number
  cloudRows: number
}

const PALETTES: Record<BgTheme, BgPalette> = {
  meadow: {
    sky: ['#9edbf5', '#d8f2e8', '#fff3d2', '#ffe6b8'],
    fog: 0xfff3d2,
    sun: 0xfffbee,
    sunY: 9.2,
    rings: [
      { color: 0xeef5e6, y: -4.4, z: -26, spread: 16, r: 12, sy: 0.3, n: 11 },
      { color: 0xcfe6cd, y: -3.4, z: -19, spread: 15.5, r: 10, sy: 0.32, n: 11 },
      { color: 0xaed397, y: -3.0, z: -12.5, spread: 15, r: 6.5, sy: 0.38, n: 10 },
    ],
    cloudSeaColor: [0xffffff, 0xf2faff],
    cloudTint: 0xfffdf6,
    cloudRows: 12,
  },
  isles: {
    sky: ['#8fd2f4', '#c8ecf6', '#eef8e9', '#fdf6d8'],
    fog: 0xeef8e9,
    sun: 0xfffcf2,
    sunY: 10.2,
    rings: [
      { color: 0xe8f4ec, y: -4.6, z: -26, spread: 16, r: 12, sy: 0.28, n: 11 },
      { color: 0xc2e4d6, y: -3.6, z: -19, spread: 15.5, r: 10, sy: 0.3, n: 11 },
      { color: 0x9fd4b8, y: -3.2, z: -12.5, spread: 15, r: 6.5, sy: 0.36, n: 10 },
    ],
    cloudSeaColor: [0xffffff, 0xeaf8ff],
    cloudTint: 0xfbfffe,
    cloudRows: 16,
  },
  canyon: {
    sky: ['#f7c98e', '#f9d9a8', '#fbe6c4', '#f6cba0'],
    fog: 0xf9dcab,
    sun: 0xfff4d8,
    sunY: 7.6,
    rings: [
      { color: 0xf2ddb8, y: -4.6, z: -26, spread: 16, r: 12, sy: 0.34, n: 11 },
      { color: 0xe8b990, y: -3.4, z: -19, spread: 15.5, r: 10, sy: 0.36, n: 11 },
      { color: 0xd89a78, y: -3.0, z: -12.5, spread: 15, r: 6.5, sy: 0.42, n: 10 },
    ],
    cloudSeaColor: [0xfff2dd, 0xf7e3c8],
    cloudTint: 0xfff6e4,
    cloudRows: 7,
  },
  // Region D — dusk-magic: lavender sky melting into rose, thick soft
  // cloud sea below, pale violet hill rings. Platforms stay saturated
  // mint with dark violet outlines so the white duck always pops.
  garden: {
    sky: ['#b9a4ea', '#dcc2f2', '#f6d4ec', '#fde4ee'],
    fog: 0xf0d4ec,
    sun: 0xfff0f6,
    sunY: 9.4,
    rings: [
      { color: 0xf0e4f6, y: -4.6, z: -26, spread: 16, r: 12, sy: 0.3, n: 11 },
      { color: 0xdcc8ee, y: -3.6, z: -19, spread: 15.5, r: 10, sy: 0.32, n: 11 },
      { color: 0xc2aae2, y: -3.2, z: -12.5, spread: 15, r: 6.5, sy: 0.38, n: 10 },
    ],
    cloudSeaColor: [0xfff4fa, 0xf6e2f4],
    cloudTint: 0xfffafc,
    cloudRows: 18,
  },
}

export class Background {
  private clouds: Cloud[] = []
  private rangeX = [-20, 160]
  private sun: THREE.Group
  private sunDiscMat: THREE.MeshBasicMaterial | null = null
  private themeRoot = new THREE.Group()
  private skyTex: THREE.CanvasTexture | null = null
  private palette: BgPalette = PALETTES.meadow

  constructor(private scene: THREE.Scene) {
    scene.add(this.themeRoot)
    this.rebuild()
    this.sun = this.buildSun()
  }

  /** Switch the backdrop palette for a level (rebuilds scenery layers). */
  applyTheme(theme: BgTheme): void {
    const p = PALETTES[theme]
    if (p === this.palette) return
    this.palette = p
    this.rebuild()
  }

  private rebuild(): void {
    const p = this.palette
    // drop the previous scenery (and free its GPU resources)
    this.themeRoot.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else if (mat) mat.dispose()
    })
    this.themeRoot.clear()
    this.clouds = []
    if (this.skyTex) this.skyTex.dispose()

    // sky gradient
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 256
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, p.sky[0])
    g.addColorStop(0.42, p.sky[1])
    g.addColorStop(0.75, p.sky[2])
    g.addColorStop(1, p.sky[3])
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 16, 256)
    this.skyTex = new THREE.CanvasTexture(c)
    this.skyTex.colorSpace = THREE.SRGBColorSpace
    this.scene.background = this.skyTex
    // depth haze: hills melt into the horizon, platforms (z≈0) stay crisp
    this.scene.fog = new THREE.Fog(p.fog, 30, 74)

    this.buildHills()
    this.buildCloudSea()
    this.buildClouds()
    if (this.sun) {
      this.sun.position.y = p.sunY
      this.sunDiscMat?.color.set(p.sun)
    }
  }

  private buildSun(): THREE.Group {
    const g = new THREE.Group()
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(2.7, 40),
      new THREE.MeshBasicMaterial({ color: 0xfff3c3, transparent: true, opacity: 0.3, fog: false, toneMapped: false }),
    )
    g.add(halo)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.45, 40),
      new THREE.MeshBasicMaterial({ color: this.palette.sun, fog: false, toneMapped: false }),
    )
    disc.position.z = 0.1
    this.sunDiscMat = disc.material as THREE.MeshBasicMaterial
    g.add(disc)
    g.position.set(4, this.palette.sunY, -34)
    this.scene.add(g)
    return g
  }

  private hill(color: number, r: number, sy: number, x: number, y: number, z: number): void {
    const h = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    )
    h.position.set(x, y, z)
    h.scale.y = sy
    this.themeRoot.add(h)
  }

  private buildHills(): void {
    // three quiet rings, each a step cooler/lighter so they read as layers
    const p = this.palette
    for (let i = 0; i < p.rings.length; i++) {
      const ring = p.rings[i]
      for (let j = 0; j < ring.n; j++) {
        this.hill(
          ring.color,
          ring.r + (j % 3) * 3.2,
          ring.sy,
          -22 + j * ring.spread,
          ring.y,
          ring.z - (j % 3) * 2,
        )
      }
    }
  }

  /** Fluffy cloud sea far below the gaps — falling reads as diving into clouds. */
  private buildCloudSea(): void {
    const mat = new THREE.MeshBasicMaterial({ color: this.palette.cloudSeaColor[0], fog: false, toneMapped: false })
    const mat2 = new THREE.MeshBasicMaterial({ color: this.palette.cloudSeaColor[1], fog: false, toneMapped: false })
    for (let i = 0; i < 40; i++) {
      const x = -20 + i * 4.4 + Math.sin(i * 12.9898) * 1.6
      const g = new THREE.Group()
      const n = 3
      for (let j = 0; j < n; j++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(1.0 + ((i + j) % 3) * 0.45, 9, 7), j % 2 ? mat : mat2)
        b.position.set(j * 1.15 - 1.1, (j % 2) * -0.3, (j - 1) * 0.7)
        b.scale.y = 0.55
        g.add(b)
      }
      g.position.set(x, -6.6 - (i % 3) * 0.9, -6 - (i % 4) * 1.7)
      this.themeRoot.add(g)
    }
  }

  private buildClouds(): void {
    const mat = new THREE.MeshBasicMaterial({ color: this.palette.cloudTint, fog: false, toneMapped: false })
    for (let i = 0; i < this.palette.cloudRows; i++) {
      const g = new THREE.Group()
      const n = 3
      for (let j = 0; j < n; j++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 + (j % 2) * 0.28, 9, 7), mat)
        b.position.set(j * 0.66 - 0.66, (j % 2) * 0.2, (j - 1) * 0.3)
        b.scale.y = 0.6
        g.add(b)
      }
      g.position.set(-14 + i * 13.5 + (i % 3) * 3, 5 + (i % 3) * 1.3, -9 - (i % 3) * 2.5)
      this.clouds.push({ group: g, speed: 0.1 + (i % 4) * 0.05 })
      this.themeRoot.add(g)
    }
  }

  update(dt: number, camX: number): void {
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt
      if (c.group.position.x > this.rangeX[1]) c.group.position.x = this.rangeX[0]
    }
    // gentle sun parallax
    this.sun.position.x = camX * 0.86 + 4
  }
}
