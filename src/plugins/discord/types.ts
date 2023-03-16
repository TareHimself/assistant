
type ReverseMap<T> = T[keyof T];

const enum GatewayIntent {
	GUILDS = 1 << 0,
	GUILD_MEMBERS = 1 << 1,
	GUILD_BANS = 1 << 2,
	GUILDEMOJIS_AND_STICKERS = 1 << 3,
	GUILD_INTEGRATIONS = 1 << 4,
	GUILD_WEBHOOKS = 1 << 5,
	GUILD_INVITES = 1 << 6,
	GUILD_VOICE_STATES = 1 << 7,
	GUILD_PRESENCES = 1 << 8,
	GUILD_MESSAGES = 1 << 9,
	GUILD_MESSAGE_REACTIONS = 1 << 10,
	GUILD_MESSAGE_TYPING = 1 << 11,
	DIRECT_MESSAGES = 1 << 12,
	DIRECT_MESSAGE_REACTIONS = 1 << 13,
	DIRECT_MESSAGE_TYPING = 1 << 14,
	MESSAGE_CONTENT = 1 << 15,
	GUILD_SCHEDULED_EVENTS = 1 << 16,
	AUTO_MODERATION_CONFIGURATION = 1 << 20,
	AUTO_MODERATION_EXECUTION = 1 << 21,
}

const enum GatewayOpcodes {
	DISPATCH = 0,
	HEARTBEAT = 1,
	IDENTIFY = 2,
	PRESENCE_UPDATE = 3,
	VOICE_STATE_UPDATE = 4,
	RESUME = 6,
	RECONNECT = 7,
	REQUEST_GUILD_MEMBERS = 8,
	INVALID_SESSION = 9,
	HELLO = 10,
	HEARTBEAT_ACK = 11,
}

const enum GatewayErrorCodes {
	UNKNOWN_ERROR = 4000,
	UNKNOWN_OP = 4001,
	DECODE_ERROR = 4002,
	NOT_AUTHENTICATED = 4003,
	AUTHENTICATION_FAILED = 4004,
	INVALID_SEQUENCE = 4007,
	RATE_LIMITED = 4008,
	SESSION_TIMED_OUT = 4009,
	INVALID_SHARD = 4010,
	SHARDING_REQUIRED = 4011,
	INVALID_API_VERSION = 4012,
	INVALID_INTENTS = 4013,
	DISALLOWED_INTENTS = 4014,
}


// 0	Identify	client	Begin a voice websocket connection.
// 1	Select Protocol	client	Select the voice protocol.
// 2	Ready	server	Complete the websocket handshake.
// 3	Heartbeat	client	Keep the websocket connection alive.
// 4	Session Description	server	Describe the session.
// 5	Speaking	client and server	Indicate which users are speaking.
// 6	Heartbeat ACK	server	Sent to acknowledge a received client heartbeat.
// 7	Resume	client	Resume a connection.
// 8	Hello	server	Time to wait between sending heartbeats in milliseconds.
// 9	Resumed	server	Acknowledge a successful session resume.
// 13	Client Disconnect	server	A client has disconnected from the voice channel

const enum VoiceOpcodes {
	IDENTIFY = 0,
	SELECT_PROTOCOL = 1,
	READY = 2,
	HEARTBEAT = 3,
	SESSION_DESCRIPTION = 4,
	SPEAKING = 5,
	HEARTBEAT_ACK = 6,
	RESUME = 7,
	HELLO = 8,
	RESUMED = 9,
	CLIENT_DISCONNECT = 13,
}

const enum VoiceErrorCodes {
	UNKNOWN_ERROR = 4000,
	UNKNOWN_OP = 4001,
	DECODE_ERROR = 4002,
	NOT_AUTHENTICATED = 4003,
	AUTHENTICATION_FAILED = 4004,
	INVALID_SEQUENCE = 4007,
	RATE_LIMITED = 4008,
	SESSION_TIMED_OUT = 4009,
	INVALID_SHARD = 4010,
	SHARDING_REQUIRED = 4011,
	INVALID_API_VERSION = 4012,
	INVALID_INTENTS = 4013,
	DISALLOWED_INTENTS = 4014,
}

