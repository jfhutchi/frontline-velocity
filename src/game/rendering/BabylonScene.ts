import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { TACTICAL_CAMERA_MAX_BETA, TACTICAL_CAMERA_MIN_BETA, TACTICAL_CAMERA_MAX_RADIUS, TACTICAL_CAMERA_MIN_RADIUS } from '../constants';

export interface BabylonContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  hemiLight: HemisphericLight;
  sunLight: DirectionalLight;
  shadowGenerator: ShadowGenerator;
  glowLayer: GlowLayer;
  pipeline: DefaultRenderingPipeline;
}

export function createBabylonContext(canvas: HTMLCanvasElement): BabylonContext {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: true,
    adaptToDeviceRatio: true,
  });
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  engine.setHardwareScalingLevel(isTouchDevice && ratio > 1 ? Math.min(1.6, Math.max(1, ratio / 1.45)) : 1);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.42, 0.51, 0.55, 1);
  scene.ambientColor = new Color3(0.28, 0.3, 0.25);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.45, 0.49, 0.42);
  scene.fogStart = 100;
  scene.fogEnd = 310;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.04;
  scene.imageProcessingConfiguration.contrast = 1.2;

  const camera = new ArcRotateCamera(
    'tactical-cam',
    Math.PI * 0.5,
    Math.PI * 0.34,
    140,
    Vector3.Zero(),
    scene,
  );
  camera.lowerBetaLimit = TACTICAL_CAMERA_MIN_BETA;
  camera.upperBetaLimit = TACTICAL_CAMERA_MAX_BETA;
  camera.lowerRadiusLimit = TACTICAL_CAMERA_MIN_RADIUS;
  camera.upperRadiusLimit = TACTICAL_CAMERA_MAX_RADIUS;
  camera.minZ = 0.5;
  camera.maxZ = 600;
  camera.wheelDeltaPercentage = 0.04;
  camera.panningSensibility = 50;

  // Don't auto-attach inputs; CameraController owns input wiring per mode.
  const hemiLight = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
  hemiLight.intensity = 0.84;
  hemiLight.groundColor = new Color3(0.2, 0.17, 0.12);

  const sunLight = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.42), scene);
  sunLight.intensity = 1.36;
  sunLight.position = new Vector3(80, 120, 62);
  sunLight.shadowMinZ = 20;
  sunLight.shadowMaxZ = 260;
  const shadowGenerator = new ShadowGenerator(2048, sunLight);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 22;
  shadowGenerator.setDarkness(0.28);

  const glowLayer = new GlowLayer('battlefield-glow', scene, { blurKernelSize: 32 });
  glowLayer.intensity = 0.16;

  const pipeline = new DefaultRenderingPipeline('battlefield-pipeline', true, scene, [camera]);
  pipeline.samples = isTouchDevice ? 1 : 4;
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.62;
  pipeline.bloomWeight = 0.16;
  pipeline.bloomKernel = 48;
  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.18;
  pipeline.sharpen.colorAmount = 0.55;
  buildSkyDome(scene);

  return { engine, scene, camera, hemiLight, sunLight, shadowGenerator, glowLayer, pipeline };
}

export function disposeBabylonContext(ctx: BabylonContext) {
  ctx.scene.dispose();
  ctx.engine.dispose();
}

function buildSkyDome(scene: Scene) {
  const skyTexture = new DynamicTexture('proceduralSky', { width: 1024, height: 512 }, scene, true);
  const ctx = skyTexture.getContext() as CanvasRenderingContext2D;
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#7f929c');
  gradient.addColorStop(0.42, '#b7b8a9');
  gradient.addColorStop(1, '#d0b987');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 34; i += 1) {
    const x = seeded(i * 19 + 7) * 1024;
    const y = 34 + seeded(i * 23 + 2) * 165;
    const w = 70 + seeded(i * 29 + 4) * 160;
    const h = 18 + seeded(i * 31 + 5) * 48;
    const alpha = 0.16 + seeded(i * 37 + 9) * 0.18;
    const cloudGradient = ctx.createRadialGradient(x, y, 2, x, y, w);
    cloudGradient.addColorStop(0, `rgba(255,255,244,${alpha})`);
    cloudGradient.addColorStop(0.5, `rgba(244,238,220,${alpha * 0.62})`);
    cloudGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cloudGradient;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, seeded(i * 41 + 3) * 0.4 - 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  skyTexture.update();

  const sky = MeshBuilder.CreateSphere('skyDome', {
    diameter: 560,
    segments: 32,
    sideOrientation: Mesh.BACKSIDE,
  }, scene);
  sky.infiniteDistance = true;
  sky.position.y = -24;
  const skyMat = new StandardMaterial('skyDomeMat', scene);
  skyMat.disableLighting = true;
  skyMat.backFaceCulling = false;
  skyMat.diffuseTexture = skyTexture;
  skyMat.emissiveTexture = skyTexture;
  skyMat.specularColor = Color3.Black();
  sky.material = skyMat;
}

function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
