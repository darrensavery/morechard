import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Morechard Support',
  tagline: 'Answers for parents and kids using Morechard',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://support.morechard.com',
  baseUrl: '/',

  organizationName: 'morechard',
  projectName: 'support-docs',

  onBrokenLinks: 'throw',

  clientModules: [require.resolve('./src/clientModules/posthog.js')],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        docsRouteBasePath: '/',
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: undefined,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'morechard',
      logo: {
        alt: 'Morechard',
        src: 'img/logo-mark.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'supportSidebar',
          position: 'left',
          label: 'Guides',
        },
        {
          href: 'mailto:support@morechard.com',
          label: 'Contact Support',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Morechard',
          items: [
            {label: 'Open the app', href: 'https://app.morechard.com'},
            {label: 'morechard.com', href: 'https://morechard.com'},
          ],
        },
        {
          title: 'Support',
          items: [
            {label: 'Contact support', href: 'mailto:support@morechard.com'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Morechard.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
