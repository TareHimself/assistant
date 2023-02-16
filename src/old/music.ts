import path from "path";
import { BaseCommandInteraction, ButtonInteraction, ColorResolvable, CommandInteraction, ContextMenuInteraction, Guild, GuildMember, Message, MessageActionRow, MessageButton, MessageEmbed, TextBasedChannel, VoiceBasedChannel } from "discord.js";
import { Manager, Player } from "lavacord";
import { ISong, ELoopType, IUmekoCommandContext, ILoadedQueue, IMusicUrlCheck, EMusicCheckType, ISavedSong, ISavedQueue, EUmekoCommandContextType, IParsedMessage, EQueueSource } from "../core/types";
const { queueTimeout, queueItemsPerPage, maxQueueFetchTime, maxRawVolume, defaultVolumeMultiplier, leftArrowEmoji, rightArrowEmoji } = bus.sync.require(path.join(process.cwd(), './config.json')) as typeof import('../config.json');

const spotifyExpression = /^(?:spotify:|(?:https?:\/\/(?:open|play)\.spotify\.com\/)(?:embed)?\/?(track|album|playlist)(?::|\/)((?:[0-9a-zA-Z]){22}))/;
const youtubePlaylistExpression = /[&?]list=([^&]+)/i;
const queuesPath = path.join(process.cwd(), '../queues')

const utils = bus.sync.require(
    path.join(process.cwd(), "utils")
) as typeof import("../core/utils");

const EventEmitter = require("events");

const axios = require('axios');

import fs from 'fs/promises';

/**
 * Creates a new queue.
 * @param ctx The context of the command
 * @returns A new queue.
 */
export function createQueue(ctx: IUmekoCommandContext) {

    const newQueue = new Queue(ctx);

    bus.queues.set((ctx.command.member as GuildMember).guild.id, newQueue);

    return newQueue;
}






async function loadSavedSong(guild: Guild, song: ISavedSong, priority: number): Promise<[ISong, number]> {

    const member = await guild.members.fetch(song.member);

    const songs: ISong[] = (await Queue.getSongs(song.uri, member));


    return [songs[0], priority];
}

async function loadQueueFromFile(filename: string) {
    const fullPath = path.join(queuesPath, filename);
    try {


        const file = await fs.readFile(fullPath, 'utf-8').catch((error) => { utils.log(error) }) as string;

        const QueueDataAsJson: ISavedQueue = JSON.parse(file);

        if (!QueueDataAsJson) {
            utils.log("Error parsing saved queue into json");
            await fs.unlink(fullPath);
            return;
        }


        if (!QueueDataAsJson.id || !QueueDataAsJson.voice || !QueueDataAsJson.channel || !QueueDataAsJson.songs || !QueueDataAsJson.songs.length) {
            utils.log('Deleting invalid saved queue', filename);
            await fs.unlink(fullPath);
            return;
        }

        const Id = QueueDataAsJson.id;

        if (!await bus.bot!.guilds.fetch(Id)) {
            await fs.unlink(fullPath);
            return;
        };


        const guild = await bus.bot!.guilds.fetch(Id);

        const voice = await guild.channels.fetch(QueueDataAsJson.voice) as VoiceBasedChannel | null;

        if (!voice || !voice.members.size) {
            utils.log('failed to fetch voice channel for queue', filename, QueueDataAsJson.channel, voice)
            await fs.unlink(fullPath);
            return;
        }

        const channel = await guild.channels.fetch(QueueDataAsJson.channel) as TextBasedChannel | null;

        if (!channel) {
            utils.log('failed to fetch text channel for queue', filename, QueueDataAsJson.channel, channel)
            await fs.unlink(fullPath);
            return;
        }

        const songs = QueueDataAsJson.songs;

        const songLoaders: Promise<[ISong, number]>[] = [];

        songs.forEach(function (songData, index) {
            songLoaders.push(loadSavedSong(guild, songData, index));
        });

        const loadedSongs: ISong[] = (await Promise.all(songLoaders)).sort(function (a, b) {
            return a[1] - b[1];
        }).map(item => item[0]);

        const loadedQueue: ILoadedQueue = {
            id: Id,
            voice: voice,
            channel: channel,
            songs: loadedSongs,
            loopType: QueueDataAsJson.loopType,
            volume: QueueDataAsJson.volume,
        }

        const queue = new Queue(loadedQueue, EQueueSource.SAVED_QUEUE);

        bus.queues.set(Id, queue);

        const player: Player = await bus.lavacordManager!.join({
            guild: Id,
            channel: voice.id,
            node: "1"
        });

        queue.player = player;
        const playerEndBind = queue.onSongEnd.bind(queue);
        queue.player.on('end', playerEndBind);
        queue.boundEvents.push({ owner: queue.player, event: 'end', function: playerEndBind })


        await fs.unlink(fullPath);

        queue.playNextSong();
    } catch (error) {
        utils.log(`Error loading queue ${filename} :: `, error);
        try {
            await fs.unlink(fullPath);
        } catch (error) {

        }
    }
}

