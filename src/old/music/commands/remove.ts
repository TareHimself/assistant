import { GuildMember } from "discord.js";
import path from "path";
import { ECommandOptionType, ECommandType, IUmekoSlashCommand } from "../types";

const utils = bus.sync.require(
    path.join(process.cwd(), "utils")
) as typeof import("../utils");

const command: IUmekoSlashCommand = {
    name: 'remove',
    category: 'Music',
    description: 'Removes a song from the queue',
    type: ECommandType.SLASH,
    group: 'music',
    dependencies: ['utils'],
    syntax: '{prefix}{name} <song index>',
    options: [
        {
            name: 'index',
            description: "The index of the song in the queue",
            type: ECommandOptionType.INTEGER,
            required: true
        }
    ],
    async execute(ctx) {

        if (!ctx.command.guild || !(ctx.command.member as GuildMember | null)?.voice?.channel || !ctx.command.guild.me) return utils.reply(ctx, "You need to be in a voice channel to use this command");

        if (!bus.queues.get(ctx.command.guild.id))
            return utils.reply(ctx, "Theres no Queue");

        bus.queues.get(ctx.command.guild.id)?.removeSong(ctx);

    }
}

export default command;