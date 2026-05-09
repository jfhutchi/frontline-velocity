import { Color3, MeshBuilder, Scene, StandardMaterial, Vector3, type Mesh } from '@babylonjs/core';
import { COLOR } from '../constants';
import type { EffectEvent, Projectile, SimulationState } from '../types';

interface EffectVisual {
  mesh: Mesh;
  spawnedAt: number;
  duration: number;
  baseScale: number;
}

export class EffectsRenderer {
  private scene: Scene;
  private projectileMeshes = new Map<string, Mesh>();
  private effectVisuals = new Map<string, EffectVisual>();
  private projFriendlyMat: StandardMaterial;
  private projEnemyMat: StandardMaterial;
  private mflashMat: StandardMaterial;
  private explosionMat: StandardMaterial;

  constructor(scene: Scene) {
    this.scene = scene;
    this.projFriendlyMat = new StandardMaterial('projFr', scene);
    this.projFriendlyMat.diffuseColor = new Color3(COLOR.projectileFriendly.r, COLOR.projectileFriendly.g, COLOR.projectileFriendly.b);
    this.projFriendlyMat.emissiveColor = new Color3(0.6, 0.7, 0.95);
    this.projFriendlyMat.specularColor = new Color3(0, 0, 0);

    this.projEnemyMat = new StandardMaterial('projEn', scene);
    this.projEnemyMat.diffuseColor = new Color3(COLOR.projectileEnemy.r, COLOR.projectileEnemy.g, COLOR.projectileEnemy.b);
    this.projEnemyMat.emissiveColor = new Color3(0.95, 0.5, 0.3);
    this.projEnemyMat.specularColor = new Color3(0, 0, 0);

    this.mflashMat = new StandardMaterial('mflash', scene);
    this.mflashMat.diffuseColor = new Color3(1, 0.85, 0.5);
    this.mflashMat.emissiveColor = new Color3(1, 0.85, 0.5);
    this.mflashMat.specularColor = new Color3(0, 0, 0);

    this.explosionMat = new StandardMaterial('explosion', scene);
    this.explosionMat.diffuseColor = new Color3(1, 0.55, 0.25);
    this.explosionMat.emissiveColor = new Color3(1, 0.55, 0.25);
    this.explosionMat.specularColor = new Color3(0, 0, 0);
  }

  update(state: SimulationState) {
    this.syncProjectiles(state.projectiles);
    this.syncEffects(state.effects, state.time);
  }

  private syncProjectiles(active: Projectile[]) {
    const seen = new Set<string>();
    for (const p of active) {
      seen.add(p.id);
      let m = this.projectileMeshes.get(p.id);
      if (!m) {
        m = MeshBuilder.CreateSphere(`proj_${p.id}`, { diameter: 0.5, segments: 6 }, this.scene);
        m.material = p.faction === 'friendly' ? this.projFriendlyMat : this.projEnemyMat;
        this.projectileMeshes.set(p.id, m);
      }
      m.position.set(p.position.x, 1.5, p.position.z);
    }
    for (const [id, mesh] of this.projectileMeshes) {
      if (!seen.has(id)) {
        mesh.dispose(false, true);
        this.projectileMeshes.delete(id);
      }
    }
  }

  private syncEffects(effects: EffectEvent[], time: number) {
    const seen = new Set<string>();
    for (const e of effects) {
      seen.add(e.id);
      let vis: EffectVisual | undefined = this.effectVisuals.get(e.id);
      if (!vis) {
        const spawned = this.spawnEffect(e);
        if (spawned) {
          vis = spawned;
          this.effectVisuals.set(e.id, spawned);
        }
      }
      if (!vis) continue;
      const t = (time - e.spawnedAt) / e.duration;
      const tt = Math.max(0, Math.min(1, t));
      const scale = vis.baseScale * (e.kind === 'explosion' ? 1 + tt * 1.6 : e.kind === 'muzzleFlash' ? 1 - tt * 0.6 : 1 + tt);
      vis.mesh.scaling.set(scale, scale, scale);
      const mat = vis.mesh.material as StandardMaterial | null;
      if (mat) {
        mat.alpha = 1 - tt;
      }
    }
    for (const [id, vis] of this.effectVisuals) {
      if (!seen.has(id)) {
        vis.mesh.dispose(false, true);
        this.effectVisuals.delete(id);
      }
    }
  }

  private spawnEffect(e: EffectEvent): EffectVisual | null {
    let mesh: Mesh;
    let baseScale = e.scale ?? 1;
    if (e.kind === 'muzzleFlash') {
      mesh = MeshBuilder.CreateSphere(`fx_${e.id}`, { diameter: 1.6, segments: 8 }, this.scene);
      const mat = this.mflashMat.clone(`mflash_${e.id}`);
      mat.alpha = 0.95;
      mesh.material = mat;
    } else if (e.kind === 'explosion') {
      mesh = MeshBuilder.CreateSphere(`fx_${e.id}`, { diameter: 1.4, segments: 10 }, this.scene);
      const mat = this.explosionMat.clone(`explosion_${e.id}`);
      mat.alpha = 0.8;
      mesh.material = mat;
    } else if (e.kind === 'hit') {
      mesh = MeshBuilder.CreateSphere(`fx_${e.id}`, { diameter: 0.9, segments: 6 }, this.scene);
      const mat = this.mflashMat.clone(`hit_${e.id}`);
      mat.alpha = 0.7;
      mesh.material = mat;
    } else {
      return null;
    }
    mesh.position = new Vector3(e.position.x, e.position.y || 1.0, e.position.z);
    return { mesh, spawnedAt: e.spawnedAt, duration: e.duration, baseScale };
  }

  dispose() {
    for (const m of this.projectileMeshes.values()) m.dispose(false, true);
    this.projectileMeshes.clear();
    for (const v of this.effectVisuals.values()) v.mesh.dispose(false, true);
    this.effectVisuals.clear();
  }
}
