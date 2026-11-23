/**
 * Trivia question bank (§12.5, §10.7.5): add, edit, enable and delete questions, and import many from JSON.
 * Questions are plain text posted in chat, never run as templates or commands.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { ConfirmDialog, LoadFailed, LoadingSpinner } from '@/components/ui';
import { showToast } from '@/utils/toast';
import {
  EditorDrawer,
  EmptyState,
  Field,
  RecordTable,
  RoleGate,
  Switch,
  formatNumber,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  type Column,
} from '../shared/ui';
import { gamesApi } from './api';
import {
  EMPTY_QUESTION_DRAFT, GAME_LIMITS, IMPORT_EXAMPLE, draftFromQuestion, parseQuestionImport, questionInputFromDraft,
  questionProblem, sameQuestionDraft, type QuestionDraft, type TriviaQuestion,
} from './model';

type Editing = { kind: 'new' } | { kind: 'edit'; question: TriviaQuestion } | null;

export const QuestionsTab: React.FC<{ channelId: string; canImport: boolean }> = ({ channelId, canImport }) => {
  const list = useQuery({
    queryKey: tk(channelId, 'games', 'questions'),
    queryFn: () => gamesApi.questions(channelId),
    retry: twitchRetry,
  });
  const rows = list.data?.items ?? [];
  const limit = list.data?.limit ?? 2000;

  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_QUESTION_DRAFT);
  const [base, setBase] = useState<QuestionDraft>(EMPTY_QUESTION_DRAFT);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TriviaQuestion | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const invalidate = [tk(channelId, 'games', 'questions')];

  const save = useChannelMutation({
    mutationFn: (value: QuestionDraft) => {
      const input = questionInputFromDraft(value);
      return editing?.kind === 'edit' ? gamesApi.updateQuestion(channelId, editing.question.id, input) : gamesApi.createQuestion(channelId, input);
    },
    invalidate,
    successMessage: 'Question saved',
    errorMessage: false,
    onSuccess: () => setEditing(null),
  });
  const toggle = useChannelMutation({
    mutationFn: (question: TriviaQuestion) =>
      gamesApi.updateQuestion(channelId, question.id, { ...questionInputFromDraft(draftFromQuestion(question)), enabled: !question.enabled }),
    invalidate,
    errorMessage: 'Could not change the question.',
  });
  const remove = useChannelMutation({
    mutationFn: (question: TriviaQuestion) => gamesApi.removeQuestion(channelId, question.id),
    invalidate,
    successMessage: 'Question deleted',
    errorMessage: 'Could not delete the question.',
    onSuccess: () => { setConfirmDelete(null); setEditing(null); },
    onError: () => setConfirmDelete(null),
  });
  const importer = useChannelMutation({
    mutationFn: (questions: unknown[]) => gamesApi.importQuestions(channelId, questions),
    invalidate,
    errorMessage: false,
    onSuccess: (result) => {
      showToast(`Imported ${result.created} question${result.created === 1 ? '' : 's'}${result.skipped ? `, skipped ${result.skipped}` : ''}.`, 'success');
      setImportOpen(false);
      setImportText('');
    },
    onError: (error) => setImportError(twitchErrorMessage(error)),
  });

  const open = (question: TriviaQuestion | null) => {
    const next = question ? draftFromQuestion(question) : EMPTY_QUESTION_DRAFT;
    setDraft(next);
    setBase(next);
    setClientError(null);
    save.reset();
    setEditing(question ? { kind: 'edit', question } : { kind: 'new' });
  };
  const submit = () => {
    const problem = questionProblem(draft);
    setClientError(problem);
    if (!problem) save.mutate(draft);
  };
  const submitImport = () => {
    const parsed = parseQuestionImport(importText);
    setImportError(parsed.problem);
    if (!parsed.problem) importer.mutate(parsed.questions);
  };

  const columns: Column<TriviaQuestion>[] = [
    { key: 'question', header: 'Question', primary: true, render: (q) => q.question },
    { key: 'answers', header: 'Accepted answers', hideOnMobile: true, render: (q) => q.answers_json.join(', ') },
    { key: 'category', header: 'Category', width: '120px', hideOnMobile: true, render: (q) => q.category ?? '—' },
    { key: 'asked', header: 'Asked', width: '80px', align: 'end', render: (q) => formatNumber(q.times_asked) },
    {
      key: 'enabled', header: 'On', width: '90px',
      render: (q) => (
        <Switch label={`${q.question.slice(0, 40)} enabled`} hideLabel checked={q.enabled} disabled={toggle.isPending}
          onChange={() => toggle.mutate(q)} />
      ),
    },
  ];

  if (list.isPending) return <LoadingSpinner />;
  if (list.isError) {
    return <LoadFailed title="Trivia questions didn't load" message={`${twitchErrorMessage(list.error)} Nothing was changed.`} onRetry={() => list.refetch()} />;
  }

  return (
    <div className="tw-games-stack">
      <div className="tw-games-toolbar">
        <p className="tw-muted">{formatNumber(rows.length)} of {formatNumber(limit)} questions. Answers are matched ignoring case and punctuation.</p>
        <div className="tw-games-toolbar__actions">
          <RoleGate min="editor" role={canImport ? 'editor' : 'moderator'}>
            <button type="button" className="btn" onClick={() => { setImportError(null); setImportOpen(true); }}>
              <Upload size={16} aria-hidden="true" /> Import JSON
            </button>
          </RoleGate>
          <button type="button" className="btn primary" disabled={rows.length >= limit} onClick={() => open(null)}>
            <Plus size={16} aria-hidden="true" /> Add question
          </button>
        </div>
      </div>
      <RecordTable
        rows={rows} rowKey={(q) => q.id} caption="Trivia questions" columns={columns}
        onRowClick={open} rowLabel={(q) => `Edit question ${q.question.slice(0, 40)}`}
        activeKey={editing?.kind === 'edit' ? editing.question.id : null}
        empty={<EmptyState title="No trivia questions yet"
          description="Add a question with its accepted answers, or import a list. Trivia needs at least one enabled question."
          action={<button type="button" className="btn primary" onClick={() => open(null)}>Add question</button>} />}
      />

      <EditorDrawer
        open={editing !== null}
        title={editing?.kind === 'edit' ? 'Edit question' : 'New question'}
        onClose={() => setEditing(null)} onSubmit={submit} submitting={save.isPending}
        error={clientError ?? (save.error ? twitchErrorMessage(save.error) : null)}
        dirty={!sameQuestionDraft(draft, base)} submitLabel={editing?.kind === 'edit' ? 'Save question' : 'Add question'}
        secondaryAction={editing?.kind === 'edit' ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete(editing.question)}>Delete</button>
        ) : undefined}
      >
        <Field label="Question" help={`Up to ${GAME_LIMITS.questionMax} characters. Posted in chat as plain text.`}>
          {(control) => <textarea {...control} className="form-control" rows={3} maxLength={GAME_LIMITS.questionMax} value={draft.question}
            onChange={(event) => setDraft({ ...draft, question: event.target.value })} />}
        </Field>
        <Field label="Accepted answers" help={`One per line, up to ${GAME_LIMITS.answersMax} of ${GAME_LIMITS.answerMax} characters. The first is shown when time runs out.`}>
          {(control) => <textarea {...control} className="form-control" rows={4} value={draft.answers}
            onChange={(event) => setDraft({ ...draft, answers: event.target.value })} />}
        </Field>
        <Field label="Category" optional>
          {(control) => <input {...control} className="form-control" maxLength={GAME_LIMITS.categoryMax} value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })} />}
        </Field>
        <Switch label="Ask this question" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
      </EditorDrawer>

      <EditorDrawer
        open={importOpen} title="Import questions" onClose={() => setImportOpen(false)} onSubmit={submitImport}
        submitting={importer.isPending} error={importError} dirty={importText.trim().length > 0} submitLabel="Import"
      >
        <Field label="Questions as JSON" help={`A list of up to ${GAME_LIMITS.importMax} questions. Rows that are invalid or already in the bank are skipped.`}>
          {(control) => <textarea {...control} className="form-control tw-games-code" rows={10} spellCheck={false} value={importText}
            placeholder={IMPORT_EXAMPLE} onChange={(event) => setImportText(event.target.value)} />}
        </Field>
      </EditorDrawer>

      {confirmDelete && (
        <ConfirmDialog kicker="Delete question" title="Delete this question?" confirmLabel="Delete"
          pending={remove.isPending} onConfirm={() => remove.mutate(confirmDelete)} onClose={() => setConfirmDelete(null)}>
          <p>{confirmDelete.question}</p>
          <p>It will not be asked again. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};
