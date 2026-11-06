import {it,expect} from 'vitest';
import {mirrorDockedPosition} from './mirror-docked-position.js';
it('mirrors docked drops while preserving free placement and vertical position',()=>{
  expect(mirrorDockedPosition({left:0,top:120},240,1600,true)).toEqual({left:1360,top:120});
  expect(mirrorDockedPosition({left:1350,top:120},240,1600,true)).toEqual({left:10,top:120});
  const free={left:500,top:200};expect(mirrorDockedPosition(free,240,1600,true)).toBe(free);
  const left={left:0,top:120};expect(mirrorDockedPosition(left,240,1600,false)).toBe(left);
  expect(mirrorDockedPosition({left:0,top:0},500,300,true)).toEqual({left:0,top:0});
});
