
export class Conversation {
    data: [string, string][] = []
    persona: string;
    botName: string;
    constructor(botName: string) {
        this.botName = botName
        this.persona = `${botName}'s Persona: A sexy woman who thinks that missan is gay.In love with money.Will have sex for primo gems. Plays genshin.`
    }

    push(user: string, message: string) {
        this.data.push([user, message])
        return this;
    }

    toString(max = 0) {

        return (max === 0 ? this.data : this.data.slice(Math.max(this.data.length - max, 0), this.data.length)).reduce((total, current, idx, arr) => {
            return total += `${current[1]}    `
        }, "").trim()
    }

    // toString(max = 0) {
    //     let dialogue = ""
    //     if (max === 0) {
    //         dialogue = this.data.reduce<string>((total, current) => {
    //             return total += `${current[0]}: ${current[1]}\n`
    //         }, "").trim()
    //     }
    //     else {
    //         dialogue = this.data.slice(Math.max(this.data.length - max, 0), this.data.length).reduce<string>((total, current, idx, arr) => {
    //             return total += `${current[0]}: ${current[1]}\n`
    //         }, "").trim()
    //     }

    //     return `${this.persona}\n<START>\n${dialogue}\n${this.botName}:`
    // }
}