const enum GatewayDispatch {
	READY = 'READY',
	GUILD_CREATE = 'GUILD_CREATE',
	GUILD_UPDATE = 'GUILD_UPDATE',
	GUILD_DELETE = 'GUILD_DELETE',
	GUILD_ROLE_CREATE = 'GUILD_ROLE_CREATE',
	GUILD_ROLE_UPDATE = 'GUILD_ROLE_UPDATE',
	GUILD_ROLE_DELETE = 'GUILD_ROLE_DELETE',
	CHANNEL_CREATE = 'CHANNEL_CREATE',
	CHANNEL_UPDATE = 'CHANNEL_UPDATE',
	CHANNEL_DELETE = 'CHANNEL_DELETE',
	CHANNEL_PINS_UPDATE = 'CHANNEL_PINS_UPDATE',
	THREAD_CREATE = 'THREAD_CREATE',
	THREAD_UPDATE = 'THREAD_UPDATE',
	THREAD_DELETE = 'THREAD_DELETE',
	THREAD_LIST_SYNC = 'THREAD_LIST_SYNC',
	THREAD_MEMBER_UPDATE = 'THREAD_MEMBER_UPDATE',
	THREAD_MEMBERS_UPDATE = 'THREAD_MEMBERS_UPDATE',
	STAGE_INSTANCE_CREATE = 'STAGE_INSTANCE_CREATE',
	STAGE_INSTANCE_UPDATE = 'STAGE_INSTANCE_UPDATE',
	STAGE_INSTANCE_DELETE = 'STAGE_INSTANCE_DELETE',
	GUILD_MEMBER_ADD = 'GUILD_MEMBER_ADD',
	GUILD_MEMBER_UPDATE = 'GUILD_MEMBER_UPDATE',
	GUILD_MEMBER_REMOVE = 'GUILD_MEMBER_REMOVE',
	GUILD_BAN_ADD = 'GUILD_BAN_ADD',
	GUILD_BAN_REMOVE = 'GUILD_BAN_REMOVE',
	GUILD_EMOJIS_UPDATE = 'GUILD_EMOJIS_UPDATE',
	GUILD_STICKERS_UPDATE = 'GUILD_STICKERS_UPDATE',
	GUILD_INTEGRATIONS_UPDATE = 'GUILD_INTEGRATIONS_UPDATE',
	INTEGRATION_CREATE = 'INTEGRATION_CREATE',
	INTEGRATION_UPDATE = 'INTEGRATION_UPDATE',
	INTEGRATION_DELETE = 'INTEGRATION_DELETE',
	WEBHOOKS_UPDATE = 'WEBHOOKS_UPDATE',
	INVITE_CREATE = 'INVITE_CREATE',
	INVITE_DELETE = 'INVITE_DELETE',
	VOICE_STATE_UPDATE = 'VOICE_STATE_UPDATE',
	PRESENCE_UPDATE = 'PRESENCE_UPDATE',
	MESSAGE_CREATE = 'MESSAGE_CREATE',
	MESSAGE_UPDATE = 'MESSAGE_UPDATE',
	MESSAGE_DELETE = 'MESSAGE_DELETE',
	MESSAGE_DELETE_BULK = 'MESSAGE_DELETE_BULK',
	MESSAGE_REACTION_ADD = 'MESSAGE_REACTION_ADD',
	MESSAGE_REACTION_REMOVE = 'MESSAGE_REACTION_REMOVE',
	MESSAGE_REACTION_REMOVE_ALL = 'MESSAGE_REACTION_REMOVE_ALL',
	MESSAGE_REACTION_REMOVE_EMOJI = 'MESSAGE_REACTION_REMOVE_EMOJI',
	TYPING_START = 'TYPING_START',
	GUILD_SCHEDULED_EVENT_CREATE = 'GUILD_SCHEDULED_EVENT_CREATE',
	GUILD_SCHEDULED_EVENT_UPDATE = 'GUILD_SCHEDULED_EVENT_UPDATE',
	GUILD_SCHEDULED_EVENT_DELETE = 'GUILD_SCHEDULED_EVENT_DELETE',
	GUILD_SCHEDULED_EVENT_USER_ADD = 'GUILD_SCHEDULED_EVENT_USER_ADD',
	GUILD_SCHEDULED_EVENT_USER_REMOVE = 'GUILD_SCHEDULED_EVENT_USER_REMOVE',
	AUTO_MODERATION_RULE_CREATE = 'AUTO_MODERATION_RULE_CREATE',
	AUTO_MODERATION_RULE_UPDATE = 'AUTO_MODERATION_RULE_UPDATE',
	AUTO_MODERATION_RULE_DELETE = 'AUTO_MODERATION_RULE_DELETE',
	AUTO_MODERATION_ACTION_EXECUTION = 'AUTO_MODERATION_ACTION_EXECUTION',
	VOICE_SERVER_UPDATE = 'VOICE_SERVER_UPDATE'

}

const enum GeatwayPremiumType {
	NONE = 0,
	NITRO_CLASSIC = 1,
	NITRO = 2,
	NITRO_BASIC = 3,
}

