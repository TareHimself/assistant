import {
	AssistantContext,
	AssistantPlugin,
	AssistantSkill,
	SkillInstance,
} from '@core/assistant';
import { Loadable } from '@core/base';
import { Client } from 'express-websocket-proxy';
import { v4 } from 'uuid';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import path from 'path';
import { IIntent } from '@core/types';
import axios from 'axios';
const SPOTIFY_PLUGIN_ID = 'spotify-plugin';

export interface ISpotifyAuth {
	scopes: string;
	token: string;
	refresh: string;
	refresh_at: number;
}
export type SpotifyPlayData = {
	type: 'track' | 'album' | 'playlist' | 'none';
	query: string;
};

export type SpotifySearchField<T> = {
	href: string;
	limit: number;
	next: string;
	offset: number;
	previous: string;
	total: number;
	items: T;
};

export interface SpotifySearchResponse {
	tracks: SpotifySearchField<
		{
			uri: string;
			name: string;
		}[]
	>;
	artists: SpotifySearchField<
		{
			uri: string;
			name: string;
		}[]
	>;
	albums: SpotifySearchField<
		{
			uri: string;
			name: string;
		}[]
	>;
	playlists: SpotifySearchField<
		{
			uri: string;
			name: string;
		}[]
	>;
}

class SpotifyPlaySkill extends AssistantSkill<SpotifyPlayData> {
	extractionRegex = new RegExp(/(?:play)\s(?:(track|playlist|album)\s)?(.*)/);
	get intents(): IIntent[] {
		return [
			{
				tag: 'skill_spotify_play',
				examples: [
					'play in the name of love',
					'play girls on boys',
					'play track lilly by alan walker',
					'play playlist familia',
					'play album genius by sia',
					'play track genius',
					'play lean on me',
				],
			},
		];
	}

	override shouldExecute(
		intent: string,
		source: AssistantContext,
		prompt: string
	): boolean {
		return (
			prompt.match(this.extractionRegex) !== null &&
			bus.assistant.getPlugin<SpotifyPlugin>(SPOTIFY_PLUGIN_ID) !== undefined
		);
	}
	override async dataExtractor(
		instance: SkillInstance
	): Promise<SpotifyPlayData> {
		const [_, type, query] = instance.prompt.match(this.extractionRegex)!;
		return {
			type:
				((type || '').toLowerCase() as SpotifyPlayData['type'] | undefined) ||
				'none',
			query: query,
		};
	}

	override async execute(
		instance: SkillInstance,
		data: SpotifyPlayData
	): Promise<void> {
		const plugin = bus.assistant.getPlugin<SpotifyPlugin>(SPOTIFY_PLUGIN_ID);
		if (!plugin) return;

		const searchData = await plugin.spotify.searchForSong(
			data.query,
			data.type
		);

		await plugin.spotify.playTrackUris([searchData['tracks']['items'][0].uri]);
		console.info('Track Search Data');
	}
}

function auth() {}
class SpotifyApi extends Loadable {
	plugin: SpotifyPlugin;
	authPath: string = '';
	auth: ISpotifyAuth = {
		scopes: '',
		token: '',
		refresh: '',
		refresh_at: 0,
	};
	static REDIRECT_URI = 'https://proxy.oyintare.dev/assistant/spotify';
	static SCOPES =
		'user-read-playback-state user-modify-playback-state user-read-currently-playing';
	constructor(plugin: SpotifyPlugin) {
		super();
		this.plugin = plugin;
	}

