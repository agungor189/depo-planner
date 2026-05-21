import { EntityId, PutawayTask, TaskStatus, WmsTask } from '../../domain/types';

export interface TaskTransitionResult<TTask extends WmsTask = WmsTask> {
  ok: boolean;
  task: TTask;
  error?: string;
}

const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  draft: ['suggested', 'cancelled'],
  suggested: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['waiting_scan', 'completed', 'failed', 'cancelled'],
  waiting_scan: ['completed', 'failed', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: ['assigned', 'cancelled'],
};

export function createPutawayTask(params: {
  taskId: EntityId;
  packageId: EntityId;
  sku: string;
  suggestedLocationCode: string;
  priority: number;
  now: string;
}): PutawayTask {
  return {
    taskId: params.taskId,
    taskType: 'putaway',
    status: 'suggested',
    packageId: params.packageId,
    sku: params.sku,
    suggestedLocationCode: params.suggestedLocationCode,
    priority: params.priority,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

export function transitionTask<TTask extends WmsTask>(task: TTask, nextStatus: TaskStatus, now: string): TaskTransitionResult<TTask> {
  if (!allowedTransitions[task.status].includes(nextStatus)) {
    return {
      ok: false,
      task,
      error: `${task.status} durumundan ${nextStatus} durumuna geçilemez.`,
    };
  }

  return {
    ok: true,
    task: {
      ...task,
      status: nextStatus,
      updatedAt: now,
    },
  };
}
