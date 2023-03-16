import './resolver';
import * as fs from 'fs';
import path from 'path';
process.env = {
	...process.env,
	...JSON.parse(
		fs.readFileSync(path.join(__dirname, '../keys.json'), { encoding: 'ascii' })
	),
};
import { Assistant, DefaultContext } from '@core/assistant';
import { ELoadableState } from '@core/base';
import { PythonProcess } from '@core/subprocess';
global.bus = {
	assistant: new Assistant(),
};

//SendNotification({ app: "Alice (Assistant)", image: `D:\\Github\\voice\\assets\\icon.png`, title: "Kirei", content: "Where Is You?" })

// const tts: PythonProcess = new PythonProcess('tts.py');
// const stt: PythonProcess = new PythonProcess('stt.py');
// tts.waitForState(ELoadableState.ACTIVE).then(() => {
// 	console.log('TTS ACTIVE');
// 	stt.waitForState(ELoadableState.ACTIVE).then(() => {
// 		console.log('STT ACTIVE');
// 		tts.send(Buffer.from('Speech to text active'), 0);
// 		stt.on('onPacket', (op, data) => {
// 			tts.send(data, op);
// 		});
// 	});
// });
