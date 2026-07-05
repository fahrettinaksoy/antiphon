import { describe, it, expect } from 'vitest'
import { generateFromSchema } from './schema-faker'

describe('generateFromSchema', () => {
  it('returns the example verbatim when one is present', async () => {
    const result = await generateFromSchema({ example: { foo: 'bar' } } as never)
    expect(result).toEqual({ foo: 'bar' })
  })

  it('picks one of the enum values', async () => {
    const result = await generateFromSchema({ type: 'string', enum: ['a', 'b', 'c'] } as never)
    expect(['a', 'b', 'c']).toContain(result)
  })

  it('generates semantically-named fields for object properties', async () => {
    const result = (await generateFromSchema({
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'integer' },
        active: { type: 'boolean' }
      }
    } as never)) as Record<string, unknown>

    expect(typeof result.id).toBe('string')
    expect(String(result.email)).toContain('@')
    expect(typeof result.age).toBe('number')
    expect(typeof result.active).toBe('boolean')
  })

  it('generates an array with items matching the item schema', async () => {
    const result = (await generateFromSchema({ type: 'array', items: { type: 'integer' } } as never)) as unknown[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.every((item) => typeof item === 'number')).toBe(true)
  })

  it('returns null for an undefined schema', async () => {
    expect(await generateFromSchema(undefined)).toBeNull()
  })
})
