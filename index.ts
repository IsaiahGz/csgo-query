import dgram from 'dgram'

const mainHeader = Buffer.from([0xff, 0xff, 0xff, 0xff])

// Types of requests to send to a source server. On some older source engines, A2S_SERVERQUERY_GETCHALLENGE may be needed.
type RequestType = 'a2s_info' | 'a2s_player' | 'a2s_rules' | 'a2a_ping'

export interface A2S_Info {
	protocol: string,
	name: string,
	map: string,
	folder: string,
	game: string,
	id: number,
	players: number,
	maxPlayers: number,
	bots: number,
	serverType: 'dedicated' | 'listen' | 'SourceTV',
	environment: 'linux' | 'windows' | 'mac',
	visibility: boolean, // Indicates if the server requires a password
	vac: boolean, // Specifies if the server uses VAC
	version: string,
	edf: number,
	port?: number,
	steamId?: bigint,
	spectatorPort?: number,
	spectatorServerName?: string,
	keywords?: string,
	gameId?: bigint
}

// Given a buffer and start index, find where the next string ends (terminated by null character)
const findStringEnd = (buffer: Buffer, startIndex: number): number => {
	return buffer.findIndex((val, index) => {
		if (index < startIndex) return false
		else if (val == 0x00) return true
		else return false
	})
}

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
	async getInfo(): Promise<Error | A2S_Info> {
		let serverInfo = await this.sendRequestRaw('a2s_info')
		if (serverInfo instanceof Buffer) {
			const protocol = serverInfo[5].toFixed()

			const nameEnd = findStringEnd(serverInfo, 6)
			const name = serverInfo.toString('utf8', 6, nameEnd)
			const mapEnd = findStringEnd(serverInfo, nameEnd + 1)
			const map = serverInfo.toString('utf-8', nameEnd + 1, mapEnd)
			const folderEnd = findStringEnd(serverInfo, mapEnd + 1)
			const folder = serverInfo.toString('utf-8', mapEnd + 1, folderEnd)
			const gameEnd = findStringEnd(serverInfo, folderEnd + 1)
			const game = serverInfo.toString('utf-8', folderEnd + 1, gameEnd)

			const id = serverInfo.readUInt16LE(gameEnd + 1) // Two bytes long
			const players = serverInfo.readUInt8(gameEnd + 3)
			const maxPlayers = serverInfo.readUInt8(gameEnd + 4)
			const bots = serverInfo.readUInt8(gameEnd + 5)

			let serverType: A2S_Info['serverType']
			switch (serverInfo[gameEnd + 6]) {
				case 0x64:
					serverType = 'dedicated'
					break
				case 0x6c:
					serverType = 'listen'
					break
				default:
					serverType = 'SourceTV'
			}

			let environment: A2S_Info['environment']
			switch (serverInfo[gameEnd + 7]) {
				case 0x6c:
					environment = 'linux'
					break
				case 0x77:
					environment = 'windows'
					break
				default:
					environment = 'mac'
			}
			
			const visibility = serverInfo[gameEnd + 8] === 0x00 ? false : true
			const vac = serverInfo[gameEnd + 9] === 0x00 ? false : true

			const versionLength = findStringEnd(serverInfo, gameEnd + 10)
			const version = serverInfo.toString('utf-8', gameEnd + 10, versionLength)
			const edf = serverInfo.readUInt8(versionLength + 1)

			// Assign what is known so far
			const a2sInfo: A2S_Info = {
				protocol,
				name,
				map,
				folder,
				game,
				id,
				players,
				maxPlayers,
				bots,
				serverType,
				environment,
				visibility,
				vac,
				version,
				edf
			}

			// Deconstruct EDF (Extra Data Flag)
			let currentEdfIndex = versionLength + 2
			if (edf & 0x80) {
				a2sInfo.port = serverInfo.readUInt16LE(currentEdfIndex) // Two bytes
				currentEdfIndex += 2
			}
			if (edf & 0x10) {
				a2sInfo.steamId = serverInfo.readBigUInt64LE(currentEdfIndex) // Eight bytes
				currentEdfIndex += 8
			}
			if (edf & 0x40) {
				a2sInfo.spectatorPort = serverInfo.readUInt16LE(currentEdfIndex) // Two bytes
				currentEdfIndex += 2
				const spectatorLength = findStringEnd(serverInfo, currentEdfIndex)
				a2sInfo.spectatorServerName = serverInfo.toString('utf-8', currentEdfIndex, spectatorLength)
				currentEdfIndex += (spectatorLength - currentEdfIndex) + 1
			}
			if (edf & 0x20) {
				const keywordsLength = findStringEnd(serverInfo, currentEdfIndex)
				a2sInfo.keywords = serverInfo.toString('utf-8', currentEdfIndex, keywordsLength)
				currentEdfIndex += (keywordsLength - currentEdfIndex) + 1
			}
			if (edf & 0x01) {
				a2sInfo.gameId = serverInfo.readBigUInt64LE(currentEdfIndex)
			}

			return Promise.resolve(a2sInfo)
		} else return Promise.reject(serverInfo)
	}
}
