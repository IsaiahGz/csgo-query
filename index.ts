import dgram from 'dgram'

const mainHeader = Buffer.from([0xff, 0xff, 0xff, 0xff])

// Types of requests to send to a source server. On some older source engines, A2S_SERVERQUERY_GETCHALLENGE may be needed.
type RequestType = 'a2s_info' | 'a2s_player' | 'a2s_rules' | 'a2a_ping'

export class SourceSocket {
	remoteAddress: string
	remotePort: number
	socket: dgram.Socket
	isConnected: boolean = false


	constructor(remoteAddress: string, remotePort: number) {
		this.remoteAddress = remoteAddress
		this.remotePort = remotePort
		this.socket = dgram.createSocket('udp4')

		this.socket.on('connect', () => {
			this.isConnected = true
		})

		this.socket.on('close', () => {
			this.isConnected = false
		})

		this.socket.on('error', (err) => {
			console.error(err)
		})

		this.socket.bind() // Bind socket
	}

	// Closes the socket
	async closeSocket() {
		const close_promise = new Promise((resolve, reject) => {
			this.socket.close(() => {
				resolve(true)
			})
		})
		return close_promise
	}

	// Disconnects the socket connection, if there is one
	disconnectSocket() {
		if (this.isConnected) {
			this.socket.disconnect()
			this.isConnected = false
		}
	}

	// Creates the initial request buffer to send the server depending on request type
	createRequest(requestType: RequestType) {
		let requestHeader: Buffer
		switch (requestType) {
			case 'a2s_info':
				requestHeader = Buffer.concat([
					Buffer.from([0x54]),
					Buffer.from('Source Engine Query\0'),
				])
				break
			case 'a2s_player':
				requestHeader = Buffer.from([0x55])
				break
			case 'a2s_rules':
				requestHeader = Buffer.from([0x56])
				break
			case 'a2a_ping':
				requestHeader = Buffer.from([0x69])
				break
		}
		return Buffer.concat([mainHeader, requestHeader])
	}

	// Sends a request to the server and returns raw server result as a buffer
	async sendRequestRaw(requestType: RequestType): Promise<Buffer | Error> {
		let request = this.createRequest(requestType)
		const requestPromise: Promise<Buffer | Error> = new Promise((resolve, reject) => {
			// Create listener to receive response from server. Also handles challenge
			this.socket.once('message', (initMessage) => {
				// Check if a challenge was received
				if (initMessage[4] === 0x41) {
					const challenge = Buffer.concat([request, initMessage.subarray(5)])
					this.socket.once('message', (finalMessage) => resolve(finalMessage))
					this.socket.send(
						challenge,
						this.remotePort,
						this.remoteAddress,
						(err) => {
							if (err) reject(err)
						}
					)
				} else {
					resolve(initMessage)
				}
			})

			// Send request
			this.socket.send(request, this.remotePort, this.remoteAddress, (err) => {
				if (err) reject(err)
			})
		})
		return requestPromise
	}

	// Sends a2s_info to server and returns an object
	async getInfo() {
		let serverInfo = await this.sendRequestRaw('a2s_info')
		if (serverInfo instanceof Buffer) {
			// TODO: Format buffer into object
		}
	}
}
