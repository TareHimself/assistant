async function main() {
	const { Client } = await import('discord.js-selfbot-v13');
	const { DiscordStreamClient } = await import('discord-stream-client');

	const client = new Client();
	const StreamClient = new DiscordStreamClient(client);

	const token = '';

	client.login(token);

	client.on('ready', async () => {
		// Connect to a voice channel
		const voiceConnection = await StreamClient.joinVoiceChannel(
			client.channels.cache.get('766775964326953041'),
			{
				selfDeaf: false,
				selfMute: true,
				selfVideo: false,
			}
		);
		// I want to use screen sharing ...
		const streamConnection = await voiceConnection.createStream();
		// Create a player
		const player = StreamClient.createPlayer(
			'C:\\Users\\Taree\\Videos\\Genshin Impact 2023-01-08 02-31-16 - Trim.mp4',
			streamConnection.udp
		);
		// Events
		player.on('finish', () => {
			console.log('Finished playing');
		});
		// Play video !!!
		player.play(10000);
	});
}

main();
