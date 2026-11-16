import { config } from '@vue/test-utils';
import I18NextVue from 'i18next-vue';
import i18next from '@/i18n/i18next';

// Every mounted component reads its words through i18next-vue, as it does in main.ts.
config.global.plugins = [...(config.global.plugins ?? []), [I18NextVue, { i18next }]];
