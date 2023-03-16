import { WebSocket } from 'ws';
import { GatewayPayload, GatewayOpcodes, GatewayIntent, GatewayPayloadDispatch, GatewayDispatch, ApiGatewayInfo, GatewayDispatchData, GatewayOpcodescodesData, VoiceOpcodesData, VoiceOpcodes, VoicePayload } from './types';
import { computeIntents } from './utils';
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events'
import { DiscordGatewayAdapterImplementerMethods, DiscordGatewayAdapterLibraryMethods, joinVoiceChannel, VoiceConnection as DiscordJsVoiceConnection, } from '@discordjs/voice'
import { GatewayVoiceState } from 'discord-api-types/v10';


export class VoiceConnection {
	guildId: string;
	channelId: string;
	ws: Gateway;
	vc: DiscordJsVoiceConnection;
	constructor(ws: Gateway, guildId: string, channelId: string, selfDeaf: boolean, selfMute: boolean) {

		this.guildId = guildId;
		this.channelId = channelId;
		this.ws = ws

		const voiceAdapter = (methods: DiscordGatewayAdapterLibraryMethods): DiscordGatewayAdapterImplementerMethods => {
			//console.log("Adapter Called")


			const onVoiceServerUpdate = (data: GatewayDispatchData[GatewayDispatch.VOICE_SERVER_UPDATE]) => {
				if (data.guild_id === guildId) {
					methods.onVoiceServerUpdate(data);
				}
			}

			const onVoiceStateUpdate = (data: GatewayDispatchData[GatewayDispatch.VOICE_STATE_UPDATE]) => {
				if (data.guild_id === guildId) {
					methods.onVoiceStateUpdate((data as unknown) as GatewayVoiceState);
				}
			}

			this.ws.onDispatchEvent(GatewayDispatch.VOICE_SERVER_UPDATE, onVoiceServerUpdate)
			this.ws.onDispatchEvent(GatewayDispatch.VOICE_STATE_UPDATE, onVoiceStateUpdate)

			this.ws.send<GatewayOpcodes.VOICE_STATE_UPDATE>({
				t: null,
				s: null,
				op: GatewayOpcodes.VOICE_STATE_UPDATE,
				d: {
					guild_id: guildId,
					channel_id: channelId,
					self_mute: selfMute,
					self_deaf: selfDeaf
				}
			})

			return { sendPayload: this.ws.sendRaw, destroy: this.onDestroyConnection }
		}


		this.vc = joinVoiceChannel({
			channelId: this.channelId,
			guildId: this.guildId,
			selfDeaf: selfDeaf,
			selfMute: selfDeaf,
			adapterCreator: voiceAdapter,
			debug: true
		})


	}

	onDestroyConnection() {

	}


}

export class Gateway {
	identifyPayload: GatewayPayload<GatewayOpcodes.IDENTIFY>;
	token: string;
	intents: number;
	heartbeatInterval: null | ReturnType<typeof setInterval>;
	readyData: GatewayPayloadDispatch<GatewayDispatch.READY>['d'] | null;
	lastSequence: null | number;
	api: AxiosInstance;
	ws: WebSocket | null;
	gatewayInfo: null | ApiGatewayInfo;
	emitter: EventEmitter;
	constructor(token: string, intents: GatewayIntent[]) {
		this.emitter = new EventEmitter();
		this.token = token
		this.intents = computeIntents(intents)
		this.identifyPayload = {
			t: null,
			s: null,
			op: GatewayOpcodes.IDENTIFY,
			d: {
				token: this.token,
				intents: this.intents,
				properties: {
					os: process.platform.toLowerCase(),
					browser: 'discord-websocket-api',
					device: 'discord-websocket-api'
				}
			}
		}
		this.lastSequence = null;
		this.readyData = null;
		this.ws = null;//new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
		this.gatewayInfo = null;
		this.api = axios.create({
			baseURL: `https://discord.com/api/v10`,
			headers: {
				"Authorization": `Bot ${this.token}`,
				"User-Agent": 'discord-websocket-api'
			},
		})

		this.heartbeatInterval = null;
		this.api.get<ApiGatewayInfo>('/gateway/bot').then((resp) => {
			this.gatewayInfo = resp.data
			this.ws = new WebSocket(`${this.gatewayInfo.url}/?v=10&encoding=json`);
			this.ws.on('message', this.onMessage.bind(this))
		})

	}

