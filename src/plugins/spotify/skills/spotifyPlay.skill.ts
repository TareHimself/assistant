import { AssistantSkill, SkillInstance } from '@core/assistant';
import { IIntent } from '@core/types';
import SpotifyPlugin from '..';

export default class SpotifyPlaySkill extends AssistantSkill<SpotifyPlugin> {
	extractionRegex = new RegExp(/(?:play)\s(?:(track|playlist|album)\s)?(.*)/);
	get intents(): IIntent[] {
		return [
			{
				tag: 's_s_play',
				description: 'plays music',
				entities: [
					{
						tag: 'track',
						description: 'what to play',
						extractor: (p) => p.split(' ').slice(1).join(' '),
					},
				],
				examples: [
					'[P|p]lay in the name of love',
					'[P|p]lay girls on boys',
					'[P|p]lay track lilly by alan walker',
					'[P|p]lay playlist familia',
					'[P|p]lay album genius by sia',
					'[P|p]lay track genius',
					'[P|p]lay lean on me',
				],
			},
		];
	}

	override shouldExecute(instance: SkillInstance): boolean {
		return instance.entities.find((e) => e.entity === 'track') !== undefined;
	}

	override async execute(instance: SkillInstance): Promise<void> {
		const query =
			instance.entities.find((e) => e.entity === 'track')?.data || '';

		const searchData = await this.plugin.spotify.searchForSong(query, 'track');

		await this.plugin.spotify.playTrackUris([
			searchData['tracks']['items'][0].uri,
		]);
		console.info('Track Search Data');
	}
}
