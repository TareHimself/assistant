import './resolver'; // top level import for module resolution help
import './console';

/**
 * Gets a random item from the array
 */
Array.prototype.random = function <T>(this: T[]): T {
	return this[Math.round((this.length - 1) * Math.random())];
};

process.env = {
	...process.env,
	...require('../keys.json'),
};
import { app } from 'electron';
import { Assistant } from '@core/assistant';
import { ChatProcess } from '@core/chat';

app.on('window-all-closed', () => {});

global.bus = {
	assistant: new Assistant(),
};

// fs.promises.readFile('test.jpg').then((file) => {
// 	FilesApi.get().upload('testfile.jpg', file).then(console.log);
// });

// SendNotification({ app: "Alice (Assistant)", image: `D:\\Github\\voice\\assets\\icon.png`, title: "Kirei", content: "Where Is You?" })

// const tts: PythonProcess = new PythonProcess('tts.py');
// const stt: PythonProcess = new PythonProcess('stt.py');
// tts.waitForState(ELoadableState.ACTIVE).then(() => {
// 	console.info('TTS ACTIVE');
// 	stt.waitForState(ELoadableState.ACTIVE).then(() => {
// 		console.info('STT ACTIVE');
// 		tts.send(Buffer.from('Speech to text active'), 0);
// 		stt.on('onPacket', (op, data) => {
// 			tts.send(data, op);
// 		});
// 	});
// });
