import i18next from 'i18next';

// Port of app-web src/i18n/i18next.ts. The receiver has no server locale route, so every
// i18n/*.json in src is bundled and added per language, as app-web's loadFeatureWords does.
const language = navigator.language.split('-')[0] || 'en';

i18next
	.init({
		lng: language,
		fallbackLng: 'en',
		debug: false,
		load: 'currentOnly',
		interpolation: {
			escapeValue: false,
		},
	})
	.then();

interface Words {
	[key: string]: string | Words;
}

const words = import.meta.glob<Words>('../**/i18n/*.json', { eager: true, import: 'default' });

for (const [file, bundle] of Object.entries(words)) {
	const locale = file.slice(file.lastIndexOf('/') + 1, -'.json'.length);

	i18next.addResourceBundle(locale, 'translation', bundle, true, true);
}

i18next.on('languageChanged', (lng: string) => {
	document.documentElement.lang = lng;
});

document.documentElement.lang = language;

export default i18next;
