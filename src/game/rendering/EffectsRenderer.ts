import { Color3, MeshBuilder, PBRMaterial, Scene, Vector3, type Mesh } from '@babylonjs/core';
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
  private projFriendlyMat: PBRMaterial;
  private projEnemyMat: PBRMaterial;
  private bulletFriendlyMat: PBRMaterial;
  private bulletEnemyMat: PBRMaterial;
  private mflashMat: PBRMaterial;
  private explosionMat: PBRMaterial;
  private smokeMat: PBRMaterial;

  constructor(scene: Scene) {
    this.scene = scene;

    this.projFriendlyMat = new PBRMaterial('projFr', scene);
    this.projFriendlyMat.albedoColor = new Color3(COLOR.projectileFriendly.r, COLOR.projectileFriendly.g, COLOR.projectileFriendly.b);
    this.projFriendlyMat.emissiveColor = new Color3(0.6, 0.7, 0.95);
    this.projFriendlyMat.metallic = 0;
    this.projFriendlyMat.roughness = 1;

    this.projEnemyMat = new PBRMaterial('projEn', scene);
    this.projEnemyMat.albedoColor = new Color3(COLOR.projectileEnemy.r, COLOR.projectileEnemy.g, COLOR.projectileEnemy.b);
    this.projEnemyMat.emissiveColor = new Color3(0.95, 0.5, 0.3);
    this.projEnemyMat.metallic = 0;
    this.projEnemyMat.roughness = 1;

    // Rifle bullets read as small bright tracers, distinct from cannon shells.
    this.bulletFriendlyMat = new PBRMaterial('bulletFr', scene);
    this.bulletFriendlyMat.albedoColor = new Color3(1.0, 0.95, 0.55);
    this.bulletFriendlyMat.emissiveColor = new Color3(1.0, 0.92, 0.5);
    this.bulletFriendlyMat.metallic = 0;
    this.bulletFriendlyMat.roughness = 1;

    this.bulletEnemyMat = new PBRMaterial('bulletEn', scene);
    this.bulletEnemyMat.albedoColor = new Color3(1.0, 0.65, 0.35);
    this.bulletEnemyMat.emissiveColor = new Color3(1.0, 0.55, 0.3);
    this.bulletEnemyMat.metallic = 0;
    this.bulletEnemyMat.roughness = 1;

    this.mflashMat = new PBRMaterial('mflash', scene);
    this.mflashMat.albedoColor = new Color3(1, 0.85, 0.5);
    this.mflashMat.emissiveColor = new Color3(1, 0.85, 0.5);
    this.mflashMat.metallic = 0;
    this.mflashMat.roughness = 1;

    this.explosionMat = new PBRMaterial('explosion', scene);
    this.explosionMat.albedoColor = new Color3(1, 0.55, 0.25);
    this.explosionMat.emissiveColor = new Color3(1, 0.55, 0.25);
    this.explosionMat.metallic = 0;
    this.explosionMat.roughness = 1;

    this.smokeMat = new PBRMaterial('smoke', scene);
    this.smokeMat.albedoColor = new Color3(0.34, 0.34, 0.31);
    this.smokeMat.metallic = 0;
    this.smokeMat.roughness = 1;
    this.smokeMat.alpha = 0.55;
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
        const isBullet = p.kind === 'bullet';
        m = isBullet
          ? MeshBuilder.CreateCylinder(`proj_${p.id}`, { diameter: 0.07, height: 0.55, tessellation: 5 }, this.scene)
          : MeshBuilder.CreateCylinder(`proj_${p.id}`, { diameter: 0.16, height: 2.4, tessellation: 6 }, this.scene);
        m.rotation.x = Math.PI / 2;
        if (isBullet) {
          m.material = p.faction === 'friendly' ? this.bulletFriendlyMat : this.bulletEnemyMat;
        } else {
          m.material = p.faction === 'friendly' ? this.projFriendlyMat : this.projEnemyMat;
        }
        this.projectileMeshes.set(p.id, m);
      }
      m.position.set(p.position.x, p.kind === 'bullet' ? 1.2 : 1.5, p.position.z);
      m.rotation.y = Math.atan2(p.velocity.x, p.velocity.z);
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
      const scale = vis.baseScale * (e.kind === 'explosion' ? 1 + tt * 1.6 : e.kind === 'muzzleFlash' ? 1 - tt * 0.6 : e.kind === 'smoke' ? 1 + tt * 1.2 : 1 + tt);
      vis.mesh.scaling.set(scale, scale, scale);
      const mat = vis.mesh.material as PBRMaterial | null;
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
    const baseScale = e.scale ?? 1;
    if (e.kind === 'muzzleFlash') {
      mesh = MeshBuilder.CreateSphere(`fx_${e.id}`, { diameter: 1.6, segments: 8 }, this.scene);
      const mat = this.mflashMat.clone(`mflash_${e.id}`) as PBRMaterial;
      mat.alpha = 0.95;
      mesh.material = mat;
    } else if (e.kind === 'explosion') {
      mesh = MeshBuilder.CreateSphere(`fx_${e.id}`, { diameter: 1.4, segments: 10 }, this.scene);
      const mat = this.explosionMat.clone(`explosion_${e.id}`) as PBRMaterial;
      mat.alpha = 0.8;
      mesh.material = mat;
    } else if (e.kind === 'hit') {
      mesh = MeshBuilder.CreateSphere(`fx_${e.id}`, { diameter: 0.9, segments: 6 }, this.scene);
      const mat = this.mflashMat.clone(`hit_${e.id}`) as PBRMaterial;
      mat.alpha = 0.7;
      mesh.material = mat;
    } else if (e.kind === 'smoke') {
      mesh = MeshBuilder.CreateSphere(`fx_${e.id}`, { diameter: 1.0, segments: 8 }, this.scene);
      const mat = this.smokeMat.clone(`smoke_${e.id}`) as PBRMaterial;
      mat.alpha = 0.45;
      mesh.material = mat;
    } else if (e.kind === 'wreck') {
      mesh = MeshBuilder.CreateSphere(`fx_${e.id}`, { diameter: 1.2, segments: 8 }, this.scene);
      const mat = this.smokeMat.clone(`wreck_${e.id}`) as PBRMaterial;
      mat.alpha = 0.35;
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
