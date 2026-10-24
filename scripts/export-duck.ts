/**
 * Exports the procedural duck as a standalone binary glTF (.glb) asset
 * so it can be reused in Godot, Unity, Blender or any glTF-compatible tool.
 *
 * Run: bun /home/z/my-project/scripts/export-duck.ts
 */

import * as THREE from 'three'
import { writeFileSync } from 'node:fs'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { Duck } from '../src/components/game/engine/Duck'

// Minimal FileReader shim for bun/node (GLTFExporter assembles binary chunks
// through FileReader.readAsArrayBuffer; there are no textures in this model).
interface ShimEvent {
  target: unknown
}
class FileReaderShim {
  result: ArrayBuffer | string = new ArrayBuffer(0)
  onload: ((e: ShimEvent) => void) | null = null
  onloadend: ((e: ShimEvent) => void) | null = null
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((ab) => {
      this.result = ab
      const evt = { target: this }
      this.onload?.(evt)
      this.onloadend?.(evt)
    })
  }
  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then((ab) => {
      const bytes = new Uint8Array(ab)
      let bin = ''
      for (const b of bytes) bin += String.fromCharCode(b)
      this.result = `data:application/octet-stream;base64,${btoa(bin)}`
      const evt = { target: this }
      this.onload?.(evt)
      this.onloadend?.(evt)
    })
  }
}
;(globalThis as unknown as { FileReader: unknown }).FileReader = FileReaderShim

const duck = new Duck()
const scene = new THREE.Scene()
scene.add(duck.root)

const exporter = new GLTFExporter()
exporter.parse(
  scene,
  (result) => {
    const buffer = result as ArrayBuffer
    const out = '/home/z/my-project/download/duck.glb'
    writeFileSync(out, Buffer.from(buffer))
    console.log(`duck.glb written: ${(buffer.byteLength / 1024).toFixed(1)} KB -> ${out}`)
  },
  (err) => {
    console.error('GLB export failed:', err)
    process.exit(1)
  },
  { binary: true },
)
