import { input, notify } from "@core/utils"
import { PythonProcess, SubProcessMaster } from '@core/subprocess'
import { ELoadableState } from "@core/base"

global.bus = {
    SubProcessMaster: new SubProcessMaster(9000)
}

const pyTest = new PythonProcess('test.py', 9600, ["YO, WAGWAN"])
pyTest.waitForState(ELoadableState.ACTIVE).then(async () => {
    notify("YO", "Client Active")
    let history = ""
    while (true) {
        const userQuestion = await input('You:', async (a) => a)
        history += userQuestion + '    '
        const packD = await pyTest.sendAndWait(Buffer.from(history.trim()))
        if (!packD) {
            return
        }

        const [_, packet, __] = packD;

        console.log("Agent:", packet.toString())
        history += packet.toString() + "    ";

    }
})
