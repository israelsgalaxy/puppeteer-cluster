
import { URL } from 'url';
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

    public data?: JobData;
    public taskFunction: TaskFunction<ReturnData> | undefined;
    public executeCallbacks: ExecuteCallbacks | undefined;

    private lastError: Error | null = null;
    public tries: number = 0;

    public constructor(
        data?: JobData,
        taskFunction?: TaskFunction<ReturnData>,
        executeCallbacks?: ExecuteCallbacks,
    ) {
        this.data = data;
        this.taskFunction = taskFunction;
        this.executeCallbacks = executeCallbacks;
    }

    public getUrl(): string | undefined {
        if (!this.data) {
            return undefined;
        }
        return this.data.url;
    }

    public getDomain(): string | undefined {
        const urlStr = this.getUrl();
        if (urlStr) {
            try {
                const url = new URL(urlStr);
                return url.hostname || undefined;
            } catch (e: any) {
                return undefined;
            }
        }
        return undefined;
    }

    public addError(error: Error): void {
        this.tries += 1;
        this.lastError = error;
    }

}