export type GatewayOpcodescodesData = {
	[GatewayOpcodes.DISPATCH]: any,
	[GatewayOpcodes.HEARTBEAT]: null,
	[GatewayOpcodes.IDENTIFY]: {
		token: string;
		intents: number;
		properties: {
			os: string;
			browser: string;
			device: string;
		}
	},
	[GatewayOpcodes.PRESENCE_UPDATE]: null,
	[GatewayOpcodes.VOICE_STATE_UPDATE]: {
		guild_id: string;
		channel_id: string;
		self_mute: boolean;
		self_deaf: boolean;
	},
	[GatewayOpcodes.RESUME]: null,
	[GatewayOpcodes.RECONNECT]: null,
	[GatewayOpcodes.REQUEST_GUILD_MEMBERS]: null,
	[GatewayOpcodes.INVALID_SESSION]: null,
	[GatewayOpcodes.HELLO]: {
		heartbeat_interval: number;
	},
	[GatewayOpcodes.HEARTBEAT_ACK]: null,
}

export type VoiceReadyStream = {
	type: string,
	ssrc: number,
	rtx_ssrc: number,
	rid: string,
	quality: number,
	active: boolean
}

export type VoiceOpcodesData = {
	[VoiceOpcodes.IDENTIFY]: {
		server_id: string
		user_id: string
		session_id: string
		token: string
	}
	[VoiceOpcodes.SELECT_PROTOCOL]: {
		protocol: "udp";
		data: {
			address: string;
			port: number;
			mode: string;
		}
	}
	[VoiceOpcodes.READY]: {
		streams: VoiceReadyStream[],
		ssrc: number,
		port: number,
		modes: string[],
		ip: string,
	}
	[VoiceOpcodes.HEARTBEAT]: number
	[VoiceOpcodes.SESSION_DESCRIPTION]: {
		mode: string;
		secret_key: number[]
	}
	[VoiceOpcodes.SPEAKING]: null
	[VoiceOpcodes.HEARTBEAT_ACK]: null
	[VoiceOpcodes.RESUME]: null
	[VoiceOpcodes.HELLO]: {
		heartbeat_interval: number;
	}
	[VoiceOpcodes.RESUMED]: null
	[VoiceOpcodes.CLIENT_DISCONNECT]: null
}

export type GatewayDispatchData = {
	"READY": {
		v: number;
		user: DiscordUser;
		guilds: Partial<GatewayGuild> & { id: string, unavailable: true }[]
		session_id: string;
		resume_gateway_url: string;
		shard?: [number];
		application: Partial<GatewayApplication> & { id: string, flags: number }
	},
	"GUILD_CREATE": {},
	"GUILD_UPDATE": {},
	"GUILD_DELETE": {},
	"GUILD_ROLE_CREATE": {},
	"GUILD_ROLE_UPDATE": {},
	"GUILD_ROLE_DELETE": {},
	"CHANNEL_CREATE": {},
	"CHANNEL_UPDATE": {},
	"CHANNEL_DELETE": {},
	"CHANNEL_PINS_UPDATE": {},
	"THREAD_CREATE": {},
	"THREAD_UPDATE": {},
	"THREAD_DELETE": {},
	"THREAD_LIST_SYNC": {},
	"THREAD_MEMBER_UPDATE": {},
	"THREAD_MEMBERS_UPDATE": {},
	"STAGE_INSTANCE_CREATE": {},
	"STAGE_INSTANCE_UPDATE": {},
	"STAGE_INSTANCE_DELETE": {},
	"GUILD_MEMBER_ADD": {},
	"GUILD_MEMBER_UPDATE": {},
	"GUILD_MEMBER_REMOVE": {},
	"GUILD_BAN_ADD": {},
	"GUILD_BAN_REMOVE": {},
	"GUILD_EMOJIS_UPDATE": {},
	"GUILD_STICKERS_UPDATE": {},
	"GUILD_INTEGRATIONS_UPDATE": {},
	"INTEGRATION_CREATE": {},
	"INTEGRATION_UPDATE": {},
	"INTEGRATION_DELETE": {},
	"WEBHOOKS_UPDATE": {},
	"INVITE_CREATE": {},
	"INVITE_DELETE": {},
	"VOICE_STATE_UPDATE": {
		member: DiscordMember,
		user_id: string,
		suppress: boolean,
		session_id: string,
		self_video: boolean,
		self_mute: boolean,
		self_deaf: boolean,
		request_to_speak_timestamp: null | string,
		mute: boolean,
		guild_id: string,
		deaf: boolean,
		channel_id: string
		self_stream?: boolean;
	},
	"PRESENCE_UPDATE": {},
	"MESSAGE_CREATE": DiscordMessage,
	"MESSAGE_UPDATE": {},
	"MESSAGE_DELETE": {},
	"MESSAGE_DELETE_BULK": {},
	"MESSAGE_REACTION_ADD": {},
	"MESSAGE_REACTION_REMOVE": {},
	"MESSAGE_REACTION_REMOVE_ALL": {},
	"MESSAGE_REACTION_REMOVE_EMOJI": {},
	"TYPING_START": {},
	"GUILD_SCHEDULED_EVENT_CREATE": {},
	"GUILD_SCHEDULED_EVENT_UPDATE": {},
	"GUILD_SCHEDULED_EVENT_DELETE": {},
	"GUILD_SCHEDULED_EVENT_USER_ADD": {},
	"GUILD_SCHEDULED_EVENT_USER_REMOVE": {},
	"AUTO_MODERATION_RULE_CREATE": {},
	"AUTO_MODERATION_RULE_UPDATE": {},
	"AUTO_MODERATION_RULE_DELETE": {},
	"AUTO_MODERATION_ACTION_EXECUTION": {},
	"VOICE_SERVER_UPDATE": {
		token: string;
		guild_id: string;
		endpoint: string;
	},

}

