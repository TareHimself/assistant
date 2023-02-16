import { createInterface } from 'readline'
import * as notifier from 'node-notifier'
import { notify as BaseNotify } from 'node-notifier'

export function pad(number: number, ammount = 5) {
    let start = `${number}`;

    const needed = Math.max((ammount - start.length), 0);

    for (let i = 0; i < needed; i++) {
        start = `0${start}`;
    }

    return start;
}



export function isNumeric(value: string) {
    return /^-?\d+$/.test(value);
}


export function input<T = string>(prompt: string, toResultFn: (input: string) => Promise<T>, validateFn: (input: string) => Promise<boolean> = async () => true): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
        const questionInterface = createInterface({
            input: process.stdin,
            output: process.stdout
        })

        try {
            let result: T | null = null;

            do {
                const response = await (new Promise<string>((res) => {
                    questionInterface.question(prompt, (response) => {
                        res(response)
                    })
                }))

                if (await validateFn(response)) {
                    result = await toResultFn(response);
                }
            } while (result === null);

            resolve(result)
        } catch (error) {
            reject(error)
        }
        questionInterface.close()
    })
}

export function notify(title: string, message?: string) {
    BaseNotify({
        title,
        message,
    })
}
