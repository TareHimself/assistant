import { Worker, isMainThread, parentPort,workerData } from 'worker_threads';
import { fork } from 'child_process';

interface IWorkerData<T extends unknown[] = unknown[],K = unknown> {
    func: string
    args: T
}

process.on('message',(data: IWorkerData)=>{
    const funct: (...args: unknown[]) => Promise<unknown> = eval(data.func)
    
    funct(...data.args).then((d) => {
        if(process.send){
            process.send({
                data: d
            })
        }
    }).catch((e) =>{
        if(process.send){
            process.send({
                error: e
            })
        }
    })
})

export function withChildProcess<T extends unknown[],K>(func: (...args: T) => Promise<K>,...args: T): Promise<K> {
    return new Promise<K>((res,rej)=>{
        const worker = fork(__filename)

        const data: IWorkerData = {
            func: func.toString(),
            args: args
        }

        worker.on('message',(data: { data?: K , error?: unknown }) => {
            if(data.data){
                res(data.data)
            }

            if(data.error){
                rej(data.error)
            }
        })

        worker.stdout?.pipe(process.stdout)
        worker.stderr?.pipe(process.stderr)

        worker.send(data)
    })
}