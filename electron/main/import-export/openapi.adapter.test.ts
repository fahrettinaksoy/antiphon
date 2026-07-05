import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importOpenapiSpec } from './openapi.adapter'
import { buildWorkspaceTree, readRequestFile } from '../workspace/workspace-service'

describe('importOpenapiSpec', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'antiphon-openapi-test-'))
  })

  it('generates one request per path+method, grouped by tag', async () => {
    const spec = {
      info: { title: 'Sample API' },
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/pets': {
          get: { summary: 'List pets', tags: ['pets'], parameters: [{ name: 'limit', in: 'query', example: 10 }] },
          post: {
            summary: 'Create pet',
            tags: ['pets'],
            requestBody: { content: { 'application/json': { example: { name: 'Rex' } } } }
          }
        }
      }
    }

    const result = await importOpenapiSpec(JSON.stringify(spec), dir)
    expect(result.importedCount).toBe(2)

    const tree = await buildWorkspaceTree(dir)
    const petsFolder = tree.children?.find((c) => c.name === 'pets')
    expect(petsFolder?.children).toHaveLength(2)

    const listPets = petsFolder!.children!.find((c) => c.name === 'List pets')!
    const listPetsFile = await readRequestFile(listPets.path)
    expect(listPetsFile.url).toBe('https://api.example.com/pets')
    expect(listPetsFile.params).toContainEqual({ key: 'limit', value: '10', enabled: true })

    const createPet = petsFolder!.children!.find((c) => c.name === 'Create pet')!
    const createPetFile = await readRequestFile(createPet.path)
    expect(createPetFile.method).toBe('POST')
    expect(JSON.parse(createPetFile.body.content ?? '{}')).toEqual({ name: 'Rex' })
  })

  it('groups untagged operations by the first path segment', async () => {
    const spec = {
      paths: {
        '/orders/{id}': {
          get: { operationId: 'getOrder' }
        }
      }
    }
    const result = await importOpenapiSpec(JSON.stringify(spec), dir)
    expect(result.importedCount).toBe(1)

    const tree = await buildWorkspaceTree(dir)
    expect(tree.children?.[0].name).toBe('orders')
  })
})
