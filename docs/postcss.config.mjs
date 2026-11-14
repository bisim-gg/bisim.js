// VitePress's theme is written for RTLCSS: this plugin turns its left and right rules around on the
// Persian pages (html dir="rtl"). The :where() prefixes keep the theme's own specificity.
import rtlcss from 'postcss-rtlcss';

export default {
  plugins: [rtlcss({ ltrPrefix: ':where([dir="ltr"])', rtlPrefix: ':where([dir="rtl"])' })],
};
