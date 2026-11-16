<script setup lang="ts">
import SetupBackdrop from '@/components/SetupBackdrop.vue';
import AppLogo from '@/layout/AppLogo.vue';

/*
 * About screen — APK preferences/about/tv/AboutScreen.kt parity.
 * SetupBackdrop + centered product card: AppLogo (wide) + version +
 * tagline + developed-by + copyright. No technical details (build
 * flavor, package name, installer ID) — those belong on a developer
 * dashboard, not the user-facing About page.
 */

const APP_VERSION = '1.0.0-alpha';
const FOUNDING_YEAR = 2024;
const currentYear = new Date().getFullYear();
</script>

<template>
	<div class="about-screen">
		<SetupBackdrop />
		<div class="about-card">
			<AppLogo class="brand-logo" />

			<p class="version">
				Version {{ APP_VERSION }}
			</p>

			<p class="tagline">
				Your media, on every screen. Self-hosted. No ads, no tracking,
				no compromise.
			</p>

			<div class="footer">
				<p class="developed">
					Developed by NoMercy Entertainment
				</p>
				<p class="copyright">
					© {{ FOUNDING_YEAR }}–{{ currentYear }} NoMercy Entertainment.
					All product names, logos, and brands are property of their
					respective owners.
				</p>
			</div>
		</div>
	</div>
</template>

<style scoped>
.about-screen {
	position: relative;
	height: 100%;
	display: grid;
	place-items: center;
	padding: 48px;
	overflow: hidden;
}
.about-card {
	position: relative;
	z-index: 1;
	max-width: 720px;
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 24px;
	color: var(--nm-text-primary);
	text-align: center;
}
.brand-logo {
	width: 320px;
	height: 80px;
	filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.5));
}
.version {
	margin: 0;
	font-size: 14px;
	font-weight: 500;
	color: oklch(0.85 0.005 250);
}
.tagline {
	margin: 0;
	font-size: 16px;
	line-height: 1.5;
	color: rgba(255, 255, 255, 0.85);
	max-width: 540px;
}
.footer {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-top: 4px;
}
.developed {
	margin: 0;
	font-size: 13px;
	color: oklch(0.85 0.005 250);
}
.copyright {
	margin: 0;
	font-size: 12px;
	line-height: 1.5;
	color: rgba(255, 255, 255, 0.7);
	max-width: 600px;
}
</style>
