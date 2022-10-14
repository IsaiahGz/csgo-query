import { SourceSocket } from '../index'

function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

describe('main test', () => {
	test('get info', async () => {
		let server = new SourceSocket('216.52.148.47', 27015)
		let test = await server.sendRequestRaw('a2a_ping')
		await server.closeSocket()
		console.log(test)
	})
})