const propertiesToNotCopy = ['_events', '_eventsCount', '_maxListeners', 'timeout', 'boundEvents', 'timeout']
/**
* @Class A Wrapper class for song queues 
*/
export class Queue extends EventEmitter {

    id: string;
    channel: TextBasedChannel | null = null;
    voice: VoiceBasedChannel | null = null;
    songs: ISong[] = [];
    loopType: ELoopType = ELoopType.NONE;
    volume: number = defaultVolumeMultiplier;
    currentSong: ISong | null = null;
    player: Player | null = null;
    queueTimeout: NodeJS.Timeout | null = null;
    boundEvents: { owner: any; event: string; function: any; }[] = [];


    constructor(source: IUmekoCommandContext | Queue | ILoadedQueue, sourceType: EQueueSource = EQueueSource.COMMAND) {
        super();

        this.boundEvents = [];
        this.timeout = null//setTimeout(this.destroyQueue.bind(this), queueTimeout);
        const voiceStateUpdateBind = this.voiceStateUpdate.bind(this);
        bus.bot!.ws.on('VOICE_STATE_UPDATE', voiceStateUpdateBind);

        this.boundEvents.push({ owner: bus.bot!.ws, event: 'VOICE_STATE_UPDATE', function: voiceStateUpdateBind })

        if (sourceType === EQueueSource.QUEUE) {

            if (this.player) {
                const playerEndBind = this.onSongEnd.bind(this);
                this.player.on('end', playerEndBind);
                this.boundEvents.push({ owner: this.player, event: 'end', function: playerEndBind })
            }

            const properties = Object.getOwnPropertyNames((source as Queue));

            const myProperties = Object.getOwnPropertyNames(this);

            const currentQueue = this;

            properties.forEach((property: string) => {
                if (!propertiesToNotCopy.includes(property) && myProperties.includes(property)) {
                    utils.log('transfered property', property)
                    currentQueue[property] = source[property];
                }
            })
        }
        else if (sourceType === EQueueSource.SAVED_QUEUE) {
            const savedQueue = (source as ILoadedQueue);
            this.id = savedQueue.id;
            this.channel = savedQueue.channel;
            this.voice = savedQueue.voice;
            this.songs = savedQueue.songs;
            this.loopType = savedQueue.loopType;
            this.volume = savedQueue.volume;
            this.currentSong = null;
        }
        else if (sourceType === EQueueSource.COMMAND) {
            const command = (source as IUmekoCommandContext).command;
            this.id = (command.member as GuildMember).guild.id;
            this.channel = command.channel;
            this.voice = (command.member as GuildMember).voice.channel;
        }
    }

    /**
    * Checks the url specified and returns its type.
    * @param {String} url The url to check.
    * @returns The result of the check as an object {type , id if spotify type}.
    */
    checkUrl(url: string): IMusicUrlCheck {
        try {
            const spMatch = url.match(spotifyExpression);

            if (spMatch) {
                const type = spMatch[1]
                const id = spMatch[2]

                let resultType: EMusicCheckType = EMusicCheckType.SEARCH;

                switch (type) {
                    case "track":
                        resultType = EMusicCheckType.SPOTIFY_TRACK;
                        break;
                    case "album":
                        resultType = EMusicCheckType.SPOTIFY_ALBUMN;
                        break;
                    case "playlist":
                        resultType = EMusicCheckType.SPOTIFY_PLAYLIST;
                        break;
                }

                return { type: resultType, id: id }
            }

            return { type: EMusicCheckType.SEARCH };
        } catch (error) {
            utils.log(`Error validating play url "${url}"`, error);
            return { type: EMusicCheckType.SEARCH };
        }
    }



    /**
     * Fetches a track from the spofity API.
     * @param check The check object returned from running the 'check' function 
     * @returns The data from the API.
     */
    static async fetchSpotifyTrack({ id }: IMusicUrlCheck) {
        const headers = {
            'Authorization': `Bearer ${process.env.SPOTIFY_API_TOKEN}`
        }

        const data = (await axios.get(`${process.env.SPOTIFY_API}/tracks/${id}`, { headers: headers })).data;

        return data;
    }

    songToSavableData(song: ISong): ISavedSong {
        return {
            uri: song.uri,
            member: song.requester.id
        };
    }

    async saveQueueToFile() {
        const payloadToSave: ISavedQueue = {
            id: this.id,
            channel: this.channel!.id,
            voice: this.voice!.id,
            songs: this.songs.map(song => this.songToSavableData(song)),
            loopType: this.loopType,
            volume: this.volume
        };

        if (this.currentSong) {
            payloadToSave.songs.push(this.songToSavableData(this.currentSong))
        }

        try {
            await fs.writeFile(path.join(queuesPath, `${this.id}.json`), JSON.stringify(payloadToSave, null, 4));
        } catch (error) {
            utils.log(error);
        }
    }

