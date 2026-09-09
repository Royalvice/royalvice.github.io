import * as pc from "playcanvas";

export const CABINET_SIZE = { width: 5.55, height: 4.78, bayWidth: 2.395, bayHeight: 2.01 };

type Panel = {
  mesh: pc.Mesh;
  positions: number[];
  uvs: number[];
  uvGradients: Float32Array;
  extendX: boolean;
  extendY: boolean;
  bay: boolean;
};

// UV gradients keep the wood grain's physical size when a panel gains length.
// UV1 remains the authored lightmap; UV0 is the repeating material surface.
function surfaceGradients(positions: number[], uvs: number[], indices: number[]): Float32Array {
  const gradients = new Float32Array(positions.length / 3 * 4);
  const counts = new Uint16Array(positions.length / 3);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3);
    const e1 = new pc.Vec3(...positions.slice(b * 3, b * 3 + 3)).sub(new pc.Vec3(...positions.slice(a * 3, a * 3 + 3)));
    const e2 = new pc.Vec3(...positions.slice(c * 3, c * 3 + 3)).sub(new pc.Vec3(...positions.slice(a * 3, a * 3 + 3)));
    const aa = e1.dot(e1), ab = e1.dot(e2), bb = e2.dot(e2);
    const determinant = aa * bb - ab * ab;
    if (determinant < 1e-14) continue;
    for (let channel = 0; channel < 2; channel++) {
      const d1 = uvs[b * 2 + channel] - uvs[a * 2 + channel];
      const d2 = uvs[c * 2 + channel] - uvs[a * 2 + channel];
      const s = (d1 * bb - d2 * ab) / determinant;
      const t = (d2 * aa - d1 * ab) / determinant;
      for (const vertex of [a, b, c]) {
        gradients[vertex * 4 + channel * 2] += e1.x * s + e2.x * t;
        gradients[vertex * 4 + channel * 2 + 1] += e1.y * s + e2.y * t;
      }
    }
    for (const vertex of [a, b, c]) counts[vertex]++;
  }
  for (let i = 0; i < gradients.length; i++) gradients[i] /= counts[Math.floor(i / 4)] || 1;
  return gradients;
}

/** Extends the authored cabinet's spans while keeping its trim and contents rigid. */
export class ResponsiveCabinet {
  private nodes: Array<{ entity: pc.Entity; position: pc.Vec3; bay: number | null; accessory: boolean }> = [];
  private anchors: Array<{ entity: pc.Entity; position: pc.Vec3; vertical: number }> = [];
  private panels: Panel[] = [];
  private width = CABINET_SIZE.width;
  private height = CABINET_SIZE.height;

  constructor(cabinet: pc.Entity) {
    for (const child of cabinet.children) {
      const entity = child as pc.Entity;
      const match = /^slot-(\d)/.exec(entity.name);
      const bay = match ? Number(match[1]) : null;
      const accessory = /\.(?:card-|light-|plaque-|nameplate)/.test(entity.name);
      this.nodes.push({ entity, position: entity.getLocalPosition().clone(), bay, accessory });
      if (/^slot-\d$/.test(entity.name)) {
        // Runtime lights and artwork inherit these anchors. Floor and ceiling
        // anchors move apart; meshes beneath them retain their authored scale.
        for (const childAnchor of entity.children) {
          const anchor = childAnchor as pc.Entity;
          const vertical = /(?:trophy-root|trophy-anchor|rim-light-anchor)$/.test(anchor.name) ? -1
            : /(?:hero-anchor|card-frame-anchor|light-anchor|plaque-anchor|nameplate-anchor|trophy-spotlight)$/.test(anchor.name) ? 1 : 0;
          this.anchors.push({ entity: anchor, position: anchor.getLocalPosition().clone(), vertical });
        }
        continue;
      }
      if (accessory) continue;
      for (const instance of entity.render?.meshInstances ?? []) {
        const mesh = instance.mesh;
        const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
        mesh.getPositions(positions);
        mesh.getUvs(0, uvs);
        mesh.getIndices(indices);
        const extent = mesh.aabb.halfExtents;
        const extendX = extent.x * 2 > (bay === null ? 4 : 1.7);
        const extendY = extent.y * 2 > (bay === null ? 4 : 1.6);
        if (!extendX && !extendY) continue;
        this.panels.push({ mesh, positions, uvs, uvGradients: surfaceGradients(positions, uvs, indices), extendX, extendY, bay: bay !== null });
      }
    }
  }

