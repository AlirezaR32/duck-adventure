/**
 * Project Duck — sunny meadow backdrop (V0.2).
 *
 * Deliberate depth layering so gameplay islands always read cleanly:
 *   z -34  soft sun (slow parallax)
 *   z -22  very pale far hills, melting into the horizon haze
 *   z -12  mid hills, still desaturated and quiet
 *   z -6..-11  cloud sea below the gaps (falling reads as diving into clouds)
 *   z -8+  drifting clouds
 * Gameplay platforms sit at z 0 with saturated colors and dark outlines —
 * they never share a color or silhouette with the scenery behind them.
 */

import * as THREE from 'three'

interface Cloud {
  group: THREE.Group
  speed: number
}

export class Background {
  private clouds: Cloud[] = []
  private rangeX = [-20, 150]
  private sun: THREE.Group

  constructor(private scene: THREE.Scene) {
    this.buildSky()
    this.sun = this.buildSun()
    this.buildHills()
    this.buildCloudSea()
    this.buildClouds()
  }

  private buildSky(): void {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 256
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#9edbf5') // soft sky
    g.addColorStop(0.42, '#d8f2e8') // pale mint
    g.addColorStop(0.75, '#fff3d2') // warm cream horizon
    g.addColorStop(1, '#ffe6b8')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 16, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    this.scene.background = tex
    // depth haze: hills melt into the horizon, platforms (z≈0) stay crisp
    this.scene.fog = new THREE.Fog(0xfff3d2, 30, 74)
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
      new THREE.MeshBasicMaterial({ color: 0xfffbee, fog: false, toneMapped: false }),
    )
    disc.position.z = 0.1
    g.add(disc)
    g.position.set(4, 9.2, -34)
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
    this.scene.add(h)
  }

  private buildHills(): void {
    // three quiet rings, each a step cooler/lighter so they read as layers
    const mist = 0xeef5e6
    for (let i = 0; i < 11; i++) {
      this.hill(mist, 12 + (i % 3) * 3.4, 0.3, -22 + i * 16, -4.4, -26 - (i % 3) * 2)
    }
    const farC = 0xcfe6cd
    for (let i = 0; i < 11; i++) {
      this.hill(farC, 10 + (i % 3) * 3, 0.32, -20 + i * 15.5, -3.4, -19 - (i % 3) * 1.5)
    }
    // mid ring — warm sage, clearly greener than the far rows
    const midC = 0xaed397
    for (let i = 0; i < 10; i++) {
      this.hill(midC, 6.5 + (i % 2) * 2.4, 0.38, -14 + i * 15, -3.0, -12.5 - (i % 2) * 1.6)
    }
  }

  /** Fluffy cloud sea far below the gaps — falling reads as diving into clouds. */
  private buildCloudSea(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false })
    const mat2 = new THREE.MeshBasicMaterial({ color: 0xf2faff, fog: false, toneMapped: false })
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
      this.scene.add(g)
    }
  }

  private buildClouds(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfffdf6, fog: false, toneMapped: false })
    for (let i = 0; i < 12; i++) {
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
      this.scene.add(g)
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
