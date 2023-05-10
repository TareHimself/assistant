import { Singleton } from './base';

export class FilesApi extends Singleton {
	static get() {
		return new FilesApi();
	}

	override get id(): string {
		return 'files-api';
	}
}
