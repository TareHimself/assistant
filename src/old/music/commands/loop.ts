import { GuildMember } from "discord.js";
import path from "path";
import { ECommandOptionType, ECommandType, ELoopType, IUmekoSlashCommand } from "../types";

const utils = bus.sync.require(
    path.join(process.cwd(), "utils")
) as typeof import("../utils");

const command: IUmekoSlashCommand = {
    name: 'loop',
    category: 'Music',
    description: 'Set the loop state of the Queue',
    syntax: '{prefix}{name} <off | song | queue>',
    group: 'music',
    type: ECommandType.SLASH,
    dependencies: ['utils'],
    options: [
        {
            name: 'state',
            description: 'The new loop state (off, song, queue)',
            type: ECommandOptionType.STRING,
            required: true,
            choices: [
                {
                    "name": "Off",
                    "value": ELoopType.NONE
                },
                {
                    "name": "Song",
                    "value": ELoopType.SONG
                },
                {
                    "name": "Queue",
                    "value": ELoopType.QUEUE
                }
            ]
        }
    ],
    async execute(ctx) {

        if (!ctx.command.guild || !(ctx.command.member as GuildMember | null)?.voice?.channel || !ctx.command.guild.me) return utils.reply(ctx, "You need to be in a voice channel to use this command");

        if (!bus.queues.get(ctx.command.guild.id))
            return utils.reply(ctx, "Theres no Queue");

        bus.queues.get(ctx.command.guild.id)?.setLooping(ctx);


    }
}

export default command;