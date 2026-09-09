'use client';

import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import styles from './page.module.css';

type Props = { progress: RefObject<number>; filmId: number; motion: boolean };

export default function CinemaScene({ progress, filmId, motion }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const inputs = useRef({ filmId, motion });
  useEffect(() => { inputs.current = { filmId, motion }; }, [filmId, motion]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: element, antialias: true, powerPreference: 'high-performance' });
    } catch {
      element.dataset.failed = 'true';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const daylight = new THREE.Color('#e8e5df');
    const darkness = new THREE.Color('#17171c');
    scene.background = daylight.clone();
    scene.fog = new THREE.Fog(daylight, 75, 140);
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 150);
    const theatre = new THREE.Group();
    scene.add(theatre);

    const stone = new THREE.MeshStandardMaterial({ color: '#cfc8bb', roughness: .87 });
    const trim = new THREE.MeshStandardMaterial({ color: '#e9e2d5', roughness: .72 });
    const velvet = new THREE.MeshStandardMaterial({ color: '#682a34', roughness: .92 });
    const seatTrim = new THREE.MeshStandardMaterial({ color: '#371c24', roughness: .75 });
    const brass = new THREE.MeshStandardMaterial({ color: '#9e7850', metalness: .72, roughness: .38 });
    const charcoal = new THREE.MeshStandardMaterial({ color: '#282423', roughness: .8 });
    const carpet = new THREE.MeshStandardMaterial({ color: '#6b4e48', roughness: 1 });
    const glow = new THREE.MeshBasicMaterial({ color: '#ffdca9' });
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const box = (size: number[], position: number[], material: THREE.Material, parent: THREE.Object3D = theatre) => {
      const mesh = new THREE.Mesh(unitBox, material);
      mesh.scale.set(size[0], size[1], size[2]);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const groundMaterial = new THREE.MeshStandardMaterial({ color: daylight, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.6;
    ground.receiveShadow = true;
    scene.add(ground);

    // A cutaway cinema: the open side keeps the screen and central aisle visible.
    box([11.8, .48, 13.6], [0, -.24, .2], stone);
    box([12.05, .12, 13.85], [0, -.5, .2], trim);
    box([11.8, 7.1, .48], [0, 3.55, -6.4], stone);
    box([12.05, .16, .7], [0, 7.1, -6.4], trim);
    box([.32, 4.7, 13.2], [-5.74, 2.35, .25], stone);
    box([.45, .12, 13.4], [-5.74, 4.7, .25], trim);
    box([.3, 1.8, 13.2], [5.75, .9, .25], stone);
    box([.43, .12, 13.4], [5.75, 1.8, .25], trim);
    box([11.3, .08, 2.8], [0, .04, -4.5], charcoal);
    box([10.1, 5.05, .17], [0, 3.8, -6.08], charcoal);
    box([10.3, .055, .22], [0, 6.36, -6], brass);
    box([10.3, .055, .22], [0, 1.24, -6], brass);

    const screenMaterial = new THREE.MeshBasicMaterial({ color: '#e3dcca', toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 4.72), screenMaterial);
    screen.position.set(0, 3.8, -5.96);
    theatre.add(screen);

    const curtainGeometry = new THREE.CylinderGeometry(.14, .17, 5.7, 12);
    for (const side of [-1, 1]) {
      for (let fold = 0; fold < 4; fold++) {
        const curtain = new THREE.Mesh(curtainGeometry, velvet);
        curtain.position.set(side * (5.05 + fold * .19), 3.45, -5.82);
        curtain.castShadow = true;
        theatre.add(curtain);
      }
      // Wall sconces and acoustic pilasters.
      for (let pillar = 0; pillar < 5; pillar++) {
        const z = -4.6 + pillar * 2.45;
        box([.19, side < 0 ? 4.45 : 1.65, .16], [side * 5.55, side < 0 ? 2.22 : .83, z], trim);
        if (side < 0) {
          box([.14, .6, .21], [-5.49, 3.3, z + .75], brass);
          box([.03, .45, .16], [-5.405, 3.3, z + .75], glow);
        }
      }
    }

    const chairPositions: THREE.Vector3[] = [];
    for (let row = 0; row < 6; row++) {
      const level = row * .29;
      const z = -1.9 + row * 1.31;
      box([11.25, .12 + level, 1.31], [0, level / 2 + .06, z], stone);
      box([10.95, .035, 1.25], [0, level + .14, z], carpet);
      for (const side of [-1, 1]) {
        box([.035, .03, .96], [side * .72, level + .17, z], glow);
        for (let column = 0; column < 5; column++) {
          chairPositions.push(new THREE.Vector3(side * (1.2 + column * .89), level + .17, z));
        }
      }
      // Two smaller steps between each pair of seating tiers.
      box([1.3, .145, .4], [0, level + .07, z - .7], stone);
    }

    function chairPart(geometry: THREE.BufferGeometry, material: THREE.Material, offset: number[], tilt = 0) {
      const mesh = new THREE.InstancedMesh(geometry, material, chairPositions.length);
      const transform = new THREE.Object3D();
      chairPositions.forEach((position, index) => {
        transform.position.copy(position).add(new THREE.Vector3(...offset));
        transform.rotation.x = tilt;
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      theatre.add(mesh);
    }
    chairPart(new RoundedBoxGeometry(.73, .85, .2, 3, .095), velvet, [0, .86, .29], -.1);
    chairPart(new RoundedBoxGeometry(.66, .17, .64, 3, .065), velvet, [0, .46, -.01]);
    chairPart(new RoundedBoxGeometry(.61, .55, .13, 2, .055), seatTrim, [0, .81, .4], -.1);
    chairPart(new THREE.BoxGeometry(.46, .33, .41), charcoal, [0, .23, .09]);
    for (const side of [-1, 1]) {
      chairPart(new RoundedBoxGeometry(.09, .095, .64, 2, .035), brass, [side * .38, .67, .01]);
      chairPart(new THREE.BoxGeometry(.05, .43, .07), seatTrim, [side * .38, .4, .15]);
    }

    // A working visual source for the beam, suspended above the back row.
    box([.065, 2.8, .065], [0, 3.6, 6.2], brass);
    box([.68, .43, .82], [0, 5.18, 6.2], charcoal);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .2, 24), brass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 5.18, 5.7);
    theatre.add(lens);
    const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(.115, 24), glow);
    lensGlass.rotation.y = Math.PI;
    lensGlass.position.set(0, 5.18, 5.58);
    theatre.add(lensGlass);

    const beamGeometry = new THREE.BufferGeometry();
    const origin = [0, 5.18, 5.6];
    const corners = [[-4.9, 1.44, -5.94], [4.9, 1.44, -5.94], [4.9, 6.16, -5.94], [-4.9, 6.16, -5.94]];
    const vertices: number[] = [];
    corners.forEach((corner, index) => vertices.push(...origin, ...corner, ...corners[(index + 1) % 4]));
    beamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const beamMaterial = new THREE.MeshBasicMaterial({ color: '#bcd1ff', transparent: true, opacity: .018, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    theatre.add(new THREE.Mesh(beamGeometry, beamMaterial));

    const dustGeometry = new THREE.BufferGeometry();
    const particles = new Float32Array(150 * 3);
    for (let i = 0; i < particles.length; i += 3) {
      particles[i] = Math.sin(i * 12.9898) * 4;
      particles[i + 1] = 1.5 + Math.abs(Math.sin(i * 7.31)) * 4;
      particles[i + 2] = Math.cos(i * 5.78) * 5;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    const particleCanvas = document.createElement('canvas');
    particleCanvas.width = particleCanvas.height = 32;
    const context = particleCanvas.getContext('2d')!;
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, '#ffffffff');
    gradient.addColorStop(.3, '#ffffff80');
    gradient.addColorStop(1, '#ffffff00');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    const particleTexture = new THREE.CanvasTexture(particleCanvas);
    const dustMaterial = new THREE.PointsMaterial({ color: '#f4e5cd', map: particleTexture, size: .035, transparent: true, opacity: .2, depthWrite: false });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    theatre.add(dust);

    const ambient = new THREE.HemisphereLight('#fff4df', '#8e8796', 2.5);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight('#fff1d8', 4.2);
    sun.position.set(-9, 18, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.normalBias = .035;
    sun.shadow.bias = -.0001;
    sun.shadow.radius = 4;
    scene.add(sun);
    const screenLight = new THREE.PointLight('#9bb0ff', 16, 17, 2);
    screenLight.position.set(0, 4, -4.8);
    scene.add(screenLight);

    let disposed = false;
    const textures = new Map<number, THREE.Texture>();
    const loader = new THREE.TextureLoader();
    for (const id of [313369, 157336, 693134]) {
      const texture = loader.load(`/landing/cinema/${id}-backdrop.jpg`, () => {
        if (disposed) texture.dispose();
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      // Crop the 16:9 still to the theatre's wider screen without stretching it.
      texture.repeat.y = (16 / 9) / (9.8 / 4.72);
      texture.offset.y = (1 - texture.repeat.y) / 2;
      textures.set(id, texture);
    }

    let frame = 0;
    let visible = true;
    let current = progress.current;
    let lastTime = 0;
    let mobile = false;
    let previousFilm = 0;
    const pointer = new THREE.Vector2();
    const currentPointer = new THREE.Vector2();
    const target = new THREE.Vector3();
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const lookFrom = new THREE.Vector3();
    const lookTo = new THREE.Vector3();
    const mixColor = new THREE.Color();
    const resize = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      mobile = width < 700;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    resize();
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer.set(event.clientX / window.innerWidth - .5, event.clientY / window.innerHeight - .5);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    function render(time: number) {
      if (disposed || !visible || document.hidden) { frame = 0; return; }
      const dt = Math.min((time - lastTime) / 1000, .05);
      lastTime = time;
      const enabled = inputs.current.motion;
      current = enabled ? THREE.MathUtils.damp(current, progress.current, 7, dt) : 0;
      currentPointer.lerp(enabled ? pointer : new THREE.Vector2(), .035);
      const p = current;
      const lightsDown = THREE.MathUtils.smoothstep(p, .18, .62);
      mixColor.copy(daylight).lerp(darkness, lightsDown);
      (scene.background as THREE.Color).copy(mixColor);
      (scene.fog as THREE.Fog).color.copy(mixColor);
      groundMaterial.color.copy(mixColor);
      ambient.intensity = 2.5 - lightsDown * 2.15;
      sun.intensity = 4.2 - lightsDown * 4;
      beamMaterial.opacity = .014 + lightsDown * .037;
      dustMaterial.opacity = .15 + lightsDown * .35;
      if (enabled) dust.rotation.y += dt * .018;

      const waypoints = mobile
        ? [[.0, 33, 33, 52, 0, 8, 0], [.34, 5, 8, 15, 0, 2.5, -1], [.66, 0, 3.8, 5, 0, 3.8, -5.9], [1, 0, 3.8, -5, 0, 3.8, -5.96]]
        : [[.0, 16.5, 13.2, 23.1, -4.6, 1.2, 0], [.34, 6.5, 8, 16, 0, 2.4, -.5], [.66, 0, 3.8, 5, 0, 3.8, -5.9], [1, 0, 3.8, -5, 0, 3.8, -5.96]];
      let segment = 0;
      while (segment < waypoints.length - 2 && p > waypoints[segment + 1][0]) segment++;
      const a = waypoints[segment];
      const b = waypoints[segment + 1];
      const t = THREE.MathUtils.smoothstep(p, a[0], b[0]);
      from.set(a[1], a[2], a[3]);
      to.set(b[1], b[2], b[3]);
      lookFrom.set(a[4], a[5], a[6]);
      lookTo.set(b[4], b[5], b[6]);
      camera.position.lerpVectors(from, to, t);
      camera.position.x += currentPointer.x * 1.3 * (1 - p);
      camera.position.y += currentPointer.y * .65 * (1 - p);
      target.lerpVectors(lookFrom, lookTo, t);
      camera.lookAt(target);
      if (previousFilm !== inputs.current.filmId) {
        previousFilm = inputs.current.filmId;
        screenMaterial.map = textures.get(previousFilm)!;
        screenMaterial.color.set('#ffffff');
        screenMaterial.needsUpdate = true;
      }
      renderer.render(scene, camera);
      element!.dataset.ready = 'true';
      frame = requestAnimationFrame(render);
    }
    const resume = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render); };
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); });
    intersection.observe(element);
    document.addEventListener('visibilitychange', resume);
    resume();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', resume);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      particleTexture.dispose();
      renderer.dispose();
    };
  }, [progress]);

  return <canvas ref={canvas} className={styles.cinemaCanvas} aria-hidden="true" />;
}
