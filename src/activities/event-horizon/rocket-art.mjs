// Anchors measured on each rider's 1254 × 1254 master artwork, normalized to the sprite
// centre, so a shipped asset may use any square resolution.
// The nose is the heat bow's apex; flame, trail, and engine glow leave from the nozzle.
// These normalized coordinates stay attached through ship rotation and scaling. Boost
// sparks are emitted in world space, so `sparks` is the nozzle at the resting flight angle.
const px=v=>v/1254-.5;
export const RIDERS=Object.freeze({
  rocket:{src:'rocket-grip.png',nose:[px(1202),px(302)],nozzle:[-.185,.32],sparks:[-.3,.14]},
  broom:{src:'broom-grip.webp',nose:[px(1208),px(245)],nozzle:[px(160),px(1085)],sparks:[-.48,.05]},
});
export const riderArt=id=>RIDERS[id]??RIDERS.rocket;
export const [ROCKET_NOSE_X,ROCKET_NOSE_Y]=RIDERS.rocket.nose;
export const HEAT_ANGLE=-Math.PI*.23;
export function heatAnchor(size,nose=RIDERS.rocket.nose){
  const tip=size*.035;
  return {x:size*nose[0]-Math.cos(HEAT_ANGLE)*tip,
    y:size*nose[1]-Math.sin(HEAT_ANGLE)*tip};
}
