import { GuildMember } from "discord.js";
import path from "path";
import { ECommandType, IUmekoSlashCommand } from "../../../core/types";

const utils = bus.sync.require(
    path.join(process.cwd(), "utils")
) as typeof import("../../../core/utils");

const command: IUmekoSlashCommand = {
    name: 'volume',
    category: 'Music',
    description: 'Sets the music volume',
    type: ECommandType.SLASH,
    group: 'music',
    dependencies: ['utils'],
    syntax: '{prefix}{name} <new volume level 1 - 100>',
    options: [
        {
            name: 'volume',
            description: "The new volume value",
            type: 4,
            required: true
        }
    ],
    async execute(ctx) {

        if (!ctx.command.guild || !(ctx.command.member as GuildMember | null)?.voice?.channel || !ctx.command.guild.me) return utils.reply(ctx, "You need to be in a voice channel to use this command");

        if (!bus.queues.get(ctx.command.guild.id))
            return utils.reply(ctx, "Theres no Queue");

        bus.queues.get(ctx.command.guild.id)?.setVolume(ctx);
    }
}

export default command;