import antfu from '@antfu/eslint-config';
import pluginOxlint from 'eslint-plugin-oxlint';

import { arrowTernaryBody } from './eslint-rules/arrow-ternary-body.ts';
import { bodyShape } from './eslint-rules/body-shape.ts';
import { genericOverAnnotation } from './eslint-rules/generic-over-annotation.ts';
import { maxCallNesting } from './eslint-rules/max-call-nesting.ts';
import { membersPerLine } from './eslint-rules/members-per-line.ts';
import { noRedundantTypeAnnotation } from './eslint-rules/no-redundant-type-annotation.ts';
import { trailingArrowArgument } from './eslint-rules/trailing-arrow-argument.ts';

const pluginApp = {
	rules: {
		'arrow-ternary-body': arrowTernaryBody,
		'body-shape': bodyShape,
		'generic-over-annotation': genericOverAnnotation,
		'max-call-nesting': maxCallNesting,
		'members-per-line': membersPerLine,
		'no-redundant-type-annotation': noRedundantTypeAnnotation,
		'trailing-arrow-argument': trailingArrowArgument,
	},
};

const sourceFiles = ['src/**/*.{vue,ts}'];

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
				'unused-imports/no-unused-vars': ['error', { vars: 'all', args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
			'eslint-rules/**',
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
		// Words come from i18n/*.json through t(); the allowlist holds symbols KMP also draws literally.
		files: ['src/**/*.vue'],
		rules: {
			'vue/no-bare-strings-in-template': ['error', {
				allowlist: ['(', ')', ',', '.', '&', '+', '-', '=', '*', '/', '#', '%', '!', '?', ':', '[', ']', '{', '}', '<', '>', '·', '•', '—', '–', '×', '©', 'S', 'E'],
			}],
		},
	},
	{
		// Dev-only placeholders with no KMP twin (MusicGenreScreen:, PersonScreen: id=) and the DEV-only /__focus route.
		files: ['src/views/music/MusicGenresScreen.vue', 'src/views/person/PersonScreen.vue', 'src/views/__test__/FocusPlayground.vue'],
		rules: {
			'vue/no-bare-strings-in-template': 'off',
		},
	},
	{
		// A local whose annotation repeats its value's type drops it, and a generic call takes the
		// type as a generic instead of an annotation.
		name: 'app/no-redundant-type-annotation',
		files: sourceFiles,
		languageOptions: {
			parserOptions: { projectService: true, extraFileExtensions: ['.vue'] },
		},
		plugins: { app: pluginApp },
		rules: {
			'app/no-redundant-type-annotation': 'error',
			'app/generic-over-annotation': 'error',
			'ts/no-deprecated': 'error',
		},
	},
	...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),
	{
		// ESLint is the one formatter. The house rules refine the stylistic preset; indent stays tabs.
		name: 'app/format',
		files: sourceFiles,
		rules: {
			'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
			'style/arrow-parens': ['error', 'always'],
			'style/quote-props': ['error', 'as-needed'],
			'no-nested-ternary': 'error',
			'style/max-len': ['error', {
				code: 100,
				tabWidth: 2,
				ignoreUrls: true,
				ignoreStrings: true,
				ignoreTemplateLiterals: true,
				ignoreRegExpLiterals: true,
				ignoreComments: true,
			}],
		},
	},
	{
		// Vue templates: double-quoted attributes, one attribute per line once an element spans lines.
		name: 'app/format-vue-template',
		files: ['src/**/*.vue'],
		rules: {
			'style/max-len': 'off',
			'vue/no-restricted-syntax': ['error', {
				selector: 'ConditionalExpression ConditionalExpression',
				message: 'Name a ternary chain: move it to a computed or a function in the script.',
			}],
			'vue/html-quotes': ['error', 'double'],
			'vue/html-closing-bracket-newline': 'error',
			'vue/html-closing-bracket-spacing': 'error',
			'vue/mustache-interpolation-spacing': 'error',
			'vue/no-multi-spaces': 'error',
			'vue/max-attributes-per-line': ['error', { singleline: { max: 4 }, multiline: { max: 1 } }],
			'vue/max-len': ['error', {
				code: 100,
				template: 100,
				tabWidth: 2,
				ignoreUrls: true,
				ignoreStrings: true,
				ignoreTemplateLiterals: true,
				ignoreHTMLAttributeValues: true,
				ignoreComments: true,
			}],
		},
	},
	{
		// A blank line sets apart each group of statements; `eslint --fix` adds them.
		name: 'app/blank-lines',
		files: sourceFiles,
		rules: {
			'style/padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: '*', next: 'return' },
				{ blankLine: 'always', prev: ['const', 'let'], next: '*' },
				{ blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
				{ blankLine: 'always', prev: 'multiline-block-like', next: '*' },
				{ blankLine: 'always', prev: '*', next: 'multiline-block-like' },
				{ blankLine: 'always', prev: 'multiline-expression', next: '*' },
				{ blankLine: 'always', prev: '*', next: 'multiline-expression' },
				{ blankLine: 'always', prev: 'import', next: '*' },
				{ blankLine: 'any', prev: 'import', next: 'import' },
				{ blankLine: 'always', prev: '*', next: ['function', 'class', 'export'] },
				{ blankLine: 'any', prev: 'export', next: 'export' },
				{ blankLine: 'always', prev: ['function-overload', 'multiline-export'], next: '*' },
				{ blankLine: 'always', prev: '*', next: ['function-overload', 'multiline-export'] },
				{ blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'do', 'switch', 'try'] },
				{ blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'switch', 'try'], next: '*' },
			],
		},
	},
	{
		// A ternary puts `? a` and `: b` on their own lines; an if body is a bare exit, a returned value
		// on the next line, or a block.
		name: 'app/layout',
		files: sourceFiles,
		plugins: { app: pluginApp },
		rules: {
			// body-shape keeps a bare exit on the if line, the opposite of antfu/if-newline.
			'antfu/if-newline': 'off',
			'style/multiline-ternary': ['error', 'always'],
			'style/operator-linebreak': ['error', null, { overrides: { '?': 'before', ':': 'before' } }],
			'app/arrow-ternary-body': 'error',
			'app/body-shape': 'error',
			'app/trailing-arrow-argument': 'error',
			'app/max-call-nesting': 'error',
			'app/members-per-line': 'error',
		},
	},
	{
		// A value that picks from a known set is narrowed, never cast to the table's keys; unknown is
		// only for an input that must accept everything (catch variable, type guard).
		name: 'app/restricted-syntax',
		files: sourceFiles,
		ignores: ['src/**/*.spec.ts', 'src/test/**'],
		rules: {
			'no-restricted-syntax': [
				'error',
				'TSEnumDeclaration[const=true]',
				'TSExportAssignment',
				{
					selector: 'TSAsExpression > TSTypeOperator[operator=\'keyof\']',
					message: 'Narrow the value instead of casting to keyof.',
				},
				{
					selector:
						'TSUnknownKeyword:not(CatchClause TSUnknownKeyword, [returnType.typeAnnotation.type=\'TSTypePredicate\'] TSUnknownKeyword)',
					message:
						'Type the real shape. unknown is only for an input that must accept everything (catch variable, type guard).',
				},
			],
		},
	},
	{
		// Tests build mocks and read untyped wire data; only the keyof cast is banned there.
		name: 'app/restricted-syntax-tests',
		files: ['src/**/*.spec.ts', 'src/test/**/*.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				'TSEnumDeclaration[const=true]',
				'TSExportAssignment',
				{
					selector: 'TSAsExpression > TSTypeOperator[operator=\'keyof\']',
					message: 'Narrow the value instead of casting to keyof.',
				},
			],
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
