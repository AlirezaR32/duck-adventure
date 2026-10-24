/**
 * Project Duck — sunny meadow backdrop.
 * Gradient sky, drifting clouds and two rows of rolling hills for parallax
 * depth, all in a soft, harmonious palette. The white duck pops against it.
 */

import * as THREE from 'three'

interface Cloud {
  group: THREE.Group
  speed: number
}

const SKY_TOP = '#b9e2f2' // soft sky
const SKY_MID = '#e2f2e0' // pale mint
const SKY_LOW = '#fff2d2' // warm cream horizon
const SKY_BOT = '#ffe9c0'

export class Background {
  private clouds: Cloud[] = []
  private rangeX = [-14, 86]

  constructor(private scene: THREE.Scene) {
    this.buildSky()
    this.buildHills()
    this.buildClouds()
  }

  private buildSky(): void {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 256
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, SKY_TOP)
    g.addColorStop(0.45, SKY_MID)
    g.addColorStop(0.78, SKY_LOW)
    g.addColorStop(1, SKY_BOT)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 16, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    this.scene.background = tex
    // depth haze that melts hills into the horizon
    this.scene.fog = new THREE.Fog(0xfff2d2, 26, 62)
  }

  private buildHills(): void {
    const farMat = new THREE.MeshStandardMaterial({ color: 0xa9c99b, roughness: 1, flatShading: true })
    const nearMat = new THREE.MeshStandardMaterial({ color: 0x8db97b, roughness: 1, flatShading: true })

    for (let i = 0; i < 7; i++) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(11 + (i % 3) * 3, 9, 7), farMat)
      h.position.set(-8 + i * 15, -2.2, -10 - (i % 2))
      h.scale.y = 0.34
      this.scene.add(h)
    }
    for (let i = 0; i < 6; i++) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(8 + (i % 2) * 2.5, 9, 7), nearMat)
      h.position.set(-2 + i * 14, -2.4, -6.5)
      h.scale.y = 0.38
      this.scene.add(h)
    }
  }

  private buildClouds(): void {
    // Basic material + no fog: keeps clouds soft, bright and readable at distance
    const mat = new THREE.MeshBasicMaterial({ color: 0xfffdf6, fog: false })
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group()
      const n = 3
      for (let j = 0; j < n; j++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 + (j % 2) * 0.25, 8, 6), mat)
        b.position.set(j * 0.62 - 0.6, (j % 2) * 0.18, (j - 1) * 0.3)
        b.scale.y = 0.62
        g.add(b)
      }
      g.position.set(-10 + i * 15 + Math.random() * 6, 4.6 + Math.random() * 2.4, -8 - Math.random() * 4)
      this.clouds.push({ group: g, speed: 0.12 + Math.random() * 0.16 })
      this.scene.add(g)
    }
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt
      if (c.group.position.x > this.rangeX[1]) c.group.position.x = this.rangeX[0]
    }
  }
}