	override async onLoad(): Promise<void> {
		this.authPath = path.join(this.plugin.dataPath, 'auth.json');
		if (fs.existsSync(this.authPath)) {
			const auth = JSON.parse(
				await fs.promises.readFile(this.authPath, 'ascii')
			) as ISpotifyAuth;
			if (auth.scopes === SpotifyApi.SCOPES) {
				this.auth = auth;
				if (this.auth.refresh_at < Date.now()) {
					await this.refreshToken();
				}
				return;
			} else {
				await fs.promises.unlink(this.authPath);
			}
		}

		const state = v4();
		let loginWindow: BrowserWindow | null = null;
		const queryString = new URLSearchParams({
			response_type: 'code',
			client_id: process.env.SPOTIFY_CLIENT_ID,
			scope: SpotifyApi.SCOPES,
			redirect_uri: SpotifyApi.REDIRECT_URI,
			state: state,
		}).toString();

		const proxy = new Client('assistant', 'wss://proxy.oyintare.dev/');
		const pending = new Promise<string>((res, rej) => {
			proxy.get('/spotify', (req) => {
				loginWindow?.close();
				if (req.query.state !== state) {
					rej('Them dey try hack you');
				}
				res(req.query.code);
			});
		});
		proxy.connect();
		await new Promise((r) => setTimeout(r, 1000));
		loginWindow = new BrowserWindow({
			show: true,
		});
		loginWindow.loadURL(
			`https://accounts.spotify.com/authorize?${queryString}`
		);

		try {
			const response = await axios.post<{
				access_token: string;
				expires_in: number;
				refresh_token: string;
			}>(
				'https://accounts.spotify.com/api/token',
				new URLSearchParams({
					grant_type: 'authorization_code',
					code: await pending,
					redirect_uri: SpotifyApi.REDIRECT_URI,
				}).toString(),
				{
					headers: {
						Authorization: `Basic ${Buffer.from(
							`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRETE}`
						).toString('base64')}`,
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				}
			);

			this.auth = {
				token: response.data.access_token,
				scopes: SpotifyApi.SCOPES,
				refresh: response.data.refresh_token,
				refresh_at: response.data.expires_in * 1000 + Date.now(),
			};

			await fs.promises.writeFile(
				this.authPath,
				JSON.stringify(this.auth, null, 4)
			);
			setTimeout(
				this.refreshToken.bind(this),
				Date.now() - this.auth.refresh_at
			);
		} catch (error) {
			console.error(error);
		}
	}

	async refreshToken() {
		try {
			const response = await axios.post<{
				access_token: string;
				expires_in: number;
				refresh_token: string;
			}>(
				'https://accounts.spotify.com/api/token',
				new URLSearchParams({
					grant_type: 'refresh_token',
					refresh_token: this.auth.refresh,
				}).toString(),
				{
					headers: {
						Authorization: `Basic ${Buffer.from(
							`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRETE}`
						).toString('base64')}`,
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				}
			);

			this.auth = {
				token: response.data.access_token,
				scopes: SpotifyApi.SCOPES,
				refresh: this.auth.refresh,
				refresh_at: response.data.expires_in * 1000 + Date.now(),
			};

			await fs.promises.writeFile(
				this.authPath,
				JSON.stringify(this.auth, null, 4)
			);

			setTimeout(
				this.refreshToken.bind(this),
				Date.now() - this.auth.refresh_at
			);
		} catch (error) {
			console.error(error);
		}
	}

	async searchForSong(
		query: SpotifyPlayData['query'],
		type: SpotifyPlayData['type']
	) {
		const response = await axios.get<SpotifySearchResponse>(
			`https://api.spotify.com/v1/search?${new URLSearchParams({
				q: query,
				type: type === 'none' ? 'track' : type,
				limit: '1',
			}).toString()}`,
			{
				headers: {
					Authorization: `Bearer ${this.auth.token}`,
				},
			}
		);
		return response.data;
	}

	async playTrackUris(uris: string[]) {
		await axios.put(
			'https://api.spotify.com/v1/me/player/play',
			{
				uris: uris,
			},
			{
				headers: {
					Authorization: `Bearer ${this.auth.token}`,
				},
			}
		);
	}

	async addTrackUriToQueue(uri: string) {
		await axios.put(
			`https://api.spotify.com/v1/me/player/queue?uri=${uri}`,
			{},
			{
				headers: {
					Authorization: `Bearer ${this.auth.token}`,
				},
			}
		);
	}
}

export default class SpotifyPlugin extends AssistantPlugin {
	spotify: SpotifyApi;

	override get id(): string {
		return SPOTIFY_PLUGIN_ID;
	}

	constructor() {
		super();
		this.spotify = new SpotifyApi(this);
	}

	override async onLoad(): Promise<void> {
		await this.spotify.load();
	}

	override async getSkills(): Promise<AssistantSkill<any>[]> {
		return [new SpotifyPlaySkill()];
	}
}
