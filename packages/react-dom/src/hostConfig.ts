export type Container = Element;
export type Instance = Element;

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const appendChildToContainer = appendInitialChild;

// ---------------------------------- 各种类型的真实DOM --------------------------------- //
// 创建hostcomponent
export const createInstance = (type: string): Instance => {
	const element = document.createElement(type);
	return element;
};
// 创建hosttext
export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};
