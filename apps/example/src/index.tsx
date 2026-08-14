import 'antd/dist/reset.css';
import '@antd-form-generator/core/styles.css';
import '@antd-form-generator/builder/styles.css';
import { App as AntdApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { CustomComponentsProvider } from '@antd-form-generator/core';
import { appCustomComponents } from './custom';
import { ConsoleSettingsProvider } from './lib/consoleSettings';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <ConfigProvider locale={enUS} theme={{ token: { borderRadius: 8 } }}>
      {/* antd 6 warns on static message/modal calls — App provides the hooks. */}
      <AntdApp>
        {/* One registry for the whole console, so a `custom` node resolves the
            same way in a form, a workflow step and a summary. Registering it
            here rather than per route also proves the barrel and the subpath
            imports resolve to one module: two copies of `custom.tsx` would mean
            two contexts, and every custom field would render "not registered". */}
        <CustomComponentsProvider components={appCustomComponents}>
          {/* Everything the host gets to say about fetching. */}
          <ConsoleSettingsProvider>
            {/* `basename` comes from `server.base` — see rsbuild.config.ts. */}
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <App />
            </BrowserRouter>
          </ConsoleSettingsProvider>
        </CustomComponentsProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
