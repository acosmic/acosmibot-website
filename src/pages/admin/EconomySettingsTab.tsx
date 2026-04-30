import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminEconomySettings, InterestInterval } from '@/api/admin';

type FormState = Omit<AdminEconomySettings, 'interest_intervals'>;

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-light)',
  color: 'var(--text-primary)',
  maxWidth: 220,
};

export const EconomySettingsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'economy-settings'],
    queryFn: () => adminApi.getEconomySettings(),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (query.data?.data) {
      const { interest_intervals: _intervals, ...rest } = query.data.data;
      setForm(rest);
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: FormState) => adminApi.updateEconomySettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'economy-settings'] });
      setSavedAt(Date.now());
    },
  });

  if (query.isLoading || !form) {
    return <p className="text-muted">Loading...</p>;
  }
  if (query.error) {
    return <p style={{ color: '#f87171' }}>Error: {String(query.error)}</p>;
  }

  const intervals: InterestInterval[] = query.data?.data.interest_intervals ?? ['daily', 'weekly', 'monthly'];

  const numField = (
    label: string,
    field: keyof FormState,
    helper: string,
    step = 1,
  ) => (
    <div className="mb-4">
      <label className="form-label mb-2 d-block">{label}</label>
      <input
        type="number"
        min={0}
        step={step}
        className="form-control"
        value={String(form[field])}
        onChange={(e) =>
          setForm({ ...form, [field]: e.target.value === '' ? 0 : Number(e.target.value) })
        }
        style={inputStyle}
      />
      <p className="text-muted small mt-2 mb-0">{helper}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <h3 className="mb-4">Economy Settings</h3>
      <p className="text-muted mb-4">
        Bot-wide banking and interest configuration. Changes take effect immediately for all servers.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(form);
        }}
      >
        <h5 className="mb-3" style={{ color: 'var(--text-primary)' }}>Bank Fees</h5>
        {numField('Deposit fee (%)', 'deposit_fee_percent', 'Percentage taken when depositing into the bank.', 0.1)}
        {numField('Withdraw fee (%)', 'withdraw_fee_percent', 'Percentage taken when withdrawing from the bank.', 0.1)}

        <h5 className="mb-3 mt-4" style={{ color: 'var(--text-primary)' }}>Transaction Limits</h5>
        {numField('Minimum transaction', 'min_transaction', 'Smallest credit amount allowed in a deposit/withdraw.')}
        {numField('Maximum transaction', 'max_transaction', 'Largest credit amount allowed in a single deposit/withdraw.')}
        {numField('Daily transfer limit', 'daily_transfer_limit', 'Max credits a user can transfer per day.')}

        <h5 className="mb-3 mt-4" style={{ color: 'var(--text-primary)' }}>Interest</h5>

        <div className="mb-4">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.interest_enabled}
              onChange={(e) => setForm({ ...form, interest_enabled: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary-color)' }}
            />
            <span style={{ fontWeight: 600 }}>Interest enabled</span>
          </label>
          <p className="text-muted small mb-0 mt-1" style={{ marginLeft: 30 }}>
            When on, bank balances accrue interest at the configured rate and interval.
          </p>
        </div>

        {numField('Interest rate (%)', 'interest_rate_percent', 'Percentage applied to bank balances every interval.', 0.1)}

        <div className="mb-4">
          <label className="form-label mb-2 d-block">Interest interval</label>
          <select
            className="form-control"
            value={form.interest_interval}
            onChange={(e) => setForm({ ...form, interest_interval: e.target.value as InterestInterval })}
            style={inputStyle}
          >
            {intervals.map((iv) => (
              <option key={iv} value={iv}>{iv}</option>
            ))}
          </select>
          <p className="text-muted small mt-2 mb-0">How often interest is applied.</p>
        </div>

        <div className="d-flex align-items-center gap-3 mt-4">
          <button type="submit" className="btn primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save'}
          </button>
          {mutation.error && (
            <span style={{ color: '#f87171' }}>Error: {String(mutation.error)}</span>
          )}
          {!mutation.error && savedAt && Date.now() - savedAt < 4000 && (
            <span style={{ color: '#4ade80' }}>Saved</span>
          )}
        </div>
      </form>
    </div>
  );
};