    async deleteSavedQueueFile() {
        try {
            await fs.access(path.join(queuesPath, `${this.id}.json`))
            await fs.unlink(path.join(queuesPath, `${this.id}.json`));
        } catch (error) {

        }
    }

    /**
     * Fetches an albumn from the spotify API.
     * @param check The check object returned from running the 'check' function 
     * @returns The data from the API.
     */
    static async fetchSpotifyAlbumTracks({ id }: IMusicUrlCheck) {

        const headers = {
            'Authorization': `Bearer ${process.env.SPOTIFY_API_TOKEN}`
        }

        const data = (await axios.get(`${process.env.SPOTIFY_API}/albums/${id}/tracks`, { headers: headers })).data;

        return data.items;

    }

    /**
     * Fetches a playlist from the spofity API.
     * @param check The check object returned from running the 'check' function 
     * @returns The data from the API.
     */
    static async fetchSpotifyPlaylistTracks({ id }: IMusicUrlCheck) {

        const headers = {
            'Authorization': `Bearer ${process.env.SPOTIFY_API_TOKEN}`
        }

        const data = (await axios.get(`${process.env.SPOTIFY_API}/playlists/${id}/tracks?fields=items(track(artists,name))`, { headers: headers })).data;

        return data.items;
    }


    /**
     * Creates a song object.
     * @param {LavalinkTrackData} songData The track data returned from the music provider.
     * @param songRequester The user that requested the song.
     * @param {String} songGroupURL The grouping url for queue song (i.e. the spotify albumn link).
     * @returns A song object.
     */
    static createSong(songData, songRequester, songGroupURL = ""): ISong {
        return {
            id: songData.info.identifier,
            track: songData.track,
            title: songData.info.title,
            uri: songData.info.uri,
            length: songData.info.length,
            requester: songRequester,
            groupURL: songGroupURL
        }
    }

    /**
     * Creates a song from a search term and user object
     * @param {String} search The term to search for
     * @param user The user that requested the song.
     * @returns A song object || undefined if the search term returned no results.
     */
    static async getSongs(search: string, user: GuildMember): Promise<ISong[]> {
        try {
            const node = bus.lavacordManager!.idealNodes[0];

            const params = new URLSearchParams();

            params.append("identifier", "ytsearch:" + search);

            const isYtPlaylist = search.match(youtubePlaylistExpression) !== null;

            const LavalinkData = (await axios.get(`http://${node.host}:${node.port}/loadtracks?${params}`, { headers: { Authorization: node.password } })).data;

            if (!LavalinkData.tracks.length) {

                return [];
            }

            if (isYtPlaylist) {
                return LavalinkData.tracks.map(data => Queue.createSong(data, user, data.info.uri));
            }
            else {
                const TargetTrack = LavalinkData.tracks[0];
                return [Queue.createSong(TargetTrack, user, TargetTrack.info.uri)];
            }

        } catch (error) {
            utils.log(`Error fetching song for "${search}"\n`, error);
            return [];
        }

    }

    /**
     * Times out after the specified number of seconds
     * @param ms The number of seconds before the function times out (i.e. returns a rejected promise);
     * @returns A rejected promise.
     */
    static trackFetchTimeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Converts a spotify track from the API into a song and pushes it into the specified Array.
     * @param ctx The command that initiated queue action.
     * @param {SpotifyApiTrack} trackData The spofity track data from the API.
     * @param {Array} songArray The Array to push the converted song into.
     */
    static async convertSpotifyToSong(ctx: IUmekoCommandContext, trackData, songArray): Promise<void> {

        let artists = "";

        trackData.artists.forEach(element => artists += ' ' + element.name);

        const searchToMake = trackData.name + ' ' + artists + ' audio';

        const songs: ISong[] | unknown = await Promise.race([Queue.getSongs(searchToMake, ctx.command.member as GuildMember), Queue.trackFetchTimeout(maxQueueFetchTime)]);

        if (!songs || !(songs as any).length) return;
        if (!songArray) return;
        const song = (songs as any[])[0];
        song.priority = trackData.priority;

        songArray.push(song);
    }

