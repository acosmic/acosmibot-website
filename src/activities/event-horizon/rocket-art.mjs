// Nose apex measured in the 1254 × 1254 rocket-grip.png source artwork.
// These normalized coordinates stay attached through ship rotation and scaling.
export const ROCKET_NOSE_X=1202/1254-.5;
export const ROCKET_NOSE_Y=302/1254-.5;
export const HEAT_ANGLE=-Math.PI*.23;
export function heatAnchor(size){
  const tip=size*.035;
  return {x:size*ROCKET_NOSE_X-Math.cos(HEAT_ANGLE)*tip,
    y:size*ROCKET_NOSE_Y-Math.sin(HEAT_ANGLE)*tip};
}
