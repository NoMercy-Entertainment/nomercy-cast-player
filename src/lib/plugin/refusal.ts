export type PluginRefusalSeverity = 'blocked' | 'degraded' | 'warning';

/**
 * Why a plugin did not do what the viewer asked, in the same six parts the
 * server, the browser and the phone use.
 *
 * One shape everywhere is what lets an author meet the same sentence in the
 * editor, on the permissions page and in a support message.
 */
export interface PluginRefusal {
	code: string;
	plugin: string;
	what: string;
	why: string;
	fix: string;
	severity: PluginRefusalSeverity;
}
