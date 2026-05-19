// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Upsert Services
  const services = [
    { id: 1, name: 'Service 1', description: 'Home Cleaning & Maintenance' },
    { id: 2, name: 'Service 2', description: 'Plumbing & Electrical' },
    { id: 3, name: 'Service 3', description: 'Painting & Renovation' },
  ]

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: { name: service.name, description: service.description },
      create: service,
    })
  }
  console.log('✅ Services seeded')

  // Upsert Providers (8 total)
  const providers = [
    { id: 1, name: 'Provider 1', email: 'provider1@prowider.com', monthlyQuota: 10, currentCount: 0 },
    { id: 2, name: 'Provider 2', email: 'provider2@prowider.com', monthlyQuota: 10, currentCount: 0 },
    { id: 3, name: 'Provider 3', email: 'provider3@prowider.com', monthlyQuota: 10, currentCount: 0 },
    { id: 4, name: 'Provider 4', email: 'provider4@prowider.com', monthlyQuota: 10, currentCount: 0 },
    { id: 5, name: 'Provider 5', email: 'provider5@prowider.com', monthlyQuota: 10, currentCount: 0 },
    { id: 6, name: 'Provider 6', email: 'provider6@prowider.com', monthlyQuota: 10, currentCount: 0 },
    { id: 7, name: 'Provider 7', email: 'provider7@prowider.com', monthlyQuota: 10, currentCount: 0 },
    { id: 8, name: 'Provider 8', email: 'provider8@prowider.com', monthlyQuota: 10, currentCount: 0 },
  ]

  for (const provider of providers) {
    await prisma.provider.upsert({
      where: { id: provider.id },
      update: { name: provider.name, email: provider.email },
      create: provider,
    })
  }
  console.log('✅ Providers seeded')

  // Initialize AllocationState for each service (persisted round-robin index)
  for (const service of services) {
    await prisma.allocationState.upsert({
      where: { serviceId: service.id },
      update: {},
      create: { serviceId: service.id, poolIndex: 0 },
    })
  }
  console.log('✅ Allocation states initialized')

  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
