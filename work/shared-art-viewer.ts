import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const names:Record<string,string>={living:'Living colaborativo',study:'Sala de estudio',library:'Biblioteca moderna',projects:'Sala de proyectos',patio:'Patio de estudio',terrace:'Terraza de aprendizaje'};
const id=new URLSearchParams(location.search).get('room')??'living';
const status=document.querySelector<HTMLElement>('#status')!,host=document.querySelector<HTMLElement>('#scene')!;
if(!names[id])throw Error('Sala desconocida');
document.querySelector('h1')!.textContent=names[id];
const scene=new T.Scene();scene.background=new T.Color('#e9e3d9');
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.appendChild(renderer.domElement);
const camera=new T.PerspectiveCamera(36,1,.1,100);camera.position.set(9,9,12);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.enablePan=false;controls.minDistance=7;controls.maxDistance=23;controls.maxPolarAngle=Math.PI*.46;controls.minPolarAngle=.35;controls.minAzimuthAngle=-.45;controls.maxAzimuthAngle=1.35;controls.update();
scene.add(new T.HemisphereLight('#fff1d8','#667482',1.5));
const key=new T.DirectionalLight('#ffe3bd',3.4);key.position.set(-3,8,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:25});key.shadow.bias=-.0003;key.shadow.normalBias=.02;scene.add(key);
const fill=new T.DirectionalLight('#c4d8ff',1.05);fill.position.set(5,5,-2);scene.add(fill);
const plane=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#d8cfc0',roughness:1}));plane.rotation.x=-Math.PI/2;plane.position.y=-.27;plane.receiveShadow=true;scene.add(plane);
let needsFrame=true,disposed=false;
controls.addEventListener('change',()=>{needsFrame=true});
const resize=new ResizeObserver(()=>{camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);needsFrame=true;});resize.observe(host);
document.querySelector('#reset')!.addEventListener('click',()=>{camera.position.set(9,9,12);controls.target.set(0,1,0);controls.update();needsFrame=true});
document.querySelector('#closer')!.addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(.83).add(controls.target);controls.update();needsFrame=true});
document.querySelector('#further')!.addEventListener('click',()=>{camera.position.sub(controls.target).multiplyScalar(1.2).add(controls.target);controls.update();needsFrame=true});
try{
 const gltf=await new GLTFLoader().loadAsync('/models/'+id+'-reduced.glb');
 gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=!o.userData.scenic_panel;o.receiveShadow=!o.userData.scenic_panel;if(o.userData.scenic_panel){const old=Array.isArray(o.material)?o.material:[o.material];o.material=new T.MeshBasicMaterial({vertexColors:true,toneMapped:false});old.forEach(m=>m.dispose());}}});key.shadow.normalBias=.055;scene.add(gltf.scene);needsFrame=true;status.textContent='Modelo 3D real · Arrastrá para girar; acercá para revisar los detalles.';
}catch{status.textContent='No se pudo cargar este modelo. El render y el archivo Blender siguen disponibles en la galería.';}
function frame(){if(disposed)return;requestAnimationFrame(frame);if(!document.hidden&&needsFrame){renderer.render(scene,camera);needsFrame=false;}}frame();
document.addEventListener('visibilitychange',()=>{needsFrame=true});
window.addEventListener('pagehide',()=>{disposed=true;resize.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();renderer.forceContextLoss();});
