import { describe, expect, it } from 'vitest';
import { Migrator } from '../Migrator.js';
import type { RawSettings } from './types.js';
import { migrateV19ToV20 } from './migrate_v19_to_v20.js';

const wallpaper = { url: 'https://example.com/day.jpg', type: 'image', presetId: 'day', webId: '', webSchema: '[]' };
const completeSchedule = JSON.stringify({ dayStart: '08:30', nightStart: '21:15', day: wallpaper,
  night: { ...wallpaper, url: 'https://example.com/night.webm', type: 'video' } });

describe('v20 wallpaper scheduling', () => {
  it('adds disabled defaults without mutating existing wallpaper or preferences', () => {
    const old = Object.freeze({ custom_background: 'https://example.com/manual.jpg', background_type: 'image',
      background_preset_id: 'manual', web_wallpaper_id: '', web_wallpaper_schema: '[]', custom_font: 'Existing' });
    const next = migrateV19ToV20.migrate(old);
    expect(next).toEqual({ ...old, wallpaper_schedule_enabled: false,
      wallpaper_schedule: JSON.stringify({ dayStart: '07:00', nightStart: '22:00', day: null, night: null }) });
    expect(old).not.toHaveProperty('wallpaper_schedule');
    expect(migrateV19ToV20.migrate(next)).toEqual(next);
  });

  it.each([true, false])('preserves a complete schedule and its enabled choice (%s)', enabled => {
    const old = Object.freeze({ wallpaper_schedule: completeSchedule, wallpaper_schedule_enabled: enabled });
    expect(migrateV19ToV20.migrate(old)).toEqual(old);
  });

  it('keeps configured times and remaining wallpaper but disables an incomplete schedule', () => {
    const schedule = JSON.stringify({ ...JSON.parse(completeSchedule), night: null });
    expect(migrateV19ToV20.migrate({ wallpaper_schedule: schedule, wallpaper_schedule_enabled: true }))
      .toEqual({ wallpaper_schedule: schedule, wallpaper_schedule_enabled: false });
  });

  it.each([undefined, null, 'invalid', '{"dayStart":"bad"}', JSON.stringify({ ...JSON.parse(completeSchedule),
    day: { ...wallpaper, url: 'javascript:alert(1)' } })])('resets an invalid schedule and disables it (%j)', schedule => {
    const next = migrateV19ToV20.migrate({ wallpaper_schedule: schedule, wallpaper_schedule_enabled: true });
    expect(next.wallpaper_schedule_enabled).toBe(false);
    expect(JSON.parse(next.wallpaper_schedule as string)).toEqual({ dayStart: '07:00', nightStart: '22:00', day: null, night: null });
  });

  it.each([undefined, null, 'true', 1])('defaults a missing or invalid toggle to false (%j)', enabled => {
    expect(migrateV19ToV20.migrate({ wallpaper_schedule: completeSchedule, wallpaper_schedule_enabled: enabled }))
      .toEqual({ wallpaper_schedule: completeSchedule, wallpaper_schedule_enabled: false });
  });

  it('backs up v19 through the registry and runs only once', async () => {
    const data: RawSettings = { schema_version: 19, custom_background: 'https://example.com/manual.jpg' };
    const original = structuredClone(data);
    const migrator = new Migrator({
      async getAll() { return structuredClone(data); },
      async setMultiple(values) { Object.assign(data, structuredClone(values)); },
      async remove(keys) { keys.forEach(key => delete data[key]); },
    }, { verbose: false, targetVersion: 20 });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 20, appliedSteps: [20], backupKey: 'settings_backup_v19' });
    expect(data.settings_backup_v19).toEqual(original);
    expect(data).toMatchObject({ schema_version: 20, custom_background: original.custom_background, wallpaper_schedule_enabled: false });
    const first = structuredClone(data);
    expect(await migrator.migrate()).toMatchObject({ migrated: false, appliedSteps: [] });
    expect(data).toEqual(first);
  });
});