export interface DiscordUser {
	id: string;
	username: string;
	discriminator: string;
	avatar: string;
	bot?: boolean;
	system?: boolean;
	mfa_enabled?: boolean;
	banner?: string;
	accent_color?: number;
	locale?: string;
	verified?: boolean;
	email?: string;
	flags?: string;
	premium_type?: GeatwayPremiumType;
	public_flags?: number;
}

export interface DiscordMember {
	user: DiscordUser,
	roles: string[],
	premium_since: null | string,
	pending: boolean,
	nick: null | string,
	mute: boolean,
	joined_at: string,
	flags: number,
	deaf: boolean,
	communication_disabled_until: null | string,
	avatar: null
}

export interface GatewayGuild {

}

export interface GatewayApplication {
	id: string;
	name: string;
	icon: string;
	description: string;
}

export interface DiscordEmbed {
	message_id?: string;
	channel_id?: string;
	guild_id?: string;
	fail_if_not_exists?: true;
}

export interface DiscordMessageReference {
	message_id?: string;
	channel_id?: string;
	guild_id?: string;
	fail_if_not_exists?: true;
}

export interface DiscordMessageReply {
	content?: string;
	tts?: boolean;
	embeds?: DiscordEmbed[];
	message_reference?: DiscordMessageReference
}
export interface DiscordMention {
	username: string;
	id: string;
	member: DiscordMember
}

export interface DiscordMessage {
	id: string;
	channel_id: string;
	author: DiscordUser;
	content: string;
	guild_id?: string;
	timestamp: string;
	mentions: DiscordMention[];
	edited_timestamp: string | null;
	referenced_message?: DiscordMessage
}

export interface GatewayPayload<T extends keyof GatewayOpcodescodesData = any> {
	t: keyof typeof GatewayDispatch | null;
	s: number | null;
	op: GatewayOpcodes;
	d: GatewayOpcodescodesData[T];
}

export interface VoicePayload<T extends keyof VoiceOpcodesData = any> {
	op: VoiceOpcodes;
	d: VoiceOpcodesData[T];
}

export interface GatewayPayloadDispatch<T extends keyof GatewayDispatchData = any> {
	s: number;
	t: keyof typeof GatewayDispatch;
	op: GatewayOpcodes.DISPATCH;
	d: GatewayDispatchData[T];
}

export interface ApiGatewayInfo {
	url: string;
	shards: number,
	session_start_limit: {
		total: number;
		remaining: number;
		reset_after: number;
		max_concurrency: number;
	}
}

export {
	GatewayIntent,
	GatewayOpcodes,
	GatewayErrorCodes,
	GatewayDispatch,
	VoiceOpcodes,
	VoiceErrorCodes
}

// export interface RawProxiedRequest {
// 	params: { [param: string]: number };
// 	query: { [query: string]: number };
// 	headers: { [header: string]: number };
// 	body?: any;
// 	id: string;
// 	method: string;
// 	originalUrl: string,
// 	baseUrl: string,
// 	path: string
// }

// export interface ProxyIdentify {
// 	routes: string[];
// }

// export interface ServerStartOptions {
// 	port?: number;
// 	hostname?: string;
// 	use_ssl?: boolean;
// 	ssl_key?: string | Buffer;
// 	ssl_cert?: string | Buffer;
// }

