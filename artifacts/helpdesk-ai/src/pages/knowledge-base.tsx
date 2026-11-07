import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, Search } from 'lucide-react';
import {
  getListKbArticlesQueryKey,
  useAdminCreateKbArticle,
  useAdminUpdateKbArticle,
  useListKbArticles,
} from '@workspace/api-client-react';
import type { KbArticle, User } from '@workspace/api-client-react';

type Notice = { kind: 'success' | 'warning' | 'error'; text: string } | null;

const INDEX_WARNING = 'Saved, but the AI search index could not be updated. The article will not appear in AI suggestions until it is saved again.';

function apiMessage(error: unknown, fallback: string): string {
  const text = (error as { data?: { error?: unknown } } | null)?.data?.error;
  return typeof text === 'string' && text && !text.startsWith('[') ? text : fallback;
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function ArticleForm({ article, categories, onDone, onNotice }: { article?: KbArticle; categories: string[]; onDone: () => void; onNotice: (notice: Notice) => void }) {
  const client = useQueryClient();
  const create = useAdminCreateKbArticle();
  const update = useAdminUpdateKbArticle();
  const uid = article?.id ?? 'new';
  const [title, setTitle] = useState(article?.title ?? '');
  const [category, setCategory] = useState(article?.category ?? '');
  const [body, setBody] = useState(article?.body ?? '');
  const [isPublished, setIsPublished] = useState(article?.isPublished ?? true);
  const pending = create.isPending || update.isPending;

  const finish = (result: { embedded: boolean }) => {
    client.invalidateQueries({ queryKey: getListKbArticlesQueryKey() });
    onNotice(result.embedded
      ? { kind: 'success', text: article ? 'Article updated.' : 'Article created.' }
      : { kind: 'warning', text: INDEX_WARNING });
    onDone();
  };
  const fail = (err: unknown) => onNotice({ kind: 'error', text: apiMessage(err, 'The article could not be saved. Please try again.') });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onNotice(null);
    const data = { title: title.trim(), category: category.trim(), body: body.trim(), isPublished };
    if (article) update.mutate({ articleId: article.id, data }, { onSuccess: finish, onError: fail });
    else create.mutate({ data }, { onSuccess: finish, onError: fail });
  };

  return <form onSubmit={submit} className="panel fade-in" style={{ padding: 20, marginBottom: 16 }} aria-label={article ? 'Edit article' : 'New article'}>
    <div className="form-group"><label className="form-label" htmlFor={`kb-title-${uid}`}>Title</label><input id={`kb-title-${uid}`} className="field" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-kb-title" /></div>
    <div className="form-group"><label className="form-label" htmlFor={`kb-category-${uid}`}>Category</label><input id={`kb-category-${uid}`} className="field" list={`kb-categories-${uid}`} required minLength={2} maxLength={80} value={category} onChange={(e) => setCategory(e.target.value)} data-testid="input-kb-category" /><datalist id={`kb-categories-${uid}`}>{categories.map((item) => <option key={item} value={item} />)}</datalist></div>
    <div className="form-group"><label className="form-label" htmlFor={`kb-body-${uid}`}>Article text</label><textarea id={`kb-body-${uid}`} className="textarea" rows={10} required minLength={10} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} data-testid="input-kb-body" /></div>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, fontSize: 13 }}><input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} data-testid="input-kb-published" />Published: visible to everyone and used for AI suggestions</label>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
      <button type="button" className="btn" onClick={onDone} data-testid="button-cancel-kb">Cancel</button>
      <button type="submit" className="btn btn-primary" disabled={pending} data-testid="button-save-kb">{pending ? 'Saving…' : article ? 'Save changes' : 'Create article'}</button>
    </div>
  </form>;
}

