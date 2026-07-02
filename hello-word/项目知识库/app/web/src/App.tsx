import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout.tsx';
import { KnowledgeListPage } from './pages/KnowledgeListPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { IngestPage } from './pages/IngestPage.tsx';
import { DetailPage } from './pages/DetailPage.tsx';
import { EditPage } from './pages/EditPage.tsx';
import { TagsPage } from './pages/TagsPage.tsx';
import { GraphPage } from './pages/GraphPage.tsx';
import { AskPage } from './pages/AskPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<KnowledgeListPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/new" element={<IngestPage />} />
        <Route path="/k/:id" element={<DetailPage />} />
        <Route path="/k/:id/edit" element={<EditPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/tags/:name" element={<TagsPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/ask" element={<AskPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
