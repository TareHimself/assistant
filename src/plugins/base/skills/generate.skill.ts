import { AssistantSkill, SkillInstance } from '@core/assistant';
import { ELoadableState } from '@core/base';
import { PythonProcess } from '@core/subprocess';
import { IIntent } from '@core/types';
import { mostLikelyOption } from '@core/utils';

export default class GenerateImageSkill extends AssistantSkill {
	override get intents(): IIntent[] {
		return [
			{
				tag: 'generate',
				description: 'generate images using stable diffusion',
				entities: [
					{
						tag: 'prompt',
						description: 'the prompt to use',
						extractor: (a) => a.split(' ').slice(1).join(' '),
					},
				],
				examples: [
					'[G|g]enerate <e-prompt>microphone</e-prompt>',
					'[G|g]enerate <e-prompt>mask, school</e-prompt>',
					'[G|g]enerate <e-prompt>a man with a big jaw <params:size:50x10> <params:seed:711169780></e-prompt>',
					'[G|g]enerate <e-prompt>(masterpiece), (visible face), a black man wearing golden gucci</e-prompt>',
					'[G|g]enerate <e-prompt>school</e-prompt>',
					'[G|g]enerate <e-prompt>a purp dank</e-prompt>',
					'[G|g]enerate <e-prompt>[white hair | blue eyes | dress | pink lips ], [skirt |  skin]</e-prompt>',
					'[G|g]enerate <e-prompt>red trees, two tables</e-prompt>',
					'[G|g]enerate <e-prompt>a man with a red and blue hay</e-prompt>',
					'[G|g]enerate <e-prompt>three little pigs playing on the beach</e-prompt>',
					'[G|g]enerate <e-prompt>( ninja ), shuriken, , stealth, ( assassin )</e-prompt>',
					'[G|g]enerate <e-prompt>chef, apron, spatula</e-prompt>',
					'[G|g]enerate <e-prompt>wizard, hat, spells, magic</e-prompt>',
					'[G|g]enerate <e-prompt>pirate, eyepatch, , peg leg</e-prompt>',
					'[G|g]enerate <e-prompt>(vampire), coffin, ( cape), blood</e-prompt>',
					'[G|g]enerate <e-prompt>micheal jackson in a blue bugatti</e-prompt>',
					'[G|g]enerate <e-prompt>cowboy, hat, spurs, lasso</e-prompt>',
					'[G|g]enerate <e-prompt>spy, briefcase, stealth, espionage</e-prompt>',
					'[G|g]enerate <e-prompt>(musician), guitar, stage, performance</e-prompt>',
					'[G|g]enerate <e-prompt>ancient temple, man, archeologist, fedora hat, brown leather jacket</e-prompt>',
					'[G|g]enerate <e-prompt>mystical garden, woman, druid, green dress, long brown hair</e-prompt>',
					'[G|g]enerate <e-prompt>jungle scene, man, explorer, pith helmet, khaki shirt</e-prompt>',
					'[G|g]enerate <e-prompt>(best quality, masterpiece), 1girl, particle, wind, flower, upper body, dark simple background, looking at viewer, blonde, galaxy <params:size:504x1009> <params:seed:736669780> <params:control:8> <params:steps:25></e-prompt>',
				],
			},
		];
	}

	generator = new PythonProcess('diffusion.py');
	isGeneratingImage = false;
	generationQueue: (() => any)[] = [];
	static AVAILABLE_MODELS = {
		normal: 'HeWhoRemixes/anything-v4.5-pruned-fp16',
		pastel: 'HeWhoRemixes/pastelmix-better-vae-fp16',
		cartoon: 'HeWhoRemixes/seekyou-alpha1-fp16',
		poster: 'HeWhoRemixes/primemix_v21',
	};

	override async onLoad(): Promise<void> {
		// this.generator.on('onProcessStdout', (b) => console.info(b.toString()));
		// this.generator.on('onProcessError', (b) => console.info(b.toString()));
		await this.generator.waitForState(ELoadableState.ACTIVE);
	}

	override shouldExecute(instance: SkillInstance): boolean {
		return (
			instance.prompt.toLowerCase().startsWith('generate') &&
			instance.entities.find((a) => a.entity === 'prompt') !== undefined
		);
	}

	waitForTurn(instance: SkillInstance) {
		if (this.isGeneratingImage) {
			return new Promise<void>((res) => {
				this.generationQueue.push(res);
				instance.context.reply(
					`Your request has been queued, position ${this.generationQueue.length}`
				);
			});
		}
		this.isGeneratingImage = true;
	}

	override async execute(instance: SkillInstance): Promise<void> {
		const possibleTypes = Object.keys(GenerateImageSkill.AVAILABLE_MODELS);

		const type = (
			(await instance.context.getInput(
				`What style would you like ${possibleTypes.join(', ')} ?`
			)) || ''
		).toLowerCase();

		let selection = mostLikelyOption(type, possibleTypes);

		if (GenerateImageSkill.AVAILABLE_MODELS[selection].length === 0) {
			// cartoon does not work
			selection = possibleTypes[0];
		}
		console.info(`Using ${selection} model`);

		const needToWait = this.waitForTurn(instance);
		if (needToWait !== undefined) {
			await needToWait;
		}

		instance.context.reply('Generating');

		const [_, generatedImage] = await this.generator.sendAndWait(
			Buffer.from(
				JSON.stringify({
					model_id: GenerateImageSkill.AVAILABLE_MODELS[selection],
					prompt:
						instance.entities.find((a) => a.entity === 'prompt')?.data || '',
				})
			)
		);

		const pending = this.generationQueue.pop();

		if (pending) {
			pending();
		} else if (this.isGeneratingImage) {
			this.isGeneratingImage = false;
		}

		await instance.context.reply(`Done Generating`);
		await instance.context.replyImage(generatedImage);
	}
}
