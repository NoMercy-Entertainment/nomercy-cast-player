import { ref } from 'vue';
import type { Router } from 'vue-router';
import type { CastIntent } from '@/types/cast';

/**
 * Navigation store — translates LAUNCH intents and post-LAUNCH sender pushes
 * into router actions. Phase 1 only handles the initial intent dispatch;
 * post-LAUNCH sender intents wire up in Phase 2 (custom namespace) and
 * Phase 4 (route table).
 */

const lastIntent = ref<CastIntent | null>(null);

export function dispatchInitialIntent(intent: CastIntent, router: Router): void {
	lastIntent.value = intent;
	switch (intent.type) {
		case 'play_video':
			// Match the APK route shape: /{type}/{id}/watch when type is
			// movie or tv (the canonical routes), fall through to the
			// legacy /watch/{type}/{id} for any other type. Either way
			// the resume_at query param survives.
			{
				const supported = intent.media_type === 'movie' || intent.media_type === 'tv';
				const path = supported
					? `/${intent.media_type}/${intent.media_id}/watch`
					: `/watch/${intent.media_type}/${intent.media_id}`;
				// The audio and subtitle the phone showed travel with the position,
				// with the same query names the TV app's watch route uses.
				const query: Record<string, string> = {};
				if (intent.resume_at)
					query.resume_at = String(intent.resume_at);
				if (intent.audio_language)
					query.audio = intent.audio_language;
				if (intent.subtitle_language) {
					query.subtitle = intent.subtitle_language;
					if (intent.subtitle_type)
						query.subtitleType = intent.subtitle_type;
					if (intent.subtitle_codec)
						query.subtitleFormat = intent.subtitle_codec;
				}
				void router.push({
					path,
					query: Object.keys(query).length > 0 ? query : undefined,
				});
			}
			break;
		case 'play_music':
			// Music player route lands in Phase 8.
			void router.push({
				path: '/now-playing',
				query: {
					list_type: intent.list_type,
					list_id: intent.list_id,
					...(intent.track_id ? { track_id: intent.track_id } : {}),
					...(intent.resume_at ? { resume_at: String(intent.resume_at) } : {}),
				},
			});
			break;
		case 'navigate':
			void router.push(intent.route);
			break;
		case 'idle':
		default:
			void router.push('/');
			break;
	}
}

export const navStore = {
	lastIntent,
	dispatchInitialIntent,
};
