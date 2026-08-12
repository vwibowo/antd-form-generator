import { BuilderWorkspace } from '@antd-form-generator/builder/BuilderWorkspace';
import { appCustomComponents } from './custom';

export function App() {
    return (
      <BuilderWorkspace CustomComponents={appCustomComponents} />
  );
}
