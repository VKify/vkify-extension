import type {Migration,RawSettings} from './types.js';

const initialize=(settings:RawSettings):RawSettings=>({...settings,sidebar_right:settings.sidebar_right===true});
export const migrateV36ToV37:Migration={
  to:37,
  description:'Initialize sidebar side without moving existing layouts',
  migrate:old=>({
    ...initialize(old),
    ...(Array.isArray(old.appearance_profiles)?{appearance_profiles:old.appearance_profiles.map(profile=>{
      if(!profile||typeof profile!=='object'||Array.isArray(profile)||!profile.settings||typeof profile.settings!=='object'||Array.isArray(profile.settings))return profile;
      return {...profile,settings:initialize(profile.settings)};
    })}:{}),
  }),
};
