import path from 'path';
import { app } from 'electron';
export const WORKING_DIRECTORY = app.isPackaged
	? app.getAppPath()
	: path.join(__dirname, '..', '..');

export const PLUGINS_PATH = app.isPackaged
	? path.join(WORKING_DIRECTORY, 'plugins')
	: path.join(WORKING_DIRECTORY, 'dist', 'plugins');

export const DATA_PATH = path.join(WORKING_DIRECTORY, 'data');