    /**
     * Generates a now playing message
     * @param targetChannel Optional parameter to specify a channel for the message
     */
    async createNowPlayingMessage(ctx: IUmekoCommandContext | undefined = undefined) {

        const channel = this.channel;

        let song = this.currentSong;

        if (this.isCreatingNowPlaying) return undefined;

        this.isCreatingNowPlaying = true;


        if (song == undefined) {
            // wait for half a second
            await new Promise(r => setTimeout(r, 500));

            song = this.currentSong;

            if (song == undefined) {
                this.isCreatingNowPlaying = false;
                return;
            }
        }

        // remove previous NowPlaying
        if (this.nowPlayingMessage != undefined) {
            this.nowPlayingMessage.stop('EndOfLife');
            this.nowPlayingMessage = undefined;
        }

        const Embed = new MessageEmbed();
        Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
        Embed.setTitle(`**${song.title}**`);
        Embed.setURL(`${song.uri}`);
        Embed.setDescription(`**Volume** : **${this.volume * 100}%** | **loop mode** : **${this.loopType}**`);
        Embed.setFooter({ text: `${song.requester.displayName}`, iconURL: song.requester.displayAvatarURL({ format: 'png', size: 32 }) });
        const nowButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('skip')
                    .setLabel('Skip')
                    .setStyle('PRIMARY'),
                new MessageButton()
                    .setCustomId(this.isPaused() ? 'resume' : 'pause')
                    .setLabel(this.isPaused() ? 'Resume' : 'Pause')
                    .setStyle(`SUCCESS`),
                new MessageButton()
                    .setCustomId('stop')
                    .setLabel('Stop')
                    .setStyle('DANGER'),
                new MessageButton()
                    .setCustomId('queue')
                    .setLabel('Queue')
                    .setStyle('SECONDARY'),
            );

        let message: Message | null = null;

        if (ctx) {
            message = await utils.reply(ctx, { embeds: [Embed], components: [nowButtons] }).catch(utils.log) as Message;
        }
        else {
            message = await channel!.send({ embeds: [Embed], components: [nowButtons] }).catch(utils.log) as Message;
        }


        if (message) {
            const collectorData = { id: this.id, }
            const nowPlayingCollector = new utils.InteractionCollector<ButtonInteraction, typeof collectorData>(bus.bot!, collectorData, { message: message, componentType: 'BUTTON' });

            nowPlayingCollector.on('collect', async (button: ButtonInteraction) => {

                const queueRef = bus.queues.get(nowPlayingCollector.data.id);

                if (!queueRef) return;

                const tempCtx: IUmekoCommandContext = { command: button, type: EUmekoCommandContextType.SLASH_COMMAND }

                await button.deferUpdate();

                button.replied = true;

                switch (button.customId) {
                    case 'pause':
                        await queueRef.pauseSong(tempCtx);
                        break;

                    case 'resume':
                        await queueRef.resumeSong(tempCtx);
                        break;

                    case 'queue':
                        await queueRef.showQueue(tempCtx);
                        break;

                    case 'skip':
                        await queueRef.skipSong(tempCtx);
                        break;

                    case 'stop':
                        await queueRef.stop(tempCtx);
                        break;
                }

                button.replied = false;

                if (nowPlayingCollector.ended) return;

                const editedNowButtons = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setCustomId('skip')
                            .setLabel('Skip')
                            .setStyle('PRIMARY'),
                        new MessageButton()
                            .setCustomId(queueRef.isPaused() ? 'resume' : 'pause')
                            .setLabel(queueRef.isPaused() ? 'Resume' : 'Pause')
                            .setStyle(`SUCCESS`),
                        new MessageButton()
                            .setCustomId('stop')
                            .setLabel('Stop')
                            .setStyle('DANGER'),
                        new MessageButton()
                            .setCustomId('queue')
                            .setLabel('Queue')
                            .setStyle('SECONDARY'),
                    );

                await button.editReply({ embeds: [Embed], components: [editedNowButtons] });
            });

