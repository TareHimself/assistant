import axios from 'axios';
import { AssistantObject } from './base';
import FormData from 'form-data';
import {
	ICgasApiResponse,
	IIntent,
	IIntentInferenceResult,
	IOpenAiInferenceResult,
} from './types';
import fs from 'fs';
export class CgasApi extends AssistantObject {
	rest = axios.create({
		baseURL: 'https://cgas.io/api',
	});

	static instance?: CgasApi;
	static get() {
		if (this.instance) return this.instance;
		this.instance = new CgasApi();
		return this.instance;
	}

	async upload(
		filename: string,
		file: Buffer
	): Promise<ICgasApiResponse | null> {
		try {
			const form = new FormData();
			form.append('file', file, filename);
			form.append('key', process.env.CGAS_API_KEY);
			form.append('custom_url', 'https://files.oyintare.dev');
			const uploadResponse = await this.rest.post<ICgasApiResponse>(
				'/upload',
				form,
				{
					headers: form.getHeaders(),
				}
			);
			return uploadResponse.data;
		} catch (error) {
			console.log(error);
		}
		return null;
	}
}
