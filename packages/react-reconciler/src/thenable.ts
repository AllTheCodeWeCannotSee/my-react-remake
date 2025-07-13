import {
	FulfilledThenable,
	PendingThenable,
	RejectedThenable,
	Thenable
} from 'shared/ReactTypes';

let suspendedThenable: Thenable<any> | null = null;
export const SuspenseException = new Error(
	'这不是个真实的错误，而是Suspense工作的一部分。如果你捕获到这个错误，请将它继续抛出去'
);
// ....................................................................
// const myWakeable = {
// 	then: function(onFulfill, onReject) {
// 	  const internalPromise = new Promise((resolve, reject) => {
// 		setTimeout(() => {
// 		  const userData = { name: '张三' };
// 		  resolve(userData);
// 		}, 2000);
// 	  });
// 	  internalPromise.then(onFulfill, onReject);
// 	},
// 	status: 'pending', // 初始状态是“进行中”
// 	value: undefined, // 初始时没有值
// 	reason: undefined // 初始时没有失败原因
//   };
// ....................................................................

// const user = use(fetchUserData());
// thenable = fetchUserData()
export function trackUsedThenable<T>(thenable: Thenable<T>) {
	switch (thenable.status) {
		case 'fulfilled':
			// 1/4 fulfilled
			return thenable.value;
		case 'rejected':
			// 2/4 rejected
			throw thenable.reason;

		default:
			if (typeof thenable.status === 'string') {
				// 3/4 pending
				thenable.then(noop, noop);
			} else {
				// 4/4 untracked
				const pending = thenable as unknown as PendingThenable<T, void, any>;
				pending.status = 'pending';
				pending.then(
					// onFulfilled
					(val) => {
						if (pending.status === 'pending') {
							// @ts-ignore
							const fulfilled: FulfilledThenable<T, void, any> = pending;
							fulfilled.status = 'fulfilled';
							fulfilled.value = val;
						}
					},
					// onRejected
					(err) => {
						if (pending.status === 'pending') {
							// @ts-ignore
							const rejected: RejectedThenable<T, void, any> = pending;
							rejected.reason = err;
							rejected.status = 'rejected';
						}
					}
				);
			}
	}
	// pending | untracked 的情况下：抛出错误
	suspendedThenable = thenable;
	throw SuspenseException;
}

function noop() {}

// 取到 suspendedThenable
export function getSuspenseThenable(): Thenable<any> {
	if (suspendedThenable === null) {
		throw new Error('应该存在suspendedThenable，这是个bug');
	}
	const thenable = suspendedThenable;
	suspendedThenable = null;
	return thenable;
}
