import Job, { JobData } from './Job';
import type Cluster from './Cluster';
import type { TaskFunction } from './Cluster';
import { WorkerInstance } from './concurrency/ConcurrencyImplementation';
interface WorkerOptions {
    cluster: Cluster;
    args: string[];
    id: number;
    workerInstance: WorkerInstance;
}
export interface WorkError {
    type: 'error';
    error: Error;
    jobData?: JobData;
}
export interface WorkData {
    type: 'success';
    data: any;
    jobData?: JobData;
}
export type WorkResult = WorkError | WorkData;
export default class Worker<ReturnData> implements WorkerOptions {
    cluster: Cluster;
    args: string[];
    id: number;
    workerInstance: WorkerInstance;
    busy: boolean;
    activeTarget: Job<ReturnData> | null;
    constructor({ cluster, args, id, workerInstance }: WorkerOptions);
    handle(task: TaskFunction<ReturnData>, job: Job<ReturnData>, timeout: number): Promise<WorkResult>;
    close(): Promise<void>;
}
export {};
