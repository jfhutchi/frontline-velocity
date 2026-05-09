import {
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import { COLOR } from '../constants';
import type { Unit, UnitType } from '../types';

interface UnitVisual {
  root: TransformNode;
  hull: Mesh;
  turret?: Mesh;
  selectionRing: Mesh;
  marker: Mesh;
  hpBarBg: Mesh;
  hpBarFill: Mesh;
  /** Used to suppress flicker when a unit is destroyed but mesh still showing wreck. */
  isDestroyed: boolean;
  type: UnitType;
}

export class UnitRenderer {
  private scene: Scene;
  private visuals = new Map<string, UnitVisual>();
  private materials: Record<string, StandardMaterial> = {};

  constructor(scene: Scene) {
    this.scene = scene;
    this.buildSharedMaterials();
  }

  private buildSharedMaterials() {
    const mk = (name: string, c: { r: number; g: number; b: number }) => {
      const m = new StandardMaterial(name, this.scene);
      m.diffuseColor = new Color3(c.r, c.g, c.b);
      m.specularColor = new Color3(0.05, 0.05, 0.05);
      this.materials[name] = m;
      return m;
    };
    mk('friendlyHull', COLOR.friendlyHull);
    mk('friendlyTurret', COLOR.friendlyTurret);
    mk('friendlyMarker', COLOR.friendlyMarker);
    mk('enemyHull', COLOR.enemyHull);
    mk('enemyTurret', COLOR.enemyTurret);
    mk('enemyMarker', COLOR.enemyMarker);
    const sel = mk('selectionRing', COLOR.selection);
    sel.emissiveColor = new Color3(0.3, 0.7, 0.3);
    sel.alpha = 0.85;
    const hpBg = mk('hpBg', { r: 0.05, g: 0.05, b: 0.05 });
    hpBg.alpha = 0.85;
    const hpFill = mk('hpFill', { r: 0.4, g: 0.85, b: 0.4 });
    hpFill.emissiveColor = new Color3(0.3, 0.7, 0.3);
  }

  ensureVisual(unit: Unit): UnitVisual {
    let vis = this.visuals.get(unit.id);
    if (vis) return vis;
    vis = this.buildVisual(unit);
    this.visuals.set(unit.id, vis);
    return vis;
  }

  private buildVisual(unit: Unit): UnitVisual {
    const root = new TransformNode(`unit_${unit.id}`, this.scene);
    const isFriendly = unit.faction === 'friendly';
    const hullMat = this.materials[isFriendly ? 'friendlyHull' : 'enemyHull'];
    const turretMat = this.materials[isFriendly ? 'friendlyTurret' : 'enemyTurret'];
    const markerMat = this.materials[isFriendly ? 'friendlyMarker' : 'enemyMarker'];

    let hull: Mesh;
    let turret: Mesh | undefined;

    switch (unit.type) {
      case 'mediumTank':
      case 'lightTank': {
        hull = MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 3, height: 1.2, depth: 4 }, this.scene);
        hull.material = hullMat;
        hull.parent = root;
        hull.position.y = 0.6;

        const turretBase = MeshBuilder.CreateBox(`turretBase_${unit.id}`, { width: 2, height: 0.7, depth: 2 }, this.scene);
        turretBase.material = turretMat;
        turretBase.parent = root;
        turretBase.position.y = 1.5;

        const barrel = MeshBuilder.CreateCylinder(`barrel_${unit.id}`, { diameter: 0.3, height: 2.6 }, this.scene);
        barrel.material = turretMat;
        barrel.rotation.x = Math.PI / 2;
        barrel.parent = turretBase;
        barrel.position.z = 1.6;
        turret = turretBase;
        break;
      }
      case 'reconJeep': {
        hull = MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 1.6, height: 0.8, depth: 2.6 }, this.scene);
        hull.material = hullMat;
        hull.parent = root;
        hull.position.y = 0.5;
        // wheels (just visual blobs)
        for (const [x, z] of [
          [-0.85, 0.9],
          [0.85, 0.9],
          [-0.85, -0.9],
          [0.85, -0.9],
        ]) {
          const w = MeshBuilder.CreateCylinder(`wheel_${unit.id}_${x}_${z}`, { diameter: 0.6, height: 0.4 }, this.scene);
          const wMat = new StandardMaterial(`wheel_${unit.id}_${x}_${z}_mat`, this.scene);
          wMat.diffuseColor = new Color3(0.08, 0.08, 0.08);
          w.material = wMat;
          w.rotation.z = Math.PI / 2;
          w.parent = root;
          w.position = new Vector3(x as number, 0.3, z as number);
        }
        const mg = MeshBuilder.CreateCylinder(`mg_${unit.id}`, { diameter: 0.18, height: 1.6 }, this.scene);
        mg.material = turretMat;
        mg.rotation.x = Math.PI / 2;
        mg.parent = root;
        mg.position = new Vector3(0, 1.1, 0.8);
        break;
      }
      case 'infantry': {
        hull = MeshBuilder.CreateCylinder(`hull_${unit.id}`, { diameter: 1.2, height: 1.6, tessellation: 10 }, this.scene);
        hull.material = hullMat;
        hull.parent = root;
        hull.position.y = 0.8;
        const head = MeshBuilder.CreateSphere(`head_${unit.id}`, { diameter: 0.6 }, this.scene);
        head.material = hullMat;
        head.parent = hull;
        head.position.y = 1.0;
        break;
      }
      case 'antiTankGun': {
        hull = MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 1.8, height: 0.6, depth: 1.4 }, this.scene);
        hull.material = hullMat;
        hull.parent = root;
        hull.position.y = 0.3;
        const shield = MeshBuilder.CreateBox(`shield_${unit.id}`, { width: 2.2, height: 1.2, depth: 0.2 }, this.scene);
        shield.material = hullMat;
        shield.parent = root;
        shield.position = new Vector3(0, 0.8, 0.4);
        const barrel = MeshBuilder.CreateCylinder(`barrel_${unit.id}`, { diameter: 0.25, height: 3 }, this.scene);
        barrel.material = turretMat;
        barrel.rotation.x = Math.PI / 2;
        barrel.parent = root;
        barrel.position = new Vector3(0, 0.9, 1.4);
        turret = barrel;
        break;
      }
      default:
        hull = MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 2, height: 1, depth: 2 }, this.scene);
        hull.material = hullMat;
        hull.parent = root;
        hull.position.y = 0.5;
    }

    // Top-down marker — a small disc above the unit so it stands out on the strategic camera.
    const marker = MeshBuilder.CreateDisc(`marker_${unit.id}`, { radius: 1.0, tessellation: 16 }, this.scene);
    marker.rotation.x = Math.PI / 2;
    marker.parent = root;
    marker.position.y = 0.05;
    marker.material = markerMat;

    const selectionRing = MeshBuilder.CreateTorus(`sel_${unit.id}`, { diameter: unit.radius * 3.4, thickness: 0.18, tessellation: 24 }, this.scene);
    selectionRing.material = this.materials.selectionRing;
    selectionRing.parent = root;
    selectionRing.position.y = 0.05;
    selectionRing.isVisible = false;

    const hpBarBg = MeshBuilder.CreatePlane(`hpbg_${unit.id}`, { width: 2.6, height: 0.18 }, this.scene);
    hpBarBg.material = this.materials.hpBg;
    hpBarBg.parent = root;
    hpBarBg.position.y = 3.1;
    hpBarBg.billboardMode = 7;

    const hpBarFill = MeshBuilder.CreatePlane(`hpfill_${unit.id}`, { width: 2.5, height: 0.14 }, this.scene);
    hpBarFill.material = this.materials.hpFill;
    hpBarFill.parent = root;
    hpBarFill.position.y = 3.1;
    hpBarFill.billboardMode = 7;
    // Slight z offset so fill renders in front of bg.
    hpBarFill.position.z = -0.001;

    return {
      root,
      hull,
      turret,
      selectionRing,
      marker,
      hpBarBg,
      hpBarFill,
      isDestroyed: false,
      type: unit.type,
    };
  }

  update(unit: Unit, isSelected: boolean, isControlled: boolean) {
    const vis = this.ensureVisual(unit);

    vis.root.position.x = unit.position.x;
    vis.root.position.z = unit.position.z;

    // Sink wreck slightly.
    vis.root.position.y = unit.isDestroyed ? -0.25 : 0;

    vis.root.rotation.y = unit.rotation;
    if (vis.turret) {
      vis.turret.rotation.y = unit.turretRotation;
    }

    vis.selectionRing.isVisible = isSelected && !unit.isDestroyed;
    if (isControlled) {
      vis.selectionRing.isVisible = false; // hide when player is inside
    }

    const hpFrac = Math.max(0, Math.min(1, unit.health / unit.maxHealth));
    vis.hpBarFill.scaling.x = hpFrac;
    vis.hpBarFill.position.x = -((1 - hpFrac) * 1.25);
    vis.hpBarFill.isVisible = !unit.isDestroyed && hpFrac < 0.999;
    vis.hpBarBg.isVisible = !unit.isDestroyed && hpFrac < 0.999;

    if (unit.isDestroyed && !vis.isDestroyed) {
      vis.isDestroyed = true;
      // Tint hull dark + tilt to indicate wreck.
      const dim = new StandardMaterial(`wreck_${unit.id}`, this.scene);
      dim.diffuseColor = new Color3(0.18, 0.16, 0.14);
      dim.specularColor = new Color3(0, 0, 0);
      vis.hull.material = dim;
      if (vis.turret) {
        vis.turret.material = dim;
        vis.turret.rotation.y += 0.4;
      }
      vis.marker.isVisible = false;
      vis.root.rotation.z = 0.18;
    }

    if (isControlled) {
      vis.root.setEnabled(true);
      // Hide hull/turret meshes for controlled tank to avoid blocking view.
      // Easiest is to slightly shrink them and lower marker.
    }
  }

  removeMissing(activeIds: Set<string>) {
    for (const [id, vis] of this.visuals) {
      if (!activeIds.has(id)) {
        vis.root.dispose(false, true);
        this.visuals.delete(id);
      }
    }
  }

  dispose() {
    for (const v of this.visuals.values()) {
      v.root.dispose(false, true);
    }
    this.visuals.clear();
  }
}