            nowPlayingCollector.on('end', (collected, reason) => {
                const queueRef = bus.queues.get(nowPlayingCollector.data.id);
                const editedNowButtons = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setCustomId('skip')
                            .setLabel('Skip')
                            .setStyle('PRIMARY')
                            .setDisabled(true),
                        new MessageButton()
                            .setCustomId(queueRef?.isPaused() ? 'resume' : 'pause')
                            .setLabel(queueRef?.isPaused() ? 'Resume' : 'Pause')
                            .setStyle(`SUCCESS`)
                            .setDisabled(true),
                        new MessageButton()
                            .setCustomId('stop')
                            .setLabel('Stop')
                            .setStyle('DANGER')
                            .setDisabled(true),
                        new MessageButton()
                            .setCustomId('queue')
                            .setLabel('Queue')
                            .setStyle('SECONDARY')
                            .setDisabled(true),
                    );

                (nowPlayingCollector.options.message as Message).fetch().then((message) => {
                    if (message) message.edit({ embeds: [message.embeds[0]], components: [editedNowButtons] });
                }).catch(utils.log);
            });

            this.nowPlayingMessage = nowPlayingCollector;

        }

        this.isCreatingNowPlaying = false;

    }

    /**
     * Generates a current queue message
     * @param {Queue} queue The queue to generate the message for.
     * @param {Number} page The page to generate the embed for.
     * @return [The Embed Created, The total number of pages]
     */
    generateQueueEmbed(page: number): [MessageEmbed, number] {

        const currentQueueLenth = this.songs.length;
        const itemsPerPage = queueItemsPerPage;
        const prevCurrentPages = Math.ceil((currentQueueLenth / itemsPerPage))
        const currentPages = prevCurrentPages < 1 ? 1 : prevCurrentPages;

        const Embed = new MessageEmbed();
        Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
        Embed.setTitle(`${currentQueueLenth} in Queue`);
        Embed.setURL(process.env.WEBSITE!);

        const max = currentQueueLenth > itemsPerPage ? itemsPerPage * page : currentQueueLenth;

        const startIndex = max > itemsPerPage ? (max - itemsPerPage) : 0;

        for (let i = startIndex; i < max; i++) {
            let currentSong = this.songs[i];

            if (currentSong != undefined) Embed.addField(`${i}) \`${currentSong.title}\``, `**Requested by** ${currentSong.requester} \n`, false);

        }

        Embed.setFooter({ text: `Page ${page} of ${currentPages}` });

        return [Embed, currentPages];
    }

    /**
     * Pushes voice state updates from the websocket to the music provider
     * @param {WebsocketPayload} data The payload from the websocket
     */
    voiceStateUpdate(data) {
        if (data.guild_id === this.id && data.user_id === bus.bot!.user!.id) {
            if (data.channel_id === null && !this.isSwitchingChannels) {
                this.destroyQueue();
            }
        }
    }

    /**
     * Ensures a queue is still playing incase something goes wrong
     */
    async ensurePlay() {
        if (!this.isPlaying() && !this.isPaused() && this.songs.length > 0) {
            this.playNextSong();
        }
    }

    /**
     * Handles the end of a song
     * @param {MusicProviderPayload} data The payload from the music provider.
     */

    onSongEnd(data) {
        if (data.reason === "REPLACED") return; // Ignore REPLACED reason to prevent skip loops

        this.emit('state', 'Finished');

        if (this.currentSong) {
            switch (this.loopType) {
                case ELoopType.NONE:
                    this.currentSong = null;
                    break;
                case ELoopType.SONG:
                    this.songs.unshift(this.currentSong);
                    break;

                case ELoopType.QUEUE:
                    this.songs.push(this.currentSong);
                    break;
            }
        }

        this.playNextSong();
    }

    /**
     * Plays the next song in a queue
     */
    async playNextSong() {

        if (this.queueTimeout) {
            clearTimeout(this.queueTimeout);
            this.queueTimeout = null;
        }


        if (this.songs.length == 0) {
            this.timeout = null//setTimeout(this.destroyQueue.bind(this), queueTimeout);
            this.isIdle = true;
            this.emit('state', 'Idle');
            await this.deleteSavedQueueFile();
            return;
        }

        try {

            const song = this.songs[0];

            this.currentSong = song;

            this.player!.play(song.track, { "volume": this.volume * maxRawVolume });

            this.createNowPlayingMessage();

            this.songs.shift();

            this.emit('state', 'Playing');

        } catch (error) {

            utils.log(`Error playing song\n`, error);

            this.songs.shift();

            this.playNextSong();
        }

        await this.saveQueueToFile();

    }

    /**
     * Parses a command for the specified queue
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async parseInput(ctx: IUmekoCommandContext) {

        let url = "";

        if (ctx.type != EUmekoCommandContextType.CHAT_MESSAGE) await (ctx.command as BaseCommandInteraction).deferReply(); // defer because queue might take a while

        if (!this.player) {

            this.player = await bus.lavacordManager!.join({
                guild: ctx.command.guild!.id, // Guild id
                channel: (ctx.command.member as GuildMember).voice.channel!.id, // Channel id
                node: "1", // lavalink node id, based on array of nodes
            });

            const playerEndBind = this.onSongEnd.bind(this);
            this.player.on('end', playerEndBind);
            this.boundEvents.push({ owner: this.player, event: 'end', function: playerEndBind })
        }

        // handle different command types
        switch (ctx.type) {
            case EUmekoCommandContextType.CHAT_MESSAGE:
                url = (ctx.command as IParsedMessage).pureContent;
                break;
            case EUmekoCommandContextType.SLASH_COMMAND:
                url = (ctx.command as CommandInteraction).options.getString('url')!;
                break;
            case EUmekoCommandContextType.MESSAGE_CONTEXT_MENU:
                const contextMessage = (ctx.command as ContextMenuInteraction).options.getMessage('message')!;
                if (contextMessage.embeds[0] !== undefined) {
                    url = contextMessage.embeds[0].url!;
                }
                else if (contextMessage.content !== '') {
                    const contentLow = contextMessage.content.toLowerCase();
                    url = contextMessage.content;
                }
                break;
        }


        if (!url.length) return await bus.slashCommands.get('help')?.execute(ctx, 'play');


        let newSongs: ISong[] = [];


        const check = this.checkUrl(url);

        // Fetch song data
        try {
            // Simple yt video shit

            switch (check.type) {
                case EMusicCheckType.SEARCH:
                    const songs = await Queue.getSongs(url, ctx.command.member as GuildMember);

                    if (songs.length) newSongs.push.apply(newSongs, songs);
                    break;
                case EMusicCheckType.SPOTIFY_TRACK:
                    const spotifyData = await Queue.fetchSpotifyTrack(check)

                    const song = await Queue.convertSpotifyToSong(ctx, spotifyData, newSongs);

                    break;
                case EMusicCheckType.SPOTIFY_ALBUMN:

                    const albumFetchers: Promise<void>[] = [];

                    (await Queue.fetchSpotifyAlbumTracks(check)).forEach(function (data, index) {
                        data.priority = index;
                        albumFetchers.push(Queue.convertSpotifyToSong(ctx, data, newSongs));
                    });

                    await Promise.all(albumFetchers);

                    break;
                case EMusicCheckType.SPOTIFY_PLAYLIST:
                    const playlistFetchers: Promise<void>[] = [];

                    (await Queue.fetchSpotifyPlaylistTracks(check)).forEach(function (data, index) {
                        data.track.priority = index;
                        playlistFetchers.push(Queue.convertSpotifyToSong(ctx, data.track, newSongs));
                    });

                    await Promise.all(playlistFetchers);

                    break;
            }
        }
        catch (error) {
            utils.log(`Error fetching song for url "${url}"\n`, error);
        }

        if (newSongs.length && (newSongs[0] as any).priority !== undefined) {
            newSongs.sort((a, b) => { return (a as any).priority - (b as any).priority });
        }




        if (this.songs.length === 0 && !this.currentSong) {
            this.songs.push.apply(this.songs, newSongs);

            this.playNextSong();

            if (newSongs[0] == undefined) return await utils.reply(ctx, "The music could not be loaded");


            if (ctx.type !== EUmekoCommandContextType.CHAT_MESSAGE) await utils.reply(ctx, "Playing");

        }
        else {
            this.songs.push.apply(this.songs, newSongs);
            const Embed = new MessageEmbed();

            Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
            Embed.setFooter({ text: `Added to the Queue`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });

            if (newSongs.length > 1) {
                Embed.setTitle(`${newSongs.length} Songs`);
                Embed.setURL(`${url}`);
            }
            else {
                if (newSongs[0] == undefined) return await utils.reply(ctx, "The music could not be loaded");

                Embed.setTitle(`${newSongs[0].title}`);
                Embed.setURL(`${newSongs[0].uri}`)

            }

            await utils.reply(ctx, { embeds: [Embed] })
        }

        this.saveQueueToFile();
    }

    /**
     * Pauses a song
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async pauseSong(ctx: IUmekoCommandContext) {
        if (this.isPlaying() && !this.isPaused()) {
            this.emit('state', 'Paused');

            await this.player!.pause(true);

            const Embed = new MessageEmbed();
            Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
            Embed.setURL(process.env.WEBSITE!);
            Embed.setFooter({ text: `${(ctx.command.member as GuildMember).displayName} paused the music`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });

            await utils.reply(ctx, { embeds: [Embed] })
        }
    }

    /**
     * Resumes a song
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async resumeSong(ctx: IUmekoCommandContext) {
        if (this.isPaused()) {
            this.emit('state', 'Resumed');

            await this.player!.pause(false);

            const Embed = new MessageEmbed();
            Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
            Embed.setURL(process.env.WEBSITE!);
            Embed.setFooter({ text: `${(ctx.command.member as GuildMember).displayName} Un-Paused the music`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });

            await utils.reply(ctx, { embeds: [Embed] })
        }
    }

    /**
     * Removes a song from the specified queue
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async removeSong(ctx: IUmekoCommandContext) {
        const index: number = ctx.type === EUmekoCommandContextType.SLASH_COMMAND ? (ctx.command as CommandInteraction).options.getInteger('index')! : parseInt((ctx.command as IParsedMessage).args[0])!;

        if (index !== index) {
            await bus.slashCommands.get('help')?.execute(ctx, 'remove');
            return;
        }

        if (index < 0 || index > this.songs.length - 1) {
            await utils.reply(ctx, `Please select an index from the queue.`);
            await this.showQueue(ctx);
            return;
        }

        const song = this.songs[index];

        this.songs.splice(index, 1)

        this.saveQueueToFile();

        const Embed = new MessageEmbed();
        Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
        Embed.setURL(process.env.WEBSITE!);
        Embed.setFooter({ text: `Removed "${song.title}" from the queue`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });

        await utils.reply(ctx, { embeds: [Embed] });
    }

    /**
     * Displays the "NowPlaying" Message
     * @param ctx The command.
     */
    async showNowPlaying(ctx: IUmekoCommandContext) {

        if (this.isPlaying()) {
            await this.createNowPlayingMessage(ctx);
        }
        else {
            const Embed = new MessageEmbed();
            Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
            Embed.setURL(process.env.WEBSITE!);
            Embed.setFooter({ text: `There is nothing currently playing` });

            await utils.reply(ctx, { embeds: [Embed] });
        }
    }

    /**
     * Sets the looping state of the queue
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async setLooping(ctx: IUmekoCommandContext) {

        if (ctx.type === EUmekoCommandContextType.CHAT_MESSAGE && (ctx.command as IParsedMessage).args[0] === undefined) return await utils.reply(ctx, bus.slashCommands.get('loop')?.description || '');

        const Embed = new MessageEmbed();

        Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);

        Embed.setURL(process.env.WEBSITE!);
        Embed.setFooter({ text: `${(ctx.command.member as GuildMember).displayName}`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });

        const option = ctx.type === EUmekoCommandContextType.SLASH_COMMAND ? (ctx.command as CommandInteraction).options.getString('state')! : (ctx.command as IParsedMessage).args[0]?.toLowerCase();

        if (option === ELoopType.NONE) {

            this.loopType = ELoopType.NONE;
            Embed.setFooter({ text: `Looping Off`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });
        } else if (option === ELoopType.SONG) {

            this.loopType = ELoopType.SONG;
            Embed.setFooter({ text: `Looping Current Song`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });
        } else if (option === ELoopType.QUEUE) {

            this.loopType = ELoopType.QUEUE;
            Embed.setFooter({ text: `Looping Queue`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });
        } else {
            await bus.slashCommands.get('help')?.execute(ctx, 'loop');
            return
        }

        await utils.reply(ctx, { embeds: [Embed] })

        this.saveQueueToFile();

    }

    /**
     * Displays the current song list
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async showQueue(ctx: IUmekoCommandContext) {

        if (this.songs.length > queueItemsPerPage) {
            const showQueueButtons = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('previous')
                        .setStyle('PRIMARY')
                        .setEmoji(leftArrowEmoji)
                        .setDisabled(true),
                    new MessageButton()
                        .setCustomId('next')
                        .setEmoji(rightArrowEmoji)
                        .setStyle(`PRIMARY`),
                );
            const message = await utils.reply(ctx, { embeds: [this.generateQueueEmbed(1)[0]], components: [showQueueButtons], fetchReply: true });
            if (message) {
                const collectorData = { currentPage: 0, id: this.id, owner: ctx.command.member?.user.id };

                const queueCollector = new utils.InteractionCollector<ButtonInteraction, typeof collectorData>(bus.bot!, collectorData, { message: message, componentType: 'BUTTON', idle: 7000 });
                queueCollector.resetTimer({ time: 7000 });


                queueCollector.on('collect', async (button: ButtonInteraction) => {
                    const queue = bus.queues.get(queueCollector.data.id);

                    if (!queue) return;

                    if (button.user.id !== queueCollector.data.owner) {
                        await utils.reply({ command: button, type: EUmekoCommandContextType.SLASH_COMMAND }, { content: "why must thou choose violence ?", ephemeral: true });
                        return;
                    }

                    await button.deferUpdate();

                    const newButtons = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                                .setCustomId('previous')
                                .setEmoji(leftArrowEmoji)
                                .setStyle('PRIMARY'),
                            new MessageButton()
                                .setCustomId('next')
                                .setEmoji(rightArrowEmoji)
                                .setStyle(`PRIMARY`),
                        );


                    if (button.customId == 'previous') {
                        queueCollector.data.currentPage--;
                    }

                    if (button.customId == 'next') {
                        queueCollector.data.currentPage++;
                    }

                    const generatedData = queue.generateQueueEmbed(queueCollector.data.currentPage);

                    const newEmbed = generatedData[0];

                    if (queueCollector.data.currentPage == 1) newButtons.components[0].setDisabled(true);
                    if (queueCollector.data.currentPage == generatedData[1]) newButtons.components[1].setDisabled(true);

                    queueCollector.resetTimer({ time: 7000 });

                    await button.editReply({ embeds: [newEmbed], components: [newButtons] });
                });

                queueCollector.on('end', (collected, reason) => {

                    const newButtons = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                                .setCustomId('previous')
                                .setEmoji(leftArrowEmoji)
                                .setStyle('PRIMARY')
                                .setDisabled(true),
                            new MessageButton()
                                .setCustomId('next')
                                .setEmoji(rightArrowEmoji)
                                .setStyle(`PRIMARY`)
                                .setDisabled(true),
                        );

                    (queueCollector.options.message as Message).fetch().then((message) => {
                        if (message) message.edit({ embeds: [message.embeds[0]], components: [newButtons] });
                    }).catch(utils.log);
                });

            }
            else {

                await utils.reply(ctx, { embeds: [this.generateQueueEmbed(1)[0]] });
            }


        }
        else {
            await utils.reply(ctx, { embeds: [this.generateQueueEmbed(1)[0]] });
        }

    }

    /**
     * Saves the song list of the queue to the Database
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async saveQueue(ctx: IUmekoCommandContext) {

    }

    /**
     * loads the song list into the specified queue or into a new queue
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async loadQueue(ctx: IUmekoCommandContext) {
    }

    /**
     * Sets the volume of the specified queue
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async setVolume(ctx: IUmekoCommandContext) {

        const volume = ctx.type == EUmekoCommandContextType.SLASH_COMMAND ? (ctx.command as CommandInteraction).options.getInteger('volume') : parseInt((ctx.command as IParsedMessage).args[0]);

        if (!volume) return await bus.slashCommands.get('help')?.execute(ctx, 'volume');


        if (volume !== volume) {
            await bus.slashCommands.get('help')?.execute(ctx, 'volume');
            return;
        }

        if (volume < 1 || volume > 100) {
            await utils.reply(ctx, 'Please use a value between 1 and 100.');
            return;
        }

        this.volume = (volume / 100);

        this.player!.volume(this.volume * maxRawVolume);

        const Embed = new MessageEmbed();
        Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
        Embed.setURL(process.env.WEBSITE!);
        Embed.setFooter({
            text: `${(ctx.command.member as GuildMember).displayName} Changed the volume to ${this.volume * 100
                }`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 })
        });

        await utils.reply(ctx, { embeds: [Embed] });

        this.saveQueueToFile();
    }

    /**
     * Skips the current song in the specified queue
     * @param ctx The command.
     * @param {Queue} queue The queue specified.
     */
    async skipSong(ctx: IUmekoCommandContext) {

        if (this.songs.length != 0 || (this.isPlaying() && this.loopType !== ELoopType.NONE)) {

            const Embed = new MessageEmbed();
            Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
            Embed.setURL(process.env.WEBSITE!);
            Embed.setFooter({ text: `${(ctx.command.member as GuildMember).displayName} Skipped the song`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });

            await this.player!.stop();


            await utils.reply(ctx, { embeds: [Embed] });


        }
        else {

            const Embed = new MessageEmbed();
            Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
            Embed.setURL(process.env.WEBSITE!);
            Embed.setFooter({ text: `The Queue is empty`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });

            await utils.reply(ctx, { embeds: [Embed] });
        }

    }

    /**
     * Stops the specified queue and disconnects the bot from the voice channel
     * @param ctx The command.
     */
    async stop(ctx: IUmekoCommandContext) {

        const Embed = new MessageEmbed();
        Embed.setColor(bus.guildSettings.get(this.id)!.color as ColorResolvable);
        Embed.setURL(process.env.WEBSITE!);
        Embed.setFooter({ text: `${(ctx.command.member as GuildMember).displayName} Disconnected Me`, iconURL: (ctx.command.member as GuildMember).displayAvatarURL({ format: 'png', size: 32 }) });
        await this.player?.stop();
        await this.destroyQueue();
        await utils.reply(ctx, { embeds: [Embed] });
    }

    /**
     * Checks if the queue specified is currently active (i.e. playing or paused)
     * @returns boolean
     */
    isPlaying() {
        return this.player!.playing || this.player!.paused;
    }

    /**
     * Checks if the queue specified is paused
     * @returns boolean
     */
    isPaused() {
        return this.player!.paused;
    }

    /**
     * Destroys the queue the function is bound to
     */
    async destroyQueue() {

        if (this.isDisconnecting) return

        this.isDisconnecting = true;

        if (this.nowPlayingMessage != undefined) {
            this.nowPlayingMessage.stop('EndOfLife');
            this.nowPlayingMessage = undefined;
        }

        if (this.timeout != undefined) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        if (this.songs.length || this.currentSong) {
            await this.deleteSavedQueueFile();
        }

        this.songs = [];
        this.loopType = ELoopType.NONE;

        this.boundEvents.forEach(function (boundEvent) {

            if (boundEvent.owner && boundEvent.function) {
                boundEvent.owner.removeListener(boundEvent.event, boundEvent.function);
            }
        })

        this.emit('state', 'Destroyed');

        await bus.lavacordManager!.leave(this.id);

        bus.queues.delete(this.id);
    }
}


if (bus.bot && bus.lavacordManager && bus.queues.size) {
    Array.from(bus.queues.entries()).forEach(([guildId, queue]) => {

        const oldQueue = queue;

        const newQueue = new Queue(oldQueue, EQueueSource.QUEUE);

        oldQueue.boundEvents.forEach(function (boundEvent) {
            if (boundEvent.owner && boundEvent.function) {
                boundEvent.owner.off(boundEvent.event, boundEvent.function);
            }
        });

        if (oldQueue.timeout != undefined) {
            clearTimeout(oldQueue.timeout);
            oldQueue.timeout = undefined;
        }

        oldQueue.player = null;

        bus.queues.set(guildId, newQueue);
        newQueue.createNowPlayingMessage(undefined);
        utils.log('Replaced Queue for guild', guildId);
    })
}

if (!bus.loadedSyncFiles.includes('music')) {
    bus.loadedSyncFiles.push('music');
    fs.readdir(queuesPath).then((result) => {
        result.forEach(savedQueue => loadQueueFromFile(savedQueue).catch(utils.log))
    }).catch(utils.log)
} else {
    utils.reloadDependentCommands('music');

}