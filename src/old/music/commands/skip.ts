import { GuildMember } from "discord.js";
import path from "path";
import { ECommandType, IUmekoSlashCommand } from "../types";

const utils = bus.sync.require(
    path.join(process.cwd(), "utils")
) as typeof import("../utils");

const command: IUmekoSlashCommand = {
    name: 'skip',
    category: 'Music',
    description: 'skips the current song',
    type: ECommandType.SLASH,
    group: 'music',
    dependencies: ['utils'],
    syntax: '{prefix}{name}',
    options: [],
    async execute(ctx) {

        if (!ctx.command.guild || !(ctx.command.member as GuildMember | null)?.voice?.channel || !ctx.command.guild.me) return utils.reply(ctx, "You need to be in a voice channel to use this command");

        if (!bus.queues.get(ctx.command.guild.id))
            return utils.reply(ctx, "Theres no Queue");

        bus.queues.get(ctx.command.guild.id)?.skipSong(ctx);


    }
}

export default command;