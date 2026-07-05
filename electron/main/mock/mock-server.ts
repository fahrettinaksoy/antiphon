import Fastify, { type FastifyInstance } from 'fastify'
import yaml from 'js-yaml'
import { generateFromSchema } from './schema-faker'

interface OpenApiOperation {
  summary?: string
  responses?: Record<string, { content?: Record<string, { schema?: unknown; example?: unknown }> }>
}

interface OpenApiDocument {
  paths?: Record<string, Record<string, OpenApiOperation>>
}

export interface MockRouteSummary {
  method: string
  path: string
}

export interface MockServerStatus {
  running: boolean
  port: number | null
  routes: MockRouteSummary[]
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

let server: FastifyInstance | null = null
let currentStatus: MockServerStatus = { running: false, port: null, routes: [] }

function toFastifyPath(openApiPath: string): string {
  // "/users/{id}" -> "/users/:id"
  return openApiPath.replace(/\{([^}]+)\}/g, ':$1')
}

function pickSuccessResponse(operation: OpenApiOperation): { schema?: unknown; example?: unknown } | undefined {
  const responses = operation.responses ?? {}
  const successKey = Object.keys(responses).find((code) => code.startsWith('2')) ?? Object.keys(responses)[0]
  if (!successKey) return undefined
  return responses[successKey]?.content?.['application/json']
}

export async function startMockServer(specText: string, port: number): Promise<MockServerStatus> {
  await stopMockServer()

  const doc = (specText.trim().startsWith('{') ? JSON.parse(specText) : yaml.load(specText)) as OpenApiDocument
  const fastify = Fastify({ logger: false })
  const routes: MockRouteSummary[] = []

  for (const [path, operations] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = operations[method]
      if (!operation) continue

      const content = pickSuccessResponse(operation)
      const fastifyPath = toFastifyPath(path)

      fastify.route({
        method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url: fastifyPath,
        handler: async (_request, reply) => {
          const body = content?.example ?? (await generateFromSchema(content?.schema as never))
          reply.send(body ?? {})
        }
      })

      routes.push({ method: method.toUpperCase(), path: fastifyPath })
    }
  }

  await fastify.listen({ port, host: '127.0.0.1' })
  server = fastify
  currentStatus = { running: true, port, routes }
  return currentStatus
}

export async function stopMockServer(): Promise<void> {
  if (server) {
    await server.close()
    server = null
  }
  currentStatus = { running: false, port: null, routes: [] }
}

export function getMockServerStatus(): MockServerStatus {
  return currentStatus
}
