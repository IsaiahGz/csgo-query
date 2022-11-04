import { SourceSocket, A2S_Info } from '../index'

let server: SourceSocket

beforeAll(() => {
	server = new SourceSocket('216.52.148.47', 27015)
})

afterAll(async () => {
	await server.closeSocket()
})

describe('main test', () => {
	test('get info', async () => {
		const infoResult = await server.getInfo()
		expect(infoResult).toHaveProperty('protocol')
		expect(infoResult).toHaveProperty('name')
		expect(infoResult).toHaveProperty('port', 27015)	
	})

	test('get players', async () => {
		const playersResult = await server.getPlayers()
	})
})
