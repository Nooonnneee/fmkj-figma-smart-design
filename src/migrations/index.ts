import * as migration_20261029_075429_initial from './20261029_075429_initial';
import * as migration_20261030_115036_dual_sync from './20261030_115036_dual_sync';
import * as migration_20261030_173534_mp_sync from './20261030_173534_mp_sync';
import * as migration_20261031_061256_latest_feature_sync from './20261031_061256_latest_feature_sync';

export const migrations = [
  {
    up: migration_20261029_075429_initial.up,
    down: migration_20261029_075429_initial.down,
    name: '20261029_075429_initial',
  },
  {
    up: migration_20261030_115036_dual_sync.up,
    down: migration_20261030_115036_dual_sync.down,
    name: '20261030_115036_dual_sync',
  },
  {
    up: migration_20261030_173534_mp_sync.up,
    down: migration_20261030_173534_mp_sync.down,
    name: '20261030_173534_mp_sync',
  },
  {
    up: migration_20261031_061256_latest_feature_sync.up,
    down: migration_20261031_061256_latest_feature_sync.down,
    name: '20261031_061256_latest_feature_sync'
  },
];
