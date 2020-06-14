const { Extension, INPUT_METHOD, PLATFORMS, log } = require('deckboard-kit');
const net = require('net');

class SocketMessageExtension extends Extension {
	constructor() {
		super();
		this.name = 'Socket Message';
		//this.platforms = [PLATFORMS.WINDOWS, PLATFORMS.MAC, PLATFORMS.LINUX, PLATFORMS.AIX, PLATFORMS.ANDROID, PLATFORMS.SUN, PLATFORMS.OPENBSD];
		this.platforms = [PLATFORMS.WINDOWS];
		//this.configs = {};
		this.initExtension();
	}

	destroy() {
		this.rawSockets.forEach((s) => {
			s.close();
		});
		this.rawSockets = [];
	}

	initExtension() {
		this.rawSockets = [];
		this.inputs = [
			{
				label: 'Send Socket Message',
				value: 'socket-message',
				icon: 'network-wired',
				color: '#34495e',
				input: [
					{
						label: 'Host',
						ref: 'host',
						type: INPUT_METHOD.INPUT_TEXT,
						default: '',
					},
					{
						label: 'Port',
						ref: 'port',
						type: INPUT_METHOD.INPUT_TEXT,
						default: 0,
					},
					{
						label: 'Message',
						ref: 'message',
						type: INPUT_METHOD.INPUT_TEXT,
						default: '',
					},
					{
						label: 'Line Terminator',
						ref: 'terminator',
						type: INPUT_METHOD.INPUT_SELECT,
						default: '',
						items: [
							{
								label: '',
								value: '',
							},
							{
								label: 'CRLF',
								value: '\r\n',
							},
							{
								label: 'LF',
								value: '\n',
							},
							{
								label: 'CR',
								value: '\r',
							},
						],
					}
				]
			}
		];
	}

	execute(action, { host= 'localhost', port = 0, message = '', terminator = ''}) {
		log.info(`${action} ${host} ${port} ${message}`);
		this.cleanupSockets();
		switch (action) {
			case 'socket-message': {
				const s = this.getSocket(host, port);
				s.message(`${message}${terminator}`);
				break;
			}
			default:
				break;
		}
		return null;
	}

	cleanupSockets() {
		let index;
		for (let n = this.rawSockets.length - 1; n >= 0; n -= 1) {
			if (this.rawSockets[n].state === 2) {
				this.rawSockets.splice(n, 1);
			}
		}
	}

	getSocket(host, port) {
		let s = this.rawSockets.find(s => s.host === host && s.port === port);
		if (!s) {
			s = new ActiveSocket();
			s.setHost(host);
			s.setPort(port);
			this.rawSockets.push(s);
		}

		return s;
	}
}

class ActiveSocket {
	constructor() {
		this.host = '';
		this.port = 0;
		this.state = 0;
		this.messageBuffer = [];
		this.socket = null;
	}

	setHost(host) {
		this.host = host;
	}

	setPort(port) {
		this.port = port;
	}

	connect() {
		const activeSocket = this;
		const socket = net.createConnection(activeSocket.port, activeSocket.host, () => {
			log.info(`Socket connected ${activeSocket.host}:${activeSocket.port}`);
			activeSocket.state = 1;
			activeSocket.sendBuffer();
		});

		socket.on('data', (m) => {
			log.info(`Socket data received ${activeSocket.host}:${activeSocket.port} ${m}`);
		});

		socket.on('end', () => {
			log.info(`Socket closed ${activeSocket.host}:${activeSocket.port}`);
			this.close();
		});

		activeSocket.socket = socket;
	}

	close() {
		this.state = 2;
		if (this.socket) {
			this.socket.destroy();
			this.socket = null;
		}
	}

	message(m) {
		this.messageBuffer.push(m);
		this.sendBuffer();
	}

	sendBuffer() {
		const activeSocket = this;
		if (this.state === 0) {
			this.connect();
		}

		if (this.messageBuffer.length) {
			const m = this.messageBuffer.shift();
			this.socket.write(`${m}`, 'utf8', () => {
				log.info(`Socket data sent ${activeSocket.host}:${activeSocket.port} ${m}`);
			});
		}
	}
}

module.exports = new SocketMessageExtension();
