import axios, { AxiosInstance } from 'axios';
import { ELoadableState, EntityExtractionError, Loadable } from './base';
import { IIntent, IIntentInferenceResult } from './types';
import { PythonProcess } from './subprocess';

export abstract class IntentClassifier extends Loadable {
	async classify(
		prompt: string,
		intents: IIntent[]
	): Promise<IIntentInferenceResult> {
		throw new Error('This classifier is not functional');
	}

	async train(intents: IIntent[]) {}
}

export type ISimpleClassificationResult = {
	intent: string;
	confidence: number;
}[];
export class SimpleIntentClassifier extends IntentClassifier {
	intentsStringified: string = '';
	intentsIndex: Record<string, IIntent> = {};
	classifierProcess = new PythonProcess('intents.py');
	saveDir: string;
	minConfidence: number;
	constructor(savePath: string, confidenceThreshold = 0.6) {
		super();
		this.saveDir = savePath;
		this.minConfidence = confidenceThreshold;
	}

	override async onLoad(): Promise<void> {
		await this.classifierProcess.waitForState(ELoadableState.ACTIVE);
	}

	override async train(intents: IIntent[]) {
		await this.classifierProcess.sendAndWait(
			Buffer.from(
				JSON.stringify({
					tags: intents.map((a) => {
						return {
							tag: a.tag,
							examples: a.examples,
						};
					}),
					model: this.saveDir,
				})
			),
			2
		);

		this.intentsStringified = intents.toString();
		this.intentsIndex = {};
		intents.forEach((a) => {
			this.intentsIndex[a.tag] = a;
		});
	}

	override async classify(
		prompt: string,
		intents: IIntent[]
	): Promise<IIntentInferenceResult> {
		if (this.intentsStringified !== intents.toString()) {
			await this.train(intents);
		}

		const [_, nluPacket] = await this.classifierProcess.sendAndWait(
			Buffer.from(prompt),
			1
		);
		const dataRecieved = JSON.parse(
			nluPacket.toString()
		) as ISimpleClassificationResult;
		console.log(dataRecieved);
		const targetIntent = dataRecieved[0];
		if (targetIntent.confidence < this.minConfidence) {
			return {
				intent: 'none',
				entities: [],
			};
		}

		try {
			const entities = this.intentsIndex[targetIntent.intent].entities.map(
				(a) => ({
					entity: a.tag,
					data: a.extractor(prompt),
				})
			);

			return {
				intent: targetIntent.intent,
				entities: entities,
			};
		} catch (error) {
			if (!(error instanceof EntityExtractionError)) {
				console.error(error);
			}

			return {
				intent: 'none',
				entities: [],
			};
		}
	}
}
// On hold, not sure about pricing
export class OpenAi extends IntentClassifier {
	intentRegex = /intent:\s?(.*)/gm;
	entitiesRegex = /((?:[a-z1-9_]+)\((?:.+?)\))/gm;
	rest: AxiosInstance;

	constructor(apiKey: string = process.env.OPEN_AI_KEY) {
		super();
		this.rest = axios.create({
			baseURL: 'https://api.openai.com/v1',
			headers: {
				Authorization: `Bearer ${axios}`,
			},
		});
	}
	override async classify(
		prompt: string,
		intents: IIntent[]
	): Promise<IIntentInferenceResult> {
		const openAiPrompt = `POSSIBLE_INTENTS_FORMAT: intent - entities if present
		POSSIBLE_INTENTS:
		s_none(no valid intent)
		${intents.reduce((allIntents, intent, idx, arr) => {
			return (
				allIntents +
				`${intent.tag}(${intent.description})${intent.entities.reduce(
					(allEntities, entity, eidx, earr) => {
						return (
							allEntities +
							`${eidx === 0 ? ' - ' : ''}${entity.tag}(${entity.description})${
								eidx === earr.length - 1 ? '' : ' '
							}`
						);
					},
					''
				)}${idx === arr.length - 1 ? '' : '\n'}`
			);
		}, '')}
		Extract an intent with its entities(if present) from the text after this line using the list of POSSIBLE_INTENTS and their entities.
		text: ${prompt}
		RESPONSE_FORMAT:
		intent: [intent]
		entities: entity(data) entity(data)`
			.split('\n')
			.map((a) => a.trim())
			.join('\n');

		console.log(openAiPrompt);
		return {
			intent: 'skill_none',
			entities: [],
		};

		// const response = await this.rest.post<IOpenAiInferenceResult>(
		// 	'/chat/completions',
		// 	{
		// 		model: 'gpt-3.5-turbo',
		// 		messages: [
		// 			{
		// 				role: 'user',
		// 				content: openAiPrompt,
		// 			},
		// 		],
		// 		max_tokens: Math.round(prompt.length + prompt.length * 0.5),
		// 		temperature: 0.3,
		// 	}
		// );

		// const inferenceResult = response.data.choices[0].message.content;

		// const intentsDetected = Array.from(
		// 	inferenceResult.matchAll(this.intentRegex)
		// )[0];
		// const specificIntent = intentsDetected ? intentsDetected[1] : undefined;

		// if (specificIntent !== undefined && specificIntent.trim() === 's_none') {
		// 	return null;
		// }

		// const entities = Array.from(
		// 	inferenceResult.matchAll(this.entitiesRegex)
		// ).map((e) => {
		// 	const entityRaw = e[1].trim();
		// 	const sepIndex = entityRaw.indexOf('(');
		// 	const entity = entityRaw.slice(0, sepIndex);
		// 	const data = entityRaw.slice(sepIndex + 1, -1);
		// 	return {
		// 		entity,
		// 		data,
		// 	};
		// });
		// return {
		// 	intent: specificIntent || '',
		// 	entities: entities,
		// };
	}
}
