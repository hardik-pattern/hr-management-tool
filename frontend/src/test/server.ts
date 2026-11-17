import { setupServer } from 'msw/node'

// Shared mock API for tests. Tests add their own handlers with
// server.use(...); anything unhandled fails the test (see setup.ts).
export const server = setupServer()
