let syncQueue: ((...args: any) => void)[] | null = null;
// isFlushingSyncQueue 的作用见《isFlushingSyncQueue是一个锁.md》
let isFlushingSyncQueue = false; // 确保同一时间只有一个 flushSyncCallbacks 操作在执行
// 将同步 callback 加入数组
export function scheduleSyncCallback(callback: (...args: any) => void) {
	if (syncQueue === null) {
		syncQueue = [callback];
	} else {
		syncQueue.push(callback);
	}
}

// 执行队列中所有的 callback
export function flushSyncCallbacks() {
	if (!isFlushingSyncQueue && syncQueue) {
		isFlushingSyncQueue = true; // 上锁
		try {
			syncQueue.forEach((callback) => callback());
		} catch (e) {
			if (__DEV__) {
				console.error('flushSyncCallbacks报错', e);
			}
		} finally {
			isFlushingSyncQueue = false; // 解锁
			syncQueue = null;
		}
	}
}
