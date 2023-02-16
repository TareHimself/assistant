import axios from "axios";
import path from "path";
import { Message, TextBasedChannel } from "discord.js";
import { IGuildLevelingData } from "../core/types";
const utils = bus.sync.require(
  path.join(process.cwd(), "utils")
) as typeof import("../core/utils");



export async function updateServerLeveling(message: Message) {
  const bot = bus.bot;
  if (!bot) return;

  try {
    const guildId = message.guild!.id;
    const userId = message.member!.id;
    const username = message.member!.displayName;

    const options =
      bus.guildSettings.get(guildId)?.leveling_options || new URLSearchParams();

    if (!options.get("location") || options.get("location") === "disabled")
      return;

    if (!bus.guildLeveling.get(guildId))
      bus.guildLeveling.set(guildId, { data: {}, rank: [] });

    const levelingData = bus.guildLeveling.get(guildId) as IGuildLevelingData;

    if (!levelingData.data[userId]) {
      levelingData.data[userId] = {
        user: userId,
        guild: guildId,
        level: 0,
        progress: 0
      };

      levelingData.rank.push(userId);

      await bus.db.put('/levels', [levelingData.data[userId]]);
    }

    levelingData.data[userId].progress += ;

    if (!bus.levelingDataPendingUpload.get(guildId)) bus.levelingDataPendingUpload.set(guildId, []);

    if (!bus.levelingDataPendingUpload.get(guildId)!.includes(userId)) bus.levelingDataPendingUpload.get(guildId)!.push(userId);




    if (levelingData.data[userId].progress >= nextLevelXp) {
      levelingData.data[userId].level += 1;
      levelingData.data[userId].progress =
        levelingData.data[userId].progress - nextLevelXp;

      if (levelingData.rank) {


        levelingData.rank.reverse();
      }

      const levelUpMsg = options
        .get("msg")
        ?.replace(/{user}/gi, `<@${userId}>`)
        .replace(/{username}/gi, `${username}`)
        .replace(/{level}/gi, `${levelingData.data[userId].level}`)
        .replace(/{server}/gi, `${message.guild!.name}`)
        .replace(/{id}/gi, `${userId}`) || '';

      //levelingData.data[userId].lastXpUpdateAmmount = levelingData.data[userId].progress - xpUpdateThreshold;//  force an update to the backend

      if (levelUpMsg) {
        if (options.get("location") === "channel" && options.get("channel")) {
          const channel = (await message.guild!.channels
            .fetch(options.get("channel") as string)
            .catch(utils.log)) as TextBasedChannel;
          if (channel) {
            channel.send(levelUpMsg);
          } else {
            message.reply(levelUpMsg);
          }
        } else if (options.get("location") === "dm") {
          message.author.send(levelUpMsg).catch((error) => {
            utils.log("Error sending level up message", error);
          });
        } else {
          message.reply(levelUpMsg);
        }
      }
    }

    /* // update backend only if xp is past the specified threshold
     if (
       levelingData.data[userId].lastXpUpdateAmmount !== undefined &&
       levelingData.data[userId].currentXp -
       levelingData.data[userId].lastXpUpdateAmmount <
       xpUpdateThreshold
     )
       return;
 
     levelingData.data[userId].lastXpUpdateAmmount =
       levelingData.data[userId].currentXp;
 
     const postData = {
       id: userId,
       level: levelingData.data[userId].level,
       xp_current: levelingData.data[userId].currentXp,
     };
 
     db.post(`/tables/guild_leveling_${guildId}/rows`, [postData])
       .then((levelingUpdateResponse) => { })
       .catch((error) => {
         utils.log("Error updating back end XP", error.data);
       });*/
  } catch (error) {
    utils.log("Error handeling leveling", error);
  }
}

async function onGuildCreate(guild) { }

const levelingEvents = [
  { id: "messageCreate", event: updateServerLeveling },
  { id: "guildCreate", event: onGuildCreate },
];
/*
if (bus.bot !== undefined) {
  if (dataBus.levelingEvents !== undefined) {
    const previousEvents = dataBus.levelingEvents;

    previousEvents.forEach(function (levelingEvent, index) {
      try {
        bus.bot.removeListener(levelingEvent.id, levelingEvent.event);
      } catch (error) {
        utils.log(
          `Error unbinding event ${levelingEvent.id} from bot\x1b[0m\n`,
          error
        );
      }
    });
  }

  levelingEvents.forEach(function (levelingEvent, index) {
    try {
      bus.bot.on(levelingEvent.id, levelingEvent.event);
    } catch (error) {
      utils.log(
        `Error binding event ${levelingEvent.id} to bot\x1b[0m\n`,
        error
      );
    }
  });

  dataBus.levelingEvents = levelingEvents;
}
*/
export { };
