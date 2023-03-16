import { GatewayIntent } from "./types"


export function computeIntents(intents: GatewayIntent[]) {
    return intents.reduce((total, intent) => {
        return total + intent
    }, 0)
}

export function parseDiscoveryPacket(message: Buffer): any {
    const packet = Buffer.from(message);

    const ip = packet.slice(8, packet.indexOf(0, 8)).toString('utf8');

    const port = packet.readUInt16BE(packet.length - 2);

    return { ip, port };
}