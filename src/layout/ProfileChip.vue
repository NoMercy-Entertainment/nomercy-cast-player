<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useMeQuery } from '@/queries/useMeQuery';
import { authStore } from '@/stores/authStore';

const { t } = useTranslation();
const router = useRouter();
const { data: me } = useMeQuery();

const displayName = computed(() => {
	if (me.value?.name)
		return me.value.name;

	const claims = authStore.userClaims.value;

	return (
		(claims?.display_name as string) ??
		(claims?.preferred_username as string) ??
		(claims?.given_name as string) ??
		t('layout.profile_chip.you')
	);
});

const WHITESPACE = /\s+/;

const initials = computed(() => {
	return displayName.value
		.split(WHITESPACE)
		.map((s) => s[0])
		.filter(Boolean)
		.slice(0, 2)
		.join('')
		.toUpperCase();
});

const avatarUrl = computed(() => {
	// Prefer the SaaS /v1/me avatarUrl (server-managed asset on R2);
	// fall through to JWT picture/avatar_url claims. No avatar claim means
	// no avatar: the initials fallback below covers it.
	if (me.value?.avatarUrl)
		return me.value.avatarUrl;

	const claims = authStore.userClaims.value;
	const claimAvatar =
		(claims?.picture as string | undefined) ??
		(claims?.avatar_url as string | undefined) ??
		(claims?.avatarUrl as string | undefined);

	if (claimAvatar && typeof claimAvatar === 'string' && claimAvatar.length > 0)
		return claimAvatar;

	return null;
});

const el = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'nav-profile',
	el,
	onAction: () => {
		router.push('/profile');
	},
});
</script>

<template>
	<button
		ref="el"
		class="profile-chip"
		type="button"
		data-focusable
		tabindex="0"
		:aria-label="t('layout.profile_chip.aria', { name: displayName })"
		@click.prevent="router.push('/profile')"
	>
		<img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="avatar">
		<span v-else class="initials">{{ initials }}</span>
	</button>
</template>

<style scoped>
.profile-chip {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	background: oklch(0 0 0 / 0.6);
	border: 2px solid transparent;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	padding: 0;
	cursor: pointer;
	position: relative;
	isolation: isolate;
	overflow: hidden;
	outline: none;
	transition: background var(--motion-fast);
	display: grid;
	place-items: center;
}
.profile-chip:focus-visible {
	background: transparent;
}
/* TvNavigationBar.kt:224-229: primary fading to primary at 80 % alpha. */
.profile-chip:focus-visible::before {
	content: '';
	position: absolute;
	inset: 0;
	z-index: -1;
	background: var(--color-primary, oklch(0.7 0.2 285));
	-webkit-mask-image: linear-gradient(90deg, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.8));
}
.avatar {
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: 50%;
}
.initials {
	display: grid;
	place-items: center;
	width: 100%;
	height: 100%;
	background: linear-gradient(135deg, oklch(0.85 0.18 35), oklch(0.6 0.2 285));
	color: var(--cast-text-primary);
	font-weight: 700;
	font-size: 14px;
	letter-spacing: 0.04em;
}
</style>