	connectToVoice(guildId: string, channelId: string, selfMute = false, selfDeaf = false) {
		return new VoiceConnection(this, guildId, channelId, selfDeaf, selfMute);
	}

	send<T extends keyof GatewayOpcodescodesData = any>(d: GatewayPayload<T>): boolean {
		if (!this.ws) return false;
		this.sendRaw(d)
		return true;
	}

	sendRaw(d: any): boolean {
		if (!this.ws) return false;
		this.ws.send(JSON.stringify(d))
		//console.log("Gateway OUT  >>", d)
		return true;
	}

	heartbeat() {
		this.send({
			op: GatewayOpcodes.HEARTBEAT,
			d: this.lastSequence,
			s: null,
			t: null
		})
	}

	async handleGatewayHello(event: GatewayPayload<GatewayOpcodes.HELLO>) {
		this.heartbeatInterval = setInterval(this.heartbeat.bind(this), event.d.heartbeat_interval);
		this.heartbeat();
	}

	async handleReady(dispatch: GatewayPayloadDispatch<GatewayDispatch.READY>) {
		this.readyData = dispatch.d;
	}

	async handleGatewayDispatch(dispatch: GatewayPayload<GatewayOpcodes.DISPATCH>) {
		this.lastSequence = dispatch.s
		if (dispatch.t === null) return;
		this.emitDispatchEvent(dispatch.t, dispatch.d)
		switch (dispatch.t) {
			case GatewayDispatch.READY:
				this.handleReady(dispatch as GatewayPayloadDispatch<GatewayDispatch.READY>);
				break;
			default:

				break;
		}
	}

	async onMessage(m: Buffer) {
		const payload: GatewayPayload<any> = JSON.parse(m.toString())
		//console.log("Gateway IN   <<", payload)
		this.emitEvent(payload.op, payload.d)
		switch (payload.op) {
			case GatewayOpcodes.DISPATCH:
				this.handleGatewayDispatch(payload as GatewayPayload<GatewayOpcodes.DISPATCH>);
				break;
			case GatewayOpcodes.HELLO:
				this.handleGatewayHello(payload as GatewayPayload<GatewayOpcodes.HELLO>);
				break;
			case GatewayOpcodes.HEARTBEAT:
				this.heartbeat();
				break;
			case GatewayOpcodes.HEARTBEAT_ACK:
				if (!this.readyData) this.send(this.identifyPayload);
				break;
			case GatewayOpcodes.IDENTIFY:

				break;
			case GatewayOpcodes.INVALID_SESSION:
				break;
			case GatewayOpcodes.PRESENCE_UPDATE:
				break;
		}
	}

	onDispatchEvent<T extends keyof GatewayDispatchData>(event: T, callback: (data: GatewayDispatchData[T]) => void) {
		return this.emitter.on(`dispatch-${event}`, callback)
	}

	onceDispatchEvent<T extends keyof GatewayDispatchData>(event: T, callback: (data: GatewayDispatchData[T]) => void) {
		return this.emitter.once(`dispatch-${event}`, callback)
	}

	offDispatchEvent<T extends keyof GatewayDispatchData>(event: T, callback: (data: GatewayDispatchData[T]) => void) {
		return this.emitter.off(`dispatch-${event}`, callback)
	}

	emitDispatchEvent<T extends keyof GatewayDispatchData>(event: T, data: GatewayDispatchData[T]) {
		return this.emitter.emit(`dispatch-${event}`, data)
	}

	onEvent<T extends keyof GatewayOpcodescodesData>(event: T, callback: (data: GatewayOpcodescodesData[T]) => void) {
		return this.emitter.on(`event-${event}`, callback)
	}

	onceEvent<T extends keyof GatewayOpcodescodesData>(event: T, callback: (data: GatewayOpcodescodesData[T]) => void) {
		return this.emitter.once(`event-${event}`, callback)
	}

	offEvent<T extends keyof GatewayOpcodescodesData>(event: T, callback: (data: GatewayOpcodescodesData[T]) => void) {
		return this.emitter.off(`event-${event}`, callback)
	}

	emitEvent<T extends keyof GatewayOpcodescodesData>(event: T, data: GatewayOpcodescodesData[T]) {
		return this.emitter.emit(`event-${event}`, data)
	}


}