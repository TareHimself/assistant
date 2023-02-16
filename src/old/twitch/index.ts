import { Client, Presence, TextChannel } from "discord.js";
import { BotPlugin } from "@modules/plugins";
import { log } from "@core/utils";

export default class TwitchPlugin extends BotPlugin {
    callback: typeof this.onPresenceUpdate;
    constructor(bot: Client) {
        super(bot);
        this.bot = bot;
        this.callback = this.onPresenceUpdate.bind(this)
    }

    async onLoad() {
        this.bot.on('presenceUpdate', this.callback)
    }



    async onDestroyed() {
        this.bot.off('presenceUpdate', this.callback);
    }
}