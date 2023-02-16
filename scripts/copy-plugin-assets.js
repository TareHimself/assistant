const fs = require("fs");
const path = require("path");
const distPath = path.join(__dirname, "../dist/plugins");
const sourcePath = path.join(__dirname, "../src/plugins");
if (fs.existsSync(distPath)) {
    fs.readdirSync(sourcePath).forEach((plugin) => {
        const copyFrom = path.join(sourcePath, plugin, 'assets')
        const copyTo = path.join(distPath, plugin, 'assets')
        try {
            fs.mkdirSync(copyTo, { recursive: true });
            fs.readdirSync(copyFrom).forEach((file) => {
                const source = path.join(copyFrom, file)
                const dest = path.join(copyTo, file)
                fs.promises.copyFile(source, dest)
            })
        } catch (error) {

        }

    })
}