/* Three.js 배경: 노이즈로 일렁이는 블롭 + 링 + 입자 */
import * as THREE from 'three';

const canvas = document.getElementById('webgl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 7;

  // Ashima simplex noise (3D)
  const noise = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }`;

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.32 },
    uFreq: { value: 0.9 },
    uA: { value: new THREE.Color('#62f0dd') },
    uB: { value: new THREE.Color('#1aa6c4') },
    uC: { value: new THREE.Color('#06171d') },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: noise + /* glsl */ `
      uniform float uTime; uniform float uAmp; uniform float uFreq;
      varying vec3 vNormal; varying vec3 vView; varying float vNoise;
      void main(){
        float n  = snoise(position * uFreq + vec3(uTime * 0.22));
        float n2 = snoise(position * uFreq * 2.4 - vec3(uTime * 0.31)) * 0.35;
        vec3 p = position + normal * (n + n2) * uAmp;
        vNoise = n;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
      varying vec3 vNormal; varying vec3 vView; varying float vNoise;
      void main(){
        float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.0);
        vec3 col = mix(uC, uB, smoothstep(-0.7, 0.9, vNoise));
        col = mix(col, uA, f * 0.85);
        col += uA * pow(f, 3.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const group = new THREE.Group();
  scene.add(group);

  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 48), material);
  group.add(blob);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.006, 8, 240),
    new THREE.MeshBasicMaterial({ color: '#62f0dd', transparent: true, opacity: 0.45 })
  );
  ring.rotation.x = Math.PI * 0.42;
  ring.rotation.y = -0.25;
  group.add(ring);

  // 입자
  const count = 1400;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 5 + Math.random() * 9;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i * 3 + 2] = r * Math.cos(ph) - 4;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: '#8ff7ea', size: 0.028, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(points);

  // 레이아웃: 데스크톱은 오른쪽, 모바일은 가운데
  let baseX = 0, baseY = 0, baseScale = 1;
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w / h > 1.1;
    baseX = wide ? 1.85 : 0;
    baseY = wide ? 0.35 : 0.9;
    baseScale = wide ? 1 : 0.72;
  }
  resize();
  addEventListener('resize', resize);

  // 등장 (로더가 끝나면)
  const intro = { s: 0.001 };
  const playIntro = () => gsap.to(intro, { s: 1, duration: 2, ease: 'expo.out' });
  if (window.__heroIntroDone) playIntro(); else addEventListener('hero:intro', playIntro, { once: true });

  // 마우스 패럴랙스
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    const p = window.__heroProgress || 0;
    const vel = Math.min(Math.abs(window.lenis?.velocity || 0) / 40, 1);

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    uniforms.uTime.value = t;
    uniforms.uAmp.value += (0.32 + p * 0.35 + vel * 0.35 - uniforms.uAmp.value) * 0.08;

    const s = baseScale * intro.s * (1 - p * 0.25);
    group.scale.setScalar(s);
    group.position.set(baseX + mouse.x * 0.25, baseY + p * 2.6 - mouse.y * 0.2, 0);
    blob.rotation.y = t * 0.12 + mouse.x * 0.4 + p * 2;
    blob.rotation.x = mouse.y * 0.3;
    ring.rotation.z = t * 0.15;
    points.rotation.y = t * 0.02 + mouse.x * 0.05;

    const op = 1 - THREE.MathUtils.smoothstep(p, 0.55, 1);
    canvas.style.opacity = op;
    if (op > 0.001) renderer.render(scene, camera);
  });
}
