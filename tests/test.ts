import { SourceSocket, A2S_Info } from '../index'

function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

describe('main test', () => {
	test('get info', async () => {
		let server = new SourceSocket('216.52.148.47', 27015)
		let test = await server.getInfo()
		await server.closeSocket()
		expect(test).toHaveProperty('protocol')
		expect(test).toHaveProperty('name')
		expect(test).toHaveProperty('port', 27015)
	})
})
