import {describe,it,expect} from 'vitest';
import {migrateV36ToV37} from './migrate_v36_to_v37.js';
describe('sidebar side migration',()=>{
  it.each([undefined,false,true,'right',null])('keeps valid choices and defaults left (%s)',value=>{
    const old={sidebar_right:value,edge_sidebar:true,unrelated:42};
    const next=migrateV36ToV37.migrate(old);
    expect(next).toEqual({...old,sidebar_right:value===true});
    expect(old.sidebar_right).toBe(value);
    expect(migrateV36ToV37.migrate(next)).toEqual(next);
  });
  it('initializes old profiles without changing modes or malformed records',()=>{
    const old={appearance_profiles:[{settings:{tile_sidebar:true}},{settings:{sidebar_right:true}},null,{settings:[]}],other:'keep'};
    const before=structuredClone(old);
    expect(migrateV36ToV37.migrate(old)).toEqual({...old,sidebar_right:false,appearance_profiles:[{settings:{tile_sidebar:true,sidebar_right:false}},{settings:{sidebar_right:true}},null,{settings:[]}]});
    expect(old).toEqual(before);
  });
});
