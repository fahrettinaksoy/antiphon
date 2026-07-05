import type { Faker } from '@faker-js/faker'

interface JsonSchema {
  type?: string
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  example?: unknown
  enum?: unknown[]
  format?: string
}

// `@faker-js/faker` is ESM-only; main process bundles as CJS, so it must be loaded via dynamic import.
async function loadFaker(): Promise<Faker> {
  const module = await import('@faker-js/faker')
  return module.faker
}

// Alan adına bakarak anlamlı sahte veri üretir (Apidog'un "smart mock" özelliğinin sade karşılığı).
function fakeByFieldName(faker: Faker, fieldName: string): string | undefined {
  const name = fieldName.toLowerCase()
  if (name.includes('email')) return faker.internet.email()
  if (name === 'id' || name.endsWith('id')) return faker.string.uuid()
  if (name.includes('name')) return faker.person.fullName()
  if (name.includes('phone')) return faker.phone.number()
  if (name.includes('address')) return faker.location.streetAddress()
  if (name.includes('city')) return faker.location.city()
  if (name.includes('country')) return faker.location.country()
  if (name.includes('url') || name.includes('link')) return faker.internet.url()
  if (name.includes('image') || name.includes('avatar')) return faker.image.url()
  if (name.includes('date') || name.includes('time')) return faker.date.recent().toISOString()
  if (name.includes('price') || name.includes('amount')) return String(faker.commerce.price())
  if (name.includes('title')) return faker.lorem.sentence(4)
  if (name.includes('description') || name.includes('body') || name.includes('content')) return faker.lorem.paragraph()
  if (name.includes('color')) return faker.color.human()
  if (name.includes('company')) return faker.company.name()
  return undefined
}

function fakeByFormat(faker: Faker, format: string | undefined): string | undefined {
  switch (format) {
    case 'date-time':
      return faker.date.recent().toISOString()
    case 'date':
      return faker.date.recent().toISOString().slice(0, 10)
    case 'email':
      return faker.internet.email()
    case 'uuid':
      return faker.string.uuid()
    case 'uri':
    case 'url':
      return faker.internet.url()
    default:
      return undefined
  }
}

function generate(faker: Faker, schema: JsonSchema | undefined, fieldName: string): unknown {
  if (!schema) return null
  if (schema.example !== undefined) return schema.example
  if (schema.enum && schema.enum.length > 0) return schema.enum[Math.floor(Math.random() * schema.enum.length)]

  switch (schema.type) {
    case 'object': {
      const result: Record<string, unknown> = {}
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        result[key] = generate(faker, propSchema, key)
      }
      return result
    }
    case 'array':
      return [generate(faker, schema.items, fieldName), generate(faker, schema.items, fieldName)]
    case 'integer':
      return faker.number.int({ min: 1, max: 1000 })
    case 'number':
      return faker.number.float({ min: 0, max: 1000, fractionDigits: 2 })
    case 'boolean':
      return faker.datatype.boolean()
    case 'string':
      return fakeByFormat(faker, schema.format) ?? fakeByFieldName(faker, fieldName) ?? faker.lorem.word()
    default:
      return fakeByFieldName(faker, fieldName) ?? faker.lorem.word()
  }
}

export async function generateFromSchema(schema: JsonSchema | undefined, fieldName = ''): Promise<unknown> {
  const faker = await loadFaker()
  return generate(faker, schema, fieldName)
}
