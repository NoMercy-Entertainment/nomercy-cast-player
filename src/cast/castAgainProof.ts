import { authStore } from '@/stores/authStore';

// Loaded only by a build with VITE_CAST_AGAIN_PROOF=1; production never has it.
const PROOF_SUBJECT = 'cast-again-proof';

function proofToken(secondsLeft: number): string {
	const exp = Math.floor(Date.now() / 1000) + secondsLeft;
	return `proof.${btoa(JSON.stringify({ sub: PROOF_SUBJECT, exp }))}.proof`;
}

/**
 * `?castAgainProof` starts a made-up session whose token expires in 8 s, so
 * the cast-again screen shows on a device with no sender. The stand-in sender
 * stays silent until the token expired, then answers "Try again".
 */
export function forceCastAgain(): void {
	if (!new URLSearchParams(window.location.search).has('castAgainProof'))
		return;
	authStore.setRenewalRequester(() => {
		if (authStore.castAgainRequired.value)
			window.setTimeout(() => authStore.acceptRenewedToken(proofToken(600)), 500);
	});
	authStore.consumeRealHandshake(proofToken(8), {
		serverId: PROOF_SUBJECT,
		serverUrl: window.location.origin,
		defaultSubtitleLanguage: null,
		defaultAudioLanguage: null,
	});
}
