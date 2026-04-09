import * as vscode from 'vscode';
import * as en from './en.json';
import * as zhCn from './zh-cn.json';

export type DisplayLocale = 'en' | 'zh-cn';

const bundles: Record<DisplayLocale, Record<string, string>> = {
	en: en as Record<string, string>,
	'zh-cn': zhCn as Record<string, string>,
};

let currentLocale: DisplayLocale = 'en';

export function getDisplayLocale(): DisplayLocale {
	const v = vscode.workspace.getConfiguration('gotoEndpoints').get<string>('displayLanguage', 'en');
	return v === 'zh-cn' ? 'zh-cn' : 'en';
}

export function syncLocaleFromConfig(): void {
	currentLocale = getDisplayLocale();
}

function lookup(key: string, locale: DisplayLocale): string | undefined {
	const s = bundles[locale][key];
	return typeof s === 'string' ? s : undefined;
}

/**
 * Runtime UI strings. Placeholders: {name} in template replaced from vars.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
	syncLocaleFromConfig();
	let template = lookup(key, currentLocale) ?? lookup(key, 'en') ?? key;
	if (template === key) {
		console.warn(`[GoToEndpoint i18n] Missing key: ${key}`);
	}
	if (vars) {
		for (const [k, val] of Object.entries(vars)) {
			template = template.split(`{${k}}`).join(String(val));
		}
	}
	return template;
}

export function initI18n(onLocaleChange: () => void): vscode.Disposable {
	syncLocaleFromConfig();
	return vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('gotoEndpoints.displayLanguage')) {
			syncLocaleFromConfig();
			onLocaleChange();
		}
	});
}
