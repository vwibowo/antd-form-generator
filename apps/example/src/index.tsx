import 'antd/dist/reset.css';
import '@antd-form-generator/core/styles.css';
import { App as AntdApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <ConfigProvider locale={enUS} theme={{ token: { borderRadius: 8 } }}>
      {/* antd 6 warns on static message/modal calls — App provides the hooks. */}
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
