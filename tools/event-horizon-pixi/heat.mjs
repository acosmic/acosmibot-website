import {Application,Container,ImageSource,Sprite,Texture} from 'pixi.js';
import {drawNoseHeat} from '../../src/activities/event-horizon/heat-fx.mjs';
import {createHeatMesh} from '../../src/activities/event-horizon/pixi-heat.mjs';
const rocket=new Image();rocket.src='/activities/event-horizon/assets/rocket-grip.png';await rocket.decode();
const app=new Application();await app.init({canvas:document.getElementById('pixi'),width:600,height:600,resolution:2,antialias:true,autoStart:false,autoDensity:false,preference:'webgl',background:0x101827});
const group=new Container();group.position.set(300,300);app.stage.addChild(group);
const texture=new Texture({source:new ImageSource({resource:rocket})}),ship=new Sprite(texture);ship.anchor.set(.5);ship.width=ship.height=500;group.addChild(ship);
const heat=createHeatMesh();group.addChild(heat.mesh);let level=70,angle=Math.PI*.23;
function render(){
 for(const id of ['old','canvas']){const canvas=document.getElementById(id);canvas.width=canvas.height=1200;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#101827';ctx.fillRect(0,0,600,600);ctx.translate(300,300);ctx.rotate(angle);ctx.drawImage(rocket,-250,-250,500,500);
  const old=new Proxy(ctx,{get:(target,key)=>key==='translate'?()=>target.translate(500*.41,-500*.255):typeof target[key]==='function'?target[key].bind(target):target[key],set:(target,key,value)=>{target[key]=value;return true;}});
  drawNoseHeat(id==='old'?old:ctx,500,level,210,false);
 }
 group.rotation=angle;heat.update(500,level,210,false);app.render();document.getElementById('result').textContent=JSON.stringify({heat:level,rotation:angle});
}
for(const n of [0,25,70,100]){const b=document.createElement('button');b.textContent=`Heat ${n}`;b.onclick=()=>{level=n;render();};document.getElementById('controls').append(b);}
for(const n of [.12,.23,.34]){const b=document.createElement('button');b.textContent=`Angle ${n}π`;b.onclick=()=>{angle=n*Math.PI;render();};document.getElementById('controls').append(b);}
window.addEventListener('pagehide',()=>{heat.destroy();group.destroy({children:true});texture.destroy(true);app.destroy({removeView:false,releaseGlobalResources:true});},{once:true});render();
