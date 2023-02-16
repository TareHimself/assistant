import { SubProcessMaster } from "./subprocess";

export interface bus {
    SubProcessMaster: SubProcessMaster;
}

declare global {
    var bus: bus;
}

export { };