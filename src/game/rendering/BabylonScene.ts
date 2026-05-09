import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  Vector3,
} from '@babylonjs/core';

export interface BabylonContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  hemiLight: HemisphericLight;
  sunLight: DirectionalLight;
}

export function createBabylonContext(canvas: HTMLCanvasElement): BabylonContext {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: true,
    adaptToDeviceRatio: true,
  });
  engine.setHardwareScalingLevel(1);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.07, 0.05, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.07, 0.1, 0.08);
  scene.fogStart = 120;
  scene.fogEnd = 260;

  const camera = new ArcRotateCamera(
    'tactical-cam',
    Math.PI * 0.5,
    Math.PI * 0.32,
    140,
    Vector3.Zero(),
    scene,
  );
  camera.lowerBetaLimit = 0.15;
  camera.upperBetaLimit = Math.PI * 0.49;
  camera.lowerRadiusLimit = 35;
  camera.upperRadiusLimit = 220;
  camera.minZ = 0.5;
  camera.maxZ = 600;
  camera.wheelDeltaPercentage = 0.04;
  camera.panningSensibility = 50;

  // Don't auto-attach inputs; CameraController owns input wiring per mode.
  const hemiLight = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
  hemiLight.intensity = 0.55;
  hemiLight.groundColor = new Color3(0.1, 0.15, 0.1);

  const sunLight = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.4), scene);
  sunLight.intensity = 1.1;
  sunLight.position = new Vector3(60, 80, 40);

  return { engine, scene, camera, hemiLight, sunLight };
}

export function disposeBabylonContext(ctx: BabylonContext) {
  ctx.scene.dispose();
  ctx.engine.dispose();
}
