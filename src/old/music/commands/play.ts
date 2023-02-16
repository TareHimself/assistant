import { GuildMember } from "discord.js";
import path from "path";
import { ECommandType, IUmekoSlashCommand } from "../types";

const { createQueue } = bus.sync.require(path.join(process.cwd(), 'modules/music')) as typeof import('../../old/music');

const utils = bus.sync.require(
    path.join(process.cwd(), "utils")
) as typeof import("../utils");

const command: IUmekoSlashCommand = {
    name: 'play',
    category: 'Music',
    description: 'Plays a given song or url',
    type: ECommandType.SLASH,
    group: 'music',
    dependencies: ['utils', 'music'],
    syntax: '{prefix}{name} <spotify url | youtube url | search term>',
    options: [
        {
            name: 'url',
            description: 'The song to search for / the link to play',
            type: 3,
            required: true
        }
    ],
    async execute(ctx) {
        if (!ctx.command.guild || !(ctx.command.member as GuildMember | null)?.voice?.channel || !ctx.command.guild.me) return utils.reply(ctx, "You need to be in a voice channel to use this command");

        if (!ctx.command.guild.me.permissions.has('CONNECT')) return utils.reply(ctx, "I dont have permissions to join voice channels.");

        if (!ctx.command.guild.me.permissions.has('SPEAK')) return utils.reply(ctx, "I dont have permissions to speak in voice channels (play music).");


        if (!bus.queues.get(ctx.command.guild.id)) {
            await createQueue(ctx);
        }

        bus.queues.get(ctx.command.guild.id)!.parseInput(ctx);
    }
}

export default command;