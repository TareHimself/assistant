const fs = require('fs');
const path = require('path')

const pluginPath = path.join(__dirname, "../src/plugins");

if (!process.argv[2]) {
    console.log("The name of the plugin to create was not given")
}

else {
    const pluginName = process.argv[2].toLowerCase()
    const newPluginPath = path.join(pluginPath, pluginName)
    if (fs.existsSync(newPluginPath)) {
        console.log('Plugin Already Exists')
    }
    else {

        const pluginNameWithCaps = pluginName.charAt(0).toUpperCase() + pluginName.slice(1)

        const pluginTemplate = `
import { BotPlugin } from "@modules/plugins";
import { Client } from "discord.js";



export default class ${pluginNameWithCaps}Plugin extends BotPlugin {
    constructor(bot: Client, dir: string) {
        super(bot, dir)
        this.id = '${pluginName}'
    }

    async onLoad(): Promise<void> {
        
    }

    async onDestroyed(): Promise<void> {

    }
}
        `

        fs.mkdirSync(path.join(newPluginPath, 'assets'), { recursive: true })
        fs.mkdirSync(path.join(newPluginPath, 'commands'), { recursive: true })
        fs.writeFileSync(path.join(newPluginPath, `index.ts`), pluginTemplate)
        console.log("Plugin Created")
    }
}

