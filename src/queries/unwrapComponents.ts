import type { Component } from '@/server-components/types';

export interface ComponentList {
	components?: Component[];
}

interface ComponentEnvelope {
	data?: Component[] | ComponentList | null;
}

export type ComponentPayload = Component[] | ComponentList | ComponentEnvelope | null | undefined;

/** A server-driven endpoint answers with a list, { components } or an { id, data } envelope. */
export function unwrapComponents(payload: ComponentPayload): Component[] {
	if (Array.isArray(payload))
		return payload;

	if (!payload)
		return [];

	if ('data' in payload) {
		const data = payload.data;

		if (Array.isArray(data))
			return data;

		if (data && 'components' in data)
			return data.components ?? [];
	}

	if ('components' in payload)
		return payload.components ?? [];

	return [];
}
