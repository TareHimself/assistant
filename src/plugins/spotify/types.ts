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
