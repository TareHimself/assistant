import { AssistantSkill, SkillInstance } from '@core/assistant';
import { IIntent } from '@core/types';
import { executeInBrowserWindow } from '@core/utils';
import { BrowserWindow } from 'electron';

export default class SearchSkill extends AssistantSkill {
	BRACKET_REGEX = /\(.*?\)/gm;
	override get intents(): IIntent[] {
		return [
			{
				tag: 'search',
				description: 'looks up stuff',
				entities: [
					{
						tag: 'query',
						description: 'what to search for',
						extractor: (p) => {
							return p.split(' ').slice(2).join(' ');
						},
					},
				],
				examples: [
					'[look up|search for] how to make a paper airplane',
					'[look up|search for] Ariana grande',
					'[look up|search for] photoshop',
					'[look up|search for] the meaning of life',
					'[look up|search for] the golden ratio',
					'[look up|search for] rick and morty',
					'[look up|search for] how to make a voice assistant with python',
					'[look up|search for] entity extraction with pytorch',
					'[look up|search for] the president of america',
					'[look up|search for] DIY home improvement ideas',
					'[look up|search for] the latest movie releases',
					'[look up|search for] healthy breakfast recipes',
					'[look up|search for] how to tie a tie',
					'[look up|search for] famous art museums in Europe',
					"[look up|search for] how to solve a Rubik's Cube",
					'[look up|search for] top tourist attractions in Paris',
					'[look up|search for] beginner guitar chords',
					'[look up|search for] the best hiking trails in California',
					'[look up|search for] how to grow organic vegetables at home',
					'[look up|search for] popular coding languages for web development',
					'[look up|search for] tips for improving concentration and focus',
					'[look up|search for] historical events that shaped the world',
					'[look up|search for] how to make homemade pizza dough',
					'[look up|search for] famous quotes by Albert Einstein',
				],
			},
		];
	}

	override shouldExecute(instance: SkillInstance): boolean {
		return instance.entities.some((a) => a.entity === 'query');
	}

	override async execute(instance: SkillInstance): Promise<void> {
		const query = instance.entities.find(
			(a) => a.entity === this.intents[0].entities[0].tag
		);
		if (!query) {
			await instance.context.reply('I cannot read minds.');
			return;
		}
		const searchQuery = query.data.replace(/\s+/g, ' ').trim();

		const searchWindow = new BrowserWindow({
			show: false,
		});

		const pendingSearch = new Promise<
			| {
					data: string;
					selector: string;
			  }
			| undefined
		>((res, rej) => {
			searchWindow.webContents.once('did-navigate', (_, url) => {
				executeInBrowserWindow(async () => {
					const selectors = [
						'.kp-header .FLP8od',
						'div[data-hveid="CAUQAQ"] div[role="heading"]',
						'div[data-hveid="CAUQAQ"] .vk_bk.dDoNo.FzvWSb',
						'.vk_bk span',
						'.kno-rdesc span',
						'.IZ6rdc',
						'.hgKElc',
					];

					for (let i = 0; i < selectors.length; i++) {
						const element = document.querySelector(selectors[i]);
						if (element) {
							return {
								data: element.textContent || '',
								selector: selectors[i],
							};
						}
					}

					return undefined;
				}, searchWindow)
					.then((a) => {
						res(a);
					})
					.catch(rej);
			});
		});

		await searchWindow.loadURL(
			`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
		);

		const result = await pendingSearch;

		searchWindow.close();

		if (!result) {
			await instance.context.reply(
				'Sorry , I could not find any information on that.'
			);
		} else {
			const { data, selector } = result;

			console.info(`Retrieved [${data}] using [${selector}]`);

			const dataToSend = data.replaceAll(this.BRACKET_REGEX, '');

			await instance.context.reply(dataToSend);
		}
	}
}
