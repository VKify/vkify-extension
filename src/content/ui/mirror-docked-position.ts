/** Convert a dropped screen position back to its saved side when edge widgets
 * are mirrored by right-hand navigation. Free placement stays unchanged. */
export function mirrorDockedPosition<T extends {left:number;top:number}>(position:T,width:number,viewportWidth:number,mirror:boolean):T {
  const maxLeft=Math.max(0,viewportWidth-width);
  if(!mirror||(position.left>32&&maxLeft-position.left>32))return position;
  return {...position,left:Math.max(0,Math.min(maxLeft,maxLeft-position.left))};
}
