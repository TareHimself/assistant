import { AssistantPlugin, AssistantSkill } from '@core/assistant';

export default class BasePlugin extends AssistantPlugin {
	override get id(): string {
		return 'base-plugin';
	}

	override get dirname() {
		return __dirname;
	}
}
