import { hashPassword, verifyPassword } from 'better-auth/crypto'

async function main() {
  const dbHash = '60bea84ff1f6709d958d12c924e7fe2a:096a597750edab41747b2445e4f2fd06b46956352045837b1205876f9ce0c0f432741c99aac613d8bb3c82b3dd6c65afb24c75a0d37bc16a975f624612f9207c'
  const newHash = await hashPassword('Admin1234!')
  console.log('New format:', newHash.slice(0, 60))
  const ok = await verifyPassword({ hash: dbHash, password: 'Admin1234!' })
  console.log('DB hash verifies:', ok)
}

main().catch(console.error).finally(() => process.exit())
