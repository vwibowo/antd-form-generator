import { Route, Routes } from 'react-router';
import { AppShell } from './layout/AppShell';
import { BuilderRoute } from './routes/BuilderRoute';
import { FlowRoute } from './routes/FlowRoute';
import { FormRoute } from './routes/FormRoute';
import { ImportRoute } from './routes/ImportRoute';
import { Inbox } from './routes/Inbox';
import { Library } from './routes/Library';
import { Overview } from './routes/Overview';
import { Settings } from './routes/Settings';
import { SubmissionDetail } from './routes/SubmissionDetail';
import { TableRoute } from './routes/TableRoute';

/**
 * The console's routes.
 *
 * `/builder` sits outside `AppShell` on purpose: `BuilderWorkspace` brings its
 * own header and tab strip and is sized to the viewport, so nesting it under the
 * console's chrome would stack two headers and push the canvas off the page.
 * Every other route wants the shell.
 */
export function App() {
  return (
    <Routes>
      <Route path="/builder" element={<BuilderRoute />} />

      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="library" element={<Library />} />
        <Route path="forms/:id" element={<FormRoute />} />
        <Route path="flows/:id" element={<FlowRoute />} />
        <Route path="tables" element={<TableRoute />} />
        <Route path="tables/:id" element={<TableRoute />} />
        <Route path="submissions" element={<Inbox />} />
        <Route path="submissions/:id" element={<SubmissionDetail />} />
        <Route path="import" element={<ImportRoute />} />
        <Route path="settings" element={<Settings />} />
        {/* A deep link that no longer resolves lands here rather than blank. */}
        <Route path="*" element={<Overview />} />
      </Route>
    </Routes>
  );
}