export function KnowledgeBasePage({ user, embedded = false }: { user: User; embedded?: boolean }) {
  const isAdmin = user.role === 'admin';
  const client = useQueryClient();
  const articles = useListKbArticles();
  const publish = useAdminUpdateKbArticle();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const categories = useMemo(() => Array.from(new Set((articles.data ?? []).map((item) => item.category))).sort(), [articles.data]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (articles.data ?? []).filter((item) =>
      (!category || item.category === category) &&
      (!needle || item.title.toLowerCase().includes(needle) || item.body.toLowerCase().includes(needle)));
  }, [articles.data, search, category]);

  const togglePublished = (item: KbArticle) => {
    setNotice(null);
    publish.mutate({ articleId: item.id, data: { isPublished: !item.isPublished } }, {
      onSuccess: (result) => {
        client.invalidateQueries({ queryKey: getListKbArticlesQueryKey() });
        setNotice(result.embedded
          ? { kind: 'success', text: item.isPublished ? 'Article unpublished. AI suggestions will no longer use it.' : 'Article published.' }
          : { kind: 'warning', text: INDEX_WARNING });
      },
      onError: (err) => setNotice({ kind: 'error', text: apiMessage(err, 'That change could not be saved. Please try again.') }),
    });
  };

   return <div className={embedded ? 'fade-in' : 'content fade-in'}>
    {!embedded && <div className="page-heading"><div><div className="eyebrow">SERVICE DESK / KNOWLEDGE BASE</div><h1 className="page-title">Knowledge base</h1><p className="page-subtitle">Step-by-step help for common problems. The same articles power the AI suggestions on tickets.</p></div></div>}
    <div className="toolbar">
      <div className="search-wrap"><Search size={15} /><input className="field" type="search" placeholder="Search articles…" aria-label="Search articles" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-kb" /></div>
      <select className="select" aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-filter-kb-category"><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      {isAdmin && <button className="btn btn-primary" onClick={() => { setAdding((open) => !open); setEditingId(null); setNotice(null); }} data-testid="button-add-kb"><Plus size={14} />New article</button>}
    </div>
    {notice && (notice.kind === 'success'
      ? <div role="status" className="success-note" style={{ margin: '0 0 15px' }} data-testid="text-kb-success">{notice.text}</div>
      : <div role="alert" className="form-error" data-testid="text-kb-error">{notice.text}</div>)}
    {isAdmin && adding && <ArticleForm categories={categories} onDone={() => setAdding(false)} onNotice={setNotice} />}
    {articles.isLoading ? <section className="panel" style={{ padding: '10px 20px' }}>{[1, 2, 3].map((item) => <div className="skeleton" key={item} />)}</section>
      : articles.isError ? <section className="panel"><div className="error-state"><h3>Articles could not be loaded</h3><p>Check your connection, then try again.</p><button className="btn btn-small" onClick={() => articles.refetch()}>Retry</button></div></section>
      : !visible.length ? <section className="panel"><div className="empty-state"><h3>No matching articles</h3><p>Try a different search or category.</p></div></section>
      : visible.map((item) => editingId === item.id
        ? <ArticleForm key={item.id} article={item} categories={categories} onDone={() => setEditingId(null)} onNotice={setNotice} />
        : <section className="panel" key={item.id} style={{ marginBottom: 12, opacity: item.isPublished ? 1 : 0.75 }} data-testid={`article-${item.id}`}>
          <details>
            <summary style={{ cursor: 'pointer', padding: '14px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="panel-title" style={{ flex: 1, minWidth: 200 }}>{item.title}</span>
              <span className="badge status-new">{item.category}</span>
              {!item.isPublished && <span className="badge status-closed">Unpublished</span>}
            </summary>
            <div style={{ padding: '0 20px 18px' }}>
              <p className="detail-description" style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{item.body}</p>
              <div className="ticket-sub">Updated {shortDate(item.updatedAt)}</div>
              {isAdmin && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-small" onClick={() => { setEditingId(item.id); setAdding(false); setNotice(null); }} data-testid={`button-edit-kb-${item.id}`}><Pencil size={13} />Edit</button>
                <button className="btn btn-small" disabled={publish.isPending} onClick={() => togglePublished(item)} data-testid={`button-toggle-kb-${item.id}`}>{item.isPublished ? <><EyeOff size={13} />Unpublish</> : <><Eye size={13} />Publish</>}</button>
              </div>}
            </div>
          </details>
        </section>)}
  </div>;
}