  resize(aspect: number): boolean {
    // A tall page must not turn the four displays into narrow shafts.
    aspect = pc.math.clamp(aspect, 0.95, 1.25);
    const width = Math.max(CABINET_SIZE.width, CABINET_SIZE.height * aspect);
    const height = Math.max(CABINET_SIZE.height, CABINET_SIZE.width / aspect);
    if (Math.abs(width - this.width) < 0.00001 && Math.abs(height - this.height) < 0.00001) return false;
    this.width = width;
    this.height = height;
    const dx = width - CABINET_SIZE.width, dy = height - CABINET_SIZE.height;
    for (const { entity, position, bay, accessory } of this.nodes) {
      let x = position.x, y = position.y;
      if (bay === null) {
        if (Math.abs(x) > 2) x += Math.sign(x) * dx / 2;
        if (Math.abs(y) > 2) y += Math.sign(y) * dy / 2;
      } else {
        const cx = bay % 2 === 0 ? -1.2975 : 1.2975;
        const cy = bay < 2 ? 1.105 : -1.105;
        x += Math.sign(cx) * dx / 4;
        y += Math.sign(cy) * dy / 4;
        if (accessory) {
          y += dy / 4;
        } else if (!/^slot-\d$/.test(entity.name)) {
          // Edge panels retain their thickness; intermediate grooves spread
          // across the added wall/floor, instead of becoming thicker lines.
          const ox = position.x - cx, oy = position.y - cy;
          x += dx / 4 * pc.math.clamp(ox / (CABINET_SIZE.bayWidth / 2 - 0.15), -1, 1);
          y += dy / 4 * pc.math.clamp(oy / (CABINET_SIZE.bayHeight / 2 - 0.15), -1, 1);
        }
      }
      entity.setLocalPosition(x, y, position.z);
    }
    for (const { entity, position, vertical } of this.anchors) {
      entity.setLocalPosition(position.x, position.y + vertical * dy / 4, position.z);
    }
    for (const panel of this.panels) {
      const positions = panel.positions.slice(), uvs = panel.uvs.slice();
      const ex = panel.extendX ? dx / (panel.bay ? 4 : 2) : 0;
      const ey = panel.extendY ? dy / (panel.bay ? 4 : 2) : 0;
      for (let v = 0; v < positions.length / 3; v++) {
        // Moving the two ends apart preserves bevels and cross sections.
        const x = Math.sign(panel.positions[v * 3]) * ex;
        const y = Math.sign(panel.positions[v * 3 + 1]) * ey;
        positions[v * 3] += x;
        positions[v * 3 + 1] += y;
        uvs[v * 2] += panel.uvGradients[v * 4] * x + panel.uvGradients[v * 4 + 1] * y;
        uvs[v * 2 + 1] += panel.uvGradients[v * 4 + 2] * x + panel.uvGradients[v * 4 + 3] * y;
      }
      panel.mesh.setPositions(positions);
      panel.mesh.setUvs(0, uvs);
      panel.mesh.update();
    }
    return true;
  }

  get size() {
    return {
      width: this.width, height: this.height,
      bayWidth: CABINET_SIZE.bayWidth + (this.width - CABINET_SIZE.width) / 2,
      bayHeight: CABINET_SIZE.bayHeight + (this.height - CABINET_SIZE.height) / 2
    };
  }

  get geometry() {
    return this.nodes.filter(({ entity }) => /(?:\.back-panel|outer-frame-left)$/.test(entity.name)).map(({ entity }) => ({
      name: entity.name,
      size: entity.render!.meshInstances[0].mesh.aabb.halfExtents.clone().mulScalar(2).toArray()
    }));
  }
}
