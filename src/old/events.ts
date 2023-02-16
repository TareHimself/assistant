import path from "path";
import fs from "fs";
import { Manager } from "lavacord";
import { watch } from "chokidar";
import { IBotEvent } from "../core/types";
import { BaseCommandInteraction, ClientEvents, Interaction, Message, Presence, TextChannel } from "discord.js";
const utils = bus.sync.require(
  path.join(process.cwd(), "utils")
) as typeof import("../core/utils");

const guildDataModule = bus.sync.require(
  "./modules/guildData"
) as typeof import("../core/modules/database");
const { updateServerLeveling } = bus.sync.require(
  "./modules/leveling"
) as typeof import("./leveling");

const commandsModule = bus.sync.require(
  "./modules/commands"
) as typeof import("../core/modules/commands");





async function onGuildMemberUpdate(oldMember, newMember) { }

async function onGuildCreate(guild) {
  // guildDataModule.onJoinedNewGuild(guild);
}
/*
async function onBotReady() {
  utils.log("Bot Ready");

  const bot = bus.bot;

  if (!bot) return;
  /*setInterval(
    () =>
      bot.user.setActivity(`${bot.guilds.cache.size} Servers`, {
        type: "WATCHING",
      }),
    20000
  );

  // Volcano nodes

  
  const nodes = [
    {
      id: "1",
      host: "localhost",
      port: 2333,
      password: process.env.LAVALINK_PASSWORD,
    },
  ];

  // Initilize the Manager with all the data it needs
  const LavaManager = new Manager(nodes, {
    user: bot.user?.id || "",
    shards: bot.options.shardCount,
    send: (packet) => {
      const guild = bot.guilds.cache.get(packet.d.guild_id);
      return guild?.shard.send(packet);
    },
  });

  bus.lavacordManager = LavaManager;

  try {
    await LavaManager.connect();

    utils.log("Connected to Music provider\x1b[0m");
  } catch (error) {
    utils.log("Error connecting to music provider\x1b[0m\n", error);
  }

  bot.ws
    .on(
      "VOICE_SERVER_UPDATE",
      bus.lavacordManager.voiceServerUpdate.bind(bus.lavacordManager)
    )
    .on(
      "VOICE_STATE_UPDATE",
      bus.lavacordManager.voiceStateUpdate.bind(bus.lavacordManager)
    )
    .on("GUILD_CREATE", async (data) => {
      if (data.voice_states.length) {
        for (const state of data.voice_states)
          await bus.lavacordManager?.voiceStateUpdate({
            ...state,
            guild_id: data.id,
          });
      }
    });

  LavaManager.on("error", (error, node) => {
    utils.log("Lavalink error\x1b[0m\n", error);
  });

  try {
    await guildDataModule.load();
  } catch (error) {
    utils.log("Error loading modules\x1b[0m\n", error);
  }

  await utils.getOsuApiToken();

  await utils.getSpotifyApiToken();

  // Commands loading and reloading
  watch("./commands", { persistent: true, usePolling: true }).on(
    "all",
    (event, path) => {
      utils.handleCommandDirectoryChanges(event, path);
    }
  );
}

async function onJoinedNewGuild() { }

const eventsToBind: IBotEvent[] = [
  { event: "messageCreate", funct: onMessageCreate },
  { event: "interactionCreate", funct: onInteractionCreate },
  { event: "guildMemberUpdate", funct: onGuildMemberUpdate },
  { event: "guildCreate", funct: onGuildCreate },
  { event: "presenceUpdate", funct: onPresenceUpdate },
  { event: "ready", funct: onBotReady },
  { event: "guildCreate", funct: onJoinedNewGuild },
];

if (bus.bot) {
  const bot = bus.bot;

  bus.boundBotEvents.forEach((funct, event) => {
    bot.off(event, funct);
    bus.boundBotEvents.delete(event);
  });

  eventsToBind.forEach((bindableEvent) => {
    const { event, funct } = bindableEvent;

    bot.on(event, funct);

    bus.boundBotEvents.set(event, funct);
  });
}*/
