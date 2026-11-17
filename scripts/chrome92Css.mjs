// Lightning CSS visitor for the Cast device browser (Chrome 92): it reads no lab(), lch(),
// oklab(), oklch() or @layer. Colors become sRGB and layer blocks are flattened in source order.

const D50_TO_LINEAR_SRGB = [
	[3.1341359569958707, -1.6173863321612538, -0.4906619460083019],
	[-0.978795502912089, 1.916254567259524, 0.03344273116131949],
	[0.07195537988411677, -0.2289768264158322, 1.405386058324125],
];
const D50_WHITE = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

function labToLinear({ l, a, b }) {
	const fy = (l + 16) / 116;
	const f = [a / 500 + fy, fy, fy - b / 200];
	const eps = 216 / 24389;
	const kappa = 24389 / 27;
	const xyz = f.map((v, i) => {
		const lin = i === 1 && l <= kappa * eps ? l / kappa : v ** 3 > eps ? v ** 3 : (116 * v - 16) / kappa;
		return lin * D50_WHITE[i];
	});
	return D50_TO_LINEAR_SRGB.map(row => row[0] * xyz[0] + row[1] * xyz[1] + row[2] * xyz[2]);
}

function oklabToLinear({ l, a, b }) {
	const lms = [l + 0.3963377774 * a + 0.2158037573 * b, l - 0.1055613458 * a - 0.0638541728 * b, l - 0.0894841775 * a - 1.291485548 * b].map(v => v ** 3);
	return [
		4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
		-1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
		-0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
	];
}

function polar({ l, c, h }) {
	const rad = (h * Math.PI) / 180;
	return { l, a: c * Math.cos(rad), b: c * Math.sin(rad) };
}

function toByte(v) {
	const clamped = Math.min(1, Math.max(0, v));
	const gamma = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
	return Math.round(gamma * 255);
}

const LINEAR = {
	lab: labToLinear,
	lch: c => labToLinear(polar(c)),
	oklab: oklabToLinear,
	oklch: c => oklabToLinear(polar(c)),
};

export function colorToSrgb(color) {
	const lin = LINEAR[color.type];
	if (!lin)
		return undefined;
	const [r, g, b] = lin(color).map(toByte);
	return { type: 'rgb', r, g, b, alpha: color.alpha };
}

// Lightning CSS cannot hand @property or var() rules back from a visitor, so layers are
// unwrapped as text. Tailwind emits its layers in cascade order, so source order is kept.
const BLOCK_OR_STATEMENT = /[;{]/;
const COLOR_MIX_SUPPORTS = /@supports\s*\(\s*color\s*:\s*color-mix\(/g;
const CSS_ID = /\.css(?:\?|$)|&lang\.css/;
const AT_RULES = /@layer|@supports/;

function skipQuoted(css, i) {
	const quote = css[i];
	for (let j = i + 1; j < css.length; j++) {
		if (css[j] === '\\')
			j++;
		else if (css[j] === quote)
			return j + 1;
	}
	return css.length;
}

function closingBrace(css, open) {
	let depth = 0;
	for (let i = open; i < css.length; i++) {
		const ch = css[i];
		if (ch === '"' || ch === '\'')
			i = skipQuoted(css, i) - 1;
		else if (ch === '/' && css[i + 1] === '*')
			i = css.indexOf('*/', i + 2) + 1 || css.length;
		else if (ch === '{')
			depth++;
		else if (ch === '}' && --depth === 0)
			return i;
	}
	return -1;
}

export function flattenLayers(css) {
	let out = '';
	let i = 0;
	while (i < css.length) {
		const at = css.indexOf('@layer', i);
		if (at === -1)
			break;
		out += css.slice(i, at);
		const stop = css.slice(at).search(BLOCK_OR_STATEMENT);
		const end = stop === -1 ? -1 : at + stop;
		if (end === -1 || css[end] === ';') {
			i = end === -1 ? css.length : end + 1;
			continue;
		}
		const close = closingBrace(css, end);
		if (close === -1)
			throw new Error('flattenLayers: unbalanced @layer block');
		out += flattenLayers(css.slice(end + 1, close));
		i = close + 1;
	}
	return out + css.slice(i);
}

// Chrome 92 fails every `@supports (color: color-mix(...))` test, so its block never applies.
export function dropColorMixSupports(css) {
	const re = new RegExp(COLOR_MIX_SUPPORTS);
	let out = '';
	let i = 0;
	for (let m = re.exec(css); m; m = re.exec(css)) {
		const open = css.indexOf('{', m.index);
		const close = open === -1 ? -1 : closingBrace(css, open);
		if (close === -1)
			throw new Error('dropColorMixSupports: unbalanced @supports block');
		out += css.slice(i, m.index);
		i = close + 1;
		re.lastIndex = i;
	}
	return out + css.slice(i);
}

// Chrome 80 is the receiver's browser floor (older Cast firmware); the name stays for its callers.
export const chrome92Targets = { chrome: 80 << 16 };

export function chrome92Layers() {
	return {
		name: 'chrome92-flatten-layers',
		enforce: 'pre',
		transform(code, id) {
			if (!CSS_ID.test(id) || !AT_RULES.test(code))
				return undefined;
			return { code: dropColorMixSupports(flattenLayers(code)), map: null };
		},
	};
}

export const chrome92Visitor = {
	Color: colorToSrgb,
};
