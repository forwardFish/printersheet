import 'dotenv/config'

const COLLECTIONS = [
  'users',
  'point_accounts',
  'point_ledger',
  'orders',
  'memberships',
  'share_reward_logs',
  'generation_jobs',
  'worksheet_records',
  'file_objects'
]
const SHARE_REWARD_UNIQUE_INDEX = 'uniq_user_reward_date_channel'

const envId = process.env.CLOUDBASE_ENV_ID || 'aiassistant-0517-d6en8tw82f2f7fc'

if (!process.env.TENCENTCLOUD_SECRETID || !process.env.TENCENTCLOUD_SECRETKEY) {
  console.error('Missing TENCENTCLOUD_SECRETID/TENCENTCLOUD_SECRETKEY. Set them in your local shell or .env before running this script.')
  process.exit(1)
}

const { default: CloudBase } = await import('@cloudbase/manager-node')
const app = CloudBase.init({
  envId,
  secretId: process.env.TENCENTCLOUD_SECRETID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY
})

for (const name of COLLECTIONS) {
  await app.database.createCollectionIfNotExists(name)
  console.log(`ok collection ${name}`)
}

const shareRewardIndex = await app.database.checkIndexExists('share_reward_logs', SHARE_REWARD_UNIQUE_INDEX)
if (!shareRewardIndex.Exists) {
  await app.database.updateCollection('share_reward_logs', {
    CreateIndexes: [{
      IndexName: SHARE_REWARD_UNIQUE_INDEX,
      MgoKeySchema: {
        MgoIsUnique: true,
        MgoIndexKeys: [
          { Name: 'userId', Direction: '1' },
          { Name: 'rewardDate', Direction: '1' },
          { Name: 'channel', Direction: '1' }
        ]
      }
    }]
  })
  console.log(`ok index share_reward_logs.${SHARE_REWARD_UNIQUE_INDEX}`)
}

console.log(JSON.stringify({ success: true, envId, collections: COLLECTIONS }, null, 2))
