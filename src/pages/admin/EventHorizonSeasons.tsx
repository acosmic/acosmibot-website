import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

const themes = [['halloween', 'Halloween'], ['thanksgiving', 'Thanksgiving'], ['christmas', 'Christmas']] as const;
type Theme = typeof themes[number][0];
type Availability = 'hidden' | 'coming_soon' | 'playable';
type Seasons = Record<Theme, Availability>;
type Response = { success: boolean; data: Seasons };
const endpoint = '/api/admin/event-horizon-seasons';
const queryKey = ['admin', 'event-horizon-seasons'];

export function EventHorizonSeasons() {
  const client = useQueryClient();
  const query = useQuery({ queryKey, queryFn: () => api.fetch<Response>(endpoint) });
  const [draft, setDraft] = useState<Seasons | null>(null);
  const mutation = useMutation({
    mutationFn: (data: Seasons) => api.fetch<Response>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (response) => { client.setQueryData(queryKey, response); setDraft(null); },
  });
  const form = draft ?? query.data?.data;
  const dirty = themes.some(([id]) => form?.[id] !== query.data?.data[id]);
  return (
    <section className="eh-theme-settings" aria-labelledby="eh-theme-heading">
      <h4 id="eh-theme-heading">Event Horizon themes</h4>
      <p className="text-muted">Choose which themes players can see and play. Classic is always available.</p>
      <p id="eh-theme-help" className="text-muted small">Hidden removes the option. Coming soon shows a disabled option. Playable lets players select it. Changes apply when players reopen the Activity.</p>
      {query.isError ? <div role="alert"><p>Could not load theme settings.</p><button type="button" className="btn btn-secondary" onClick={() => query.refetch()}>Retry</button></div> : !form ? <p role="status">Loading themes…</p> : (
        <form onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(Object.fromEntries(themes.map(([id]) => [id, form[id]])) as Seasons);
        }}>
          {themes.map(([id, name]) => (
            <div className="eh-theme-setting" key={id}>
              <label htmlFor={`eh-theme-${id}`}>{name}</label>
              <select id={`eh-theme-${id}`} value={form[id]} disabled={mutation.isPending} aria-describedby="eh-theme-help"
                onChange={(event) => { mutation.reset(); setDraft({ ...form, [id]: event.target.value as Availability }); }}>
                <option value="hidden">Hidden</option>
                <option value="coming_soon">Coming soon</option>
                <option value="playable">Playable</option>
              </select>
            </div>
          ))}
          <div className="eh-theme-actions">
            <button type="submit" className="btn btn-primary" disabled={!dirty || mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save themes'}</button>
            {mutation.isSuccess && !dirty && <span role="status">Themes saved.</span>}
          </div>
          {mutation.isError && <p role="alert" className="eh-theme-error">{mutation.error.message}</p>}
        </form>
      )}
    </section>
  );
}
