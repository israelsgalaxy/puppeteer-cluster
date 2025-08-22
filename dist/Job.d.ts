import { TaskFunction } from './Cluster';
export type ExecuteResolve = (value?: any) => void;
export type ExecuteReject = (reason?: any) => void;
export interface ExecuteCallbacks {
    resolve: (value?: any) => void;
    reject: ExecuteReject;
}
export interface JobData {
    url: string;
    [key: string]: any;
}
export default class Job<ReturnData> {
    data?: JobData;
    taskFunction: TaskFunction<ReturnData> | undefined;
    executeCallbacks: ExecuteCallbacks | undefined;
    private lastError;
    tries: number;
    constructor(data?: JobData, taskFunction?: TaskFunction<ReturnData>, executeCallbacks?: ExecuteCallbacks);
    getUrl(): string | undefined;
    getDomain(): string | undefined;
    addError(error: Error): void;
}
