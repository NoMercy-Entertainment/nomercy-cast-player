import antfu from '@antfu/eslint-config';

export default antfu(
	{
		vue: {
			a11y: true,
			overrides: {
				'prefer-regex-literals': 'off',
				'regexp/prefer-w': 'off',
				'vue-a11y/no-distracting-elements': 'off',
				'vue/first-attribute-linebreak': 'off',
				'vue/multi-word-component-names': 'off',
				'vue/no-deprecated-slot-attribute': 'off',
				'vue/no-reserved-component-names': 'off',
				'vue-a11y/tabindex-no-positive': 'warn',
				'vue-a11y/no-static-element-interactions': 'warn',
				'vue-a11y/click-events-have-key-events': 'warn',
			},
		},
		typescript: {
			overrides: {
				'no-async-promise-executor': 'off',
				'no-console': 'off',
				'no-extend-native': 'off',
				'node/prefer-global/process': 'off',
				'perfectionist/sort-imports': 'off',
				'ts/no-unsafe-function-type': 'off',
				'unused-imports/no-unused-vars': 'warn',
			},
		},
		js: {
			overrides: {
				'no-console': 'off',
				'no-debugger': 'off',
			},
		},
		stylistic: {
			indent: 'tab',
			quotes: 'single',
			semi: true,
		},
		formatters: {
			css: true,
			html: true,
			markdown: true,
			svg: false,
		},
		ignores: [
			'docs/**',
			'.archive-v0/**',
			'public/**',
			'src/styles/nm-tokens.css',
		],
	},
	{
		// Icons come from MoooomIcon; only the brand logos draw an inline svg.
		files: ['src/**/*.vue'],
		ignores: ['src/components/icons/MoooomIcon.vue', 'src/layout/AppLogo.vue', 'src/layout/AppLogoSquare.vue'],
		rules: {
			'vue/no-restricted-html-elements': ['error', {
				element: 'svg',
				message: 'Draw icons with <MoooomIcon icon="name" /> (src/components/icons/MoooomIcon.vue), with the icon name KMP uses.',
			}],
		},
	},
	{
		// Module boundary rules per spec §7.1. The cast/ directory is the only
		// place that touches cast.framework; stores never import from
		// components or queries; lib has zero Vue imports; etc.
		files: ['src/lib/**/*.ts', 'src/stores/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['@/components/*', '@/views/*', '@/queries/*'],
							message:
								'lib/ and stores/ must not import from components/, views/, or queries/. '
								+ 'Reverse the dependency or move the helper into the consumer.',
						},
					],
				},
			],
		},
	},
